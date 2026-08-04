"""Capture measured OpenMed NER predictions for a PHI-free gold corpus.

This command talks to a running local OpenMed `/analyze` endpoint and writes a
prediction file consumable by :mod:`openmed_bridge.evaluate_extraction`.

Capturing predictions never changes MediBrief's application language route.
Arabic or other unevaluated corpora require an explicit CLI acknowledgement and
remain blocked until their measured report is reviewed and the application
policy is changed intentionally.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .evaluate_extraction import EvaluationInputError, load_ner_gold

CONDITION_LABELS = frozenset(
    {"CONDITION", "DIAGNOSIS", "DISEASE", "DISORDER", "PROBLEM", "SYMPTOM"}
)
MEDICATION_LABELS = frozenset(
    {"CHEMICAL", "DRUG", "MEDICATION", "PHARMACEUTICAL", "SUBSTANCE"}
)


class CaptureError(RuntimeError):
    """Raised when a live prediction capture cannot be trusted."""


RequestJson = Callable[[str, Mapping[str, Any], float, Mapping[str, str]], Any]


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize_base_url(value: str) -> str:
    raw = value.strip().rstrip("/")
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise CaptureError("base URL must be an absolute HTTP or HTTPS URL")
    if parsed.username or parsed.password:
        raise CaptureError("credentials must not be embedded in the base URL")
    if parsed.query or parsed.fragment:
        raise CaptureError("base URL must not include query parameters or a fragment")
    return raw


def _default_request_json(
    url: str,
    payload: Mapping[str, Any],
    timeout: float,
    headers: Mapping[str, str],
) -> Any:
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            **dict(headers),
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - explicit local/user endpoint
            data = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise CaptureError(
            f"OpenMed returned HTTP {exc.code}: {body[:500]}"
        ) from exc
    except URLError as exc:
        raise CaptureError(f"OpenMed could not be reached: {exc.reason}") from exc
    except TimeoutError as exc:
        raise CaptureError("OpenMed prediction capture timed out") from exc
    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise CaptureError("OpenMed returned a non-JSON analysis response") from exc


def _normalized_label(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    normalized = value.strip().upper()
    if normalized.startswith(("B-", "I-")):
        normalized = normalized[2:]
    return "_".join(normalized.split())


def _kind_for_label(label: str) -> str | None:
    if label in CONDITION_LABELS:
        return "condition"
    if label in MEDICATION_LABELS:
        return "medication"
    return None


def _validated_entities(
    payload: object,
    *,
    expected_text: str,
    requested_model: str,
    confidence_threshold: float,
) -> tuple[str, list[dict[str, Any]], int]:
    if not isinstance(payload, Mapping):
        raise CaptureError(f"{requested_model} returned a non-object response")
    returned_text = payload.get("text")
    if returned_text != expected_text:
        raise CaptureError(
            f"{requested_model} returned text that differs from the submitted corpus case"
        )
    raw_entities = payload.get("entities")
    if not isinstance(raw_entities, list):
        raise CaptureError(f"{requested_model} response is missing an entity array")

    model_name = next(
        (
            value
            for value in (
                payload.get("model_name"),
                payload.get("modelName"),
                payload.get("model"),
                requested_model,
            )
            if isinstance(value, str) and value.strip()
        ),
        requested_model,
    )
    rejected = 0
    entities: list[dict[str, Any]] = []
    for index, raw_entity in enumerate(raw_entities):
        if not isinstance(raw_entity, Mapping):
            rejected += 1
            continue
        try:
            start = int(raw_entity.get("start"))
            end = int(raw_entity.get("end"))
            confidence = float(raw_entity.get("confidence"))
        except (TypeError, ValueError):
            rejected += 1
            continue
        if (
            start < 0
            or end <= start
            or end > len(expected_text)
            or not math.isfinite(confidence)
            or confidence < 0
            or confidence > 1
        ):
            rejected += 1
            continue
        if confidence < confidence_threshold:
            continue
        exact_text = expected_text[start:end]
        if not exact_text.strip():
            rejected += 1
            continue
        label = _normalized_label(raw_entity.get("label"))
        kind = _kind_for_label(label)
        if kind is None:
            continue
        entities.append(
            {
                "kind": kind,
                "text": exact_text,
                "start": start,
                "end": end,
                "confidence": confidence,
                "label": label,
                "model": model_name,
            }
        )
    return model_name, entities, rejected


def _deduplicate(entities: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    selected: dict[tuple[object, ...], dict[str, Any]] = {}
    for entity in entities:
        key = (
            entity["kind"],
            entity["start"],
            entity["end"],
            str(entity["text"]).strip().casefold(),
        )
        current = selected.get(key)
        if current is None or float(entity["confidence"]) > float(current["confidence"]):
            selected[key] = dict(entity)
    return sorted(
        selected.values(),
        key=lambda entity: (
            int(entity["start"]),
            int(entity["end"]),
            str(entity["kind"]),
        ),
    )


def capture_ner_predictions(
    *,
    gold_path: str | Path,
    base_url: str,
    disease_model: str,
    medication_model: str,
    confidence_threshold: float,
    timeout_seconds: float = 300.0,
    allow_unevaluated_language: bool = False,
    request_json: RequestJson = _default_request_json,
    api_key: str | None = None,
    bearer_token: str | None = None,
) -> dict[str, Any]:
    gold_payload, cases = load_ner_gold(gold_path)
    language = str(gold_payload.get("language", "unknown"))
    if language != "en" and not allow_unevaluated_language:
        raise CaptureError(
            f"The {language!r} corpus is not an accepted application route. "
            "Pass --allow-unevaluated-language to capture research evidence without enabling it."
        )
    if not 0 <= confidence_threshold <= 1:
        raise CaptureError("confidence threshold must be between 0 and 1")
    if timeout_seconds <= 0:
        raise CaptureError("timeout must be greater than zero")

    endpoint = f"{_normalize_base_url(base_url)}/analyze"
    models = tuple(
        dict.fromkeys(
            model.strip()
            for model in (disease_model, medication_model)
            if model.strip()
        )
    )
    if not models:
        raise CaptureError("at least one OpenMed model must be supplied")

    headers: dict[str, str] = {}
    if api_key:
        headers["X-API-Key"] = api_key
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"

    output_cases: list[dict[str, Any]] = []
    service_models: set[str] = set()
    rejected_total = 0
    for case in cases:
        case_entities: list[dict[str, Any]] = []
        for model in models:
            payload = request_json(
                endpoint,
                {
                    "text": case.text,
                    "model_name": model,
                    "confidence_threshold": confidence_threshold,
                    "group_entities": False,
                    "aggregation_strategy": "simple",
                },
                timeout_seconds,
                headers,
            )
            returned_model, entities, rejected = _validated_entities(
                payload,
                expected_text=case.text,
                requested_model=model,
                confidence_threshold=confidence_threshold,
            )
            service_models.add(returned_model)
            rejected_total += rejected
            case_entities.extend(entities)
        output_cases.append(
            {
                "id": case.case_id,
                "entities": _deduplicate(case_entities),
            }
        )

    return {
        "schema_version": "1",
        "corpus_id": gold_payload.get("corpus_id"),
        "language": language,
        "prediction_source": "openmed-live",
        "captured_at": _iso_now(),
        "endpoint": endpoint,
        "requested_models": list(models),
        "returned_models": sorted(service_models),
        "model": ", ".join(sorted(service_models or set(models))),
        "confidence_threshold": confidence_threshold,
        "rejected_malformed_entities": rejected_total,
        "application_route_changed": False,
        "cases": output_cases,
        "limitations": [
            "Results are specific to the named models, threshold, service version, hardware, and corpus.",
            "Capturing an unevaluated language does not enable that language in MediBrief.",
            "This PHI-free synthetic corpus is not clinical validation.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument(
        "--disease-model",
        default="disease_detection_superclinical",
    )
    parser.add_argument(
        "--medication-model",
        default="pharma_detection_superclinical",
    )
    parser.add_argument("--confidence-threshold", type=float, default=0.6)
    parser.add_argument("--timeout-seconds", type=float, default=300.0)
    parser.add_argument("--allow-unevaluated-language", action="store_true")
    args = parser.parse_args()

    try:
        report = capture_ner_predictions(
            gold_path=args.gold,
            base_url=args.base_url,
            disease_model=args.disease_model,
            medication_model=args.medication_model,
            confidence_threshold=args.confidence_threshold,
            timeout_seconds=args.timeout_seconds,
            allow_unevaluated_language=args.allow_unevaluated_language,
            api_key=os.environ.get("OPENMED_API_KEY"),
            bearer_token=os.environ.get("OPENMED_BEARER_TOKEN"),
        )
    except (CaptureError, EvaluationInputError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2))
        return 2

    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
