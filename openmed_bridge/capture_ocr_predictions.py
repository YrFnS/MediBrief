"""Capture measured OCR predictions from the local MediBrief document bridge.

The command consumes a PHI-free OCR gold corpus plus a local fixture manifest,
submits each fixture to ``/medibrief/documents/extract``, and writes a prediction
file accepted by :mod:`openmed_bridge.evaluate_extraction`.

No fixture bytes or extracted text are sent anywhere except the explicitly
configured endpoint. The command does not enable a language route or confirm a
clinical fact. Empty or failed OCR cases are omitted from the prediction case
array so the evaluator scores them as empty predictions.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .evaluate_extraction import EvaluationInputError, load_ocr_gold


class OcrCaptureError(RuntimeError):
    """Raised when a live OCR capture cannot be trusted."""


RequestJson = Callable[[str, Mapping[str, Any], float, Mapping[str, str]], Any]

_ALLOWED_STATUSES = {"completed", "partial", "empty", "unsupported"}
_ALLOWED_OCR_MODES = {"auto", "always", "never"}
_ALLOWED_OCR_ENGINES = {"auto", "doctr", "tesseract", "easyocr", "paddleocr"}


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_json(path: str | Path) -> dict[str, Any]:
    source = Path(path)
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except OSError as exc:
        raise OcrCaptureError(f"Could not read {source}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise OcrCaptureError(f"Invalid JSON in {source}: {exc}") from exc
    if not isinstance(value, dict):
        raise OcrCaptureError(f"{source} must contain a JSON object")
    return value


def _required_text(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise OcrCaptureError(f"{field} must be a non-empty string")
    return value.strip()


def _normalize_base_url(value: str) -> str:
    raw = value.strip().rstrip("/")
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise OcrCaptureError("base URL must be an absolute HTTP or HTTPS URL")
    if parsed.username or parsed.password:
        raise OcrCaptureError("credentials must not be embedded in the base URL")
    if parsed.query or parsed.fragment:
        raise OcrCaptureError("base URL must not include query parameters or a fragment")
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
        raise OcrCaptureError(
            f"Document bridge returned HTTP {exc.code}: {body[:500]}"
        ) from exc
    except URLError as exc:
        raise OcrCaptureError(f"Document bridge could not be reached: {exc.reason}") from exc
    except TimeoutError as exc:
        raise OcrCaptureError("Document bridge prediction capture timed out") from exc
    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise OcrCaptureError("Document bridge returned a non-JSON response") from exc


def _integer(value: object, field: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise OcrCaptureError(f"{field} must be an integer >= {minimum}")
    return value


def _confidence(value: object, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise OcrCaptureError(f"{field} must be numeric")
    result = float(value)
    if not math.isfinite(result) or result < 0 or result > 1:
        raise OcrCaptureError(f"{field} must be between 0 and 1")
    return result


def _load_fixtures(
    manifest_path: str | Path,
    *,
    expected_case_ids: set[str],
    expected_corpus_id: object,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    source = Path(manifest_path)
    payload = _load_json(source)
    manifest_corpus_id = payload.get("corpus_id")
    if (
        manifest_corpus_id is not None
        and expected_corpus_id is not None
        and manifest_corpus_id != expected_corpus_id
    ):
        raise OcrCaptureError("fixture manifest corpus_id does not match OCR gold")
    raw_fixtures = payload.get("fixtures")
    if not isinstance(raw_fixtures, list):
        raise OcrCaptureError("fixture manifest fixtures must be an array")

    fixtures: dict[str, dict[str, Any]] = {}
    for index, raw_fixture in enumerate(raw_fixtures):
        field = f"fixtures[{index}]"
        if not isinstance(raw_fixture, Mapping):
            raise OcrCaptureError(f"{field} must be an object")
        case_id = _required_text(raw_fixture.get("id"), f"{field}.id")
        if case_id not in expected_case_ids:
            raise OcrCaptureError(f"{field}.id is not present in OCR gold: {case_id}")
        if case_id in fixtures:
            raise OcrCaptureError(f"duplicate fixture id: {case_id}")
        relative_path = _required_text(raw_fixture.get("path"), f"{field}.path")
        fixture_path = (source.parent / relative_path).resolve()
        mime_type = _required_text(raw_fixture.get("mime_type"), f"{field}.mime_type")
        ocr_mode = str(raw_fixture.get("ocr_mode", "auto"))
        ocr_engine = str(raw_fixture.get("ocr_engine", "auto"))
        if ocr_mode not in _ALLOWED_OCR_MODES:
            raise OcrCaptureError(f"{field}.ocr_mode is unsupported")
        if ocr_engine not in _ALLOWED_OCR_ENGINES:
            raise OcrCaptureError(f"{field}.ocr_engine is unsupported")
        raw_languages = raw_fixture.get("languages", ["en"])
        if not isinstance(raw_languages, list):
            raise OcrCaptureError(f"{field}.languages must be an array")
        languages = [
            str(value).strip().lower()
            for value in raw_languages
            if str(value).strip()
        ]
        if not languages:
            raise OcrCaptureError(f"{field}.languages must contain a code")
        resolution = _integer(raw_fixture.get("resolution", 200), f"{field}.resolution", 72)
        if resolution > 400:
            raise OcrCaptureError(f"{field}.resolution must be <= 400")
        fixtures[case_id] = {
            "path": fixture_path,
            "mime_type": mime_type,
            "ocr_mode": ocr_mode,
            "ocr_engine": ocr_engine,
            "languages": languages,
            "resolution": resolution,
        }

    missing = sorted(expected_case_ids - fixtures.keys())
    if missing:
        raise OcrCaptureError(
            "fixture manifest is missing OCR gold cases: " + ", ".join(missing)
        )
    return payload, fixtures


def _validated_response(
    payload: object,
    *,
    document_id: str,
    file_name: str,
) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise OcrCaptureError("document bridge returned a non-object response")
    status = _required_text(payload.get("status"), "response.status")
    if status not in _ALLOWED_STATUSES:
        raise OcrCaptureError(f"document bridge returned unsupported status: {status}")
    if payload.get("document_id") != document_id:
        raise OcrCaptureError("document bridge returned a different document_id")
    if payload.get("file_name") != file_name:
        raise OcrCaptureError("document bridge returned a different file_name")
    text = payload.get("text")
    if not isinstance(text, str):
        raise OcrCaptureError("document bridge response.text must be a string")
    raw_pages = payload.get("pages")
    if not isinstance(raw_pages, list):
        raise OcrCaptureError("document bridge response.pages must be an array")

    pages: list[dict[str, Any]] = []
    seen_pages: set[int] = set()
    for index, raw_page in enumerate(raw_pages):
        field = f"response.pages[{index}]"
        if not isinstance(raw_page, Mapping):
            raise OcrCaptureError(f"{field} must be an object")
        page_number = _integer(raw_page.get("page_number"), f"{field}.page_number", 1)
        start = _integer(raw_page.get("start"), f"{field}.start")
        end = _integer(raw_page.get("end"), f"{field}.end")
        if page_number in seen_pages:
            raise OcrCaptureError(f"duplicate response page number: {page_number}")
        seen_pages.add(page_number)
        if end < start or end > len(text):
            raise OcrCaptureError(f"{field} has an invalid text interval")
        page_text = text[start:end]
        if page_text:
            pages.append(
                {
                    "page_number": page_number,
                    "start": start,
                    "end": end,
                    "text": page_text,
                }
            )
        _confidence(raw_page.get("average_confidence"), f"{field}.average_confidence")
        _confidence(raw_page.get("minimum_confidence"), f"{field}.minimum_confidence")

    warnings = payload.get("warnings", [])
    if not isinstance(warnings, list) or not all(isinstance(item, str) for item in warnings):
        raise OcrCaptureError("document bridge response.warnings must be a string array")
    failed_pages = payload.get("failed_pages", [])
    if not isinstance(failed_pages, list):
        raise OcrCaptureError("document bridge response.failed_pages must be an array")

    return {
        "status": status,
        "text": text,
        "pages": pages,
        "method": payload.get("method"),
        "engine": payload.get("engine"),
        "bridge_version": payload.get("bridge_version"),
        "ocr_engine": payload.get("ocr_engine"),
        "languages": payload.get("languages"),
        "source_sha256": payload.get("source_sha256"),
        "text_sha256": payload.get("text_sha256"),
        "warnings": warnings,
        "failed_pages": failed_pages,
    }


def capture_ocr_predictions(
    *,
    gold_path: str | Path,
    fixture_manifest_path: str | Path,
    base_url: str,
    timeout_seconds: float = 300.0,
    request_json: RequestJson = _default_request_json,
    api_key: str | None = None,
    bearer_token: str | None = None,
) -> dict[str, Any]:
    gold_payload, gold_cases = load_ocr_gold(gold_path)
    case_ids = {case.case_id for case in gold_cases}
    manifest_payload, fixtures = _load_fixtures(
        fixture_manifest_path,
        expected_case_ids=case_ids,
        expected_corpus_id=gold_payload.get("corpus_id"),
    )
    if timeout_seconds <= 0:
        raise OcrCaptureError("timeout must be greater than zero")

    endpoint = f"{_normalize_base_url(base_url)}/medibrief/documents/extract"
    headers: dict[str, str] = {}
    if api_key:
        headers["X-API-Key"] = api_key
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"

    output_cases: list[dict[str, Any]] = []
    outcomes: list[dict[str, Any]] = []
    engines: set[str] = set()
    empty_case_ids: list[str] = []
    for case in gold_cases:
        fixture = fixtures[case.case_id]
        path = Path(fixture["path"])
        try:
            content = path.read_bytes()
        except OSError as exc:
            raise OcrCaptureError(f"Could not read fixture {path}: {exc}") from exc
        if not content:
            raise OcrCaptureError(f"OCR fixture is empty: {path}")

        document_id = f"phase3-ocr-evaluation:{case.case_id}"
        payload = request_json(
            endpoint,
            {
                "document_id": document_id,
                "file_name": path.name,
                "mime_type": fixture["mime_type"],
                "document_base64": base64.b64encode(content).decode("ascii"),
                "ocr_mode": fixture["ocr_mode"],
                "ocr_engine": fixture["ocr_engine"],
                "languages": fixture["languages"],
                "resolution": fixture["resolution"],
            },
            timeout_seconds,
            headers,
        )
        result = _validated_response(
            payload,
            document_id=document_id,
            file_name=path.name,
        )
        if isinstance(result["engine"], str) and result["engine"]:
            engines.add(result["engine"])
        if result["text"]:
            output_cases.append(
                {
                    "id": case.case_id,
                    "text": result["text"],
                    "pages": result["pages"],
                }
            )
        else:
            empty_case_ids.append(case.case_id)
        outcomes.append(
            {
                "id": case.case_id,
                "status": result["status"],
                "fixture": str(path),
                "method": result["method"],
                "ocr_engine": result["ocr_engine"],
                "languages": result["languages"],
                "warnings": result["warnings"],
                "failed_pages": result["failed_pages"],
                "source_sha256": result["source_sha256"],
                "text_sha256": result["text_sha256"],
            }
        )

    return {
        "schema_version": "1",
        "corpus_id": gold_payload.get("corpus_id"),
        "prediction_source": "openmed-document-bridge-live",
        "captured_at": _iso_now(),
        "endpoint": endpoint,
        "engine": ", ".join(sorted(engines)) or "OpenMed document bridge",
        "fixture_manifest": str(Path(fixture_manifest_path)),
        "fixture_manifest_version": manifest_payload.get("schema_version"),
        "cases": output_cases,
        "case_outcomes": outcomes,
        "empty_case_ids": empty_case_ids,
        "application_route_changed": False,
        "limitations": [
            "Results are specific to the named OCR engine, language data, resolution, bridge version, hardware, and fixtures.",
            "An omitted empty case is scored by the evaluator as an empty prediction.",
            "OCR quality does not establish clinical NER or assertion-context quality.",
            "This PHI-free fixture corpus is not clinical validation.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", required=True)
    parser.add_argument("--fixtures", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--timeout-seconds", type=float, default=300.0)
    args = parser.parse_args()

    try:
        report = capture_ocr_predictions(
            gold_path=args.gold,
            fixture_manifest_path=args.fixtures,
            base_url=args.base_url,
            timeout_seconds=args.timeout_seconds,
        )
    except (OcrCaptureError, EvaluationInputError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2))
        return 2

    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
