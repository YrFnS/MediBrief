"""OpenMed assertion-context adapter used by MediBrief's local bridge.

The upstream OpenMed REST `/analyze` endpoint returns named-entity spans. Its
clinical ConText, experiencer, section, and medication-sig helpers are Python
APIs. This module composes those public helpers without turning their advisory
output into confirmed patient facts.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Mapping, Sequence

import openmed
from openmed.clinical import (
    assert_context_axes,
    canonical_section_label,
    parse_sig,
    resolve_experiencer,
    scan_context_cues,
)
from openmed.clinical.sections import detect_sections

CONTEXT_ENGINE = "OpenMed clinical ConText"
CONTEXT_BRIDGE_VERSION = "1"
_MAX_CONTEXT_WINDOW = 240
_CLAUSE_BOUNDARY_RE = re.compile(r"[.!?;\n]")


class ContextBridgeInputError(ValueError):
    """Raised when caller-supplied text or entity spans are inconsistent."""


class ContextBridgeRuntimeError(RuntimeError):
    """Raised when OpenMed context helpers cannot evaluate a valid request."""


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _require_text(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ContextBridgeInputError(f"{field} must be a non-empty string")
    return value


def _require_offset(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ContextBridgeInputError(f"{field} must be an integer")
    return value


def _validated_span(text: str, raw: Mapping[str, object]) -> dict[str, Any]:
    span_id = _require_text(raw.get("id"), "span.id")
    kind = _require_text(raw.get("kind"), "span.kind").lower()
    if kind not in {"condition", "medication"}:
        raise ContextBridgeInputError(
            "span.kind must be either condition or medication"
        )

    start = _require_offset(raw.get("start"), "span.start")
    end = _require_offset(raw.get("end"), "span.end")
    if start < 0 or end <= start or end > len(text):
        raise ContextBridgeInputError(
            "span offsets must satisfy 0 <= start < end <= len(text)"
        )

    source_excerpt = text[start:end]
    supplied_text = raw.get("text")
    if supplied_text is not None and supplied_text != source_excerpt:
        raise ContextBridgeInputError(
            f"span {span_id} text does not match the supplied source offsets"
        )

    label = raw.get("label")
    return {
        "id": span_id,
        "kind": kind,
        "label": str(label) if label is not None else kind,
        "text": source_excerpt,
        "start": start,
        "end": end,
    }


def _section_for_span(
    sections: Sequence[Mapping[str, Any]],
    start: int,
    end: int,
) -> Mapping[str, Any] | None:
    for section in sections:
        try:
            section_start = int(section["start"])
            section_end = int(section["end"])
        except (KeyError, TypeError, ValueError):
            continue
        if start >= section_start and end <= section_end:
            return section
    return None


def _section_payload(section: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if section is None:
        return None
    payload: dict[str, Any] = {
        "label": str(section.get("label") or "unsectioned"),
        "start": int(section.get("start", 0)),
        "end": int(section.get("end", 0)),
    }
    for key in ("header", "header_start", "header_end", "content_start", "source"):
        value = section.get(key)
        if value is not None:
            payload[key] = value
    canonical = canonical_section_label(payload["label"])
    if canonical:
        payload["canonical"] = canonical
    return payload


def _clause_start(text: str, span_start: int) -> int:
    start = 0
    for match in _CLAUSE_BOUNDARY_RE.finditer(text, 0, span_start):
        start = match.end()
    return start


def _clause_end(text: str, span_end: int) -> int:
    match = _CLAUSE_BOUNDARY_RE.search(text, span_end)
    return match.start() if match else len(text)


def _medication_window(
    text: str,
    span: Mapping[str, Any],
    medication_spans: Sequence[Mapping[str, Any]],
) -> tuple[int, int, str]:
    start = int(span["start"])
    end = int(span["end"])
    left = _clause_start(text, start)
    right = _clause_end(text, end)

    ordered = sorted(medication_spans, key=lambda item: (int(item["start"]), int(item["end"])))
    index = next(
        (position for position, item in enumerate(ordered) if item["id"] == span["id"]),
        None,
    )
    if index is not None:
        if index > 0:
            previous_end = int(ordered[index - 1]["end"])
            if previous_end > left:
                left = previous_end
        if index + 1 < len(ordered):
            next_start = int(ordered[index + 1]["start"])
            if next_start < right:
                right = next_start

    left = max(left, start - 80)
    right = min(right, end + 160)
    if right - left > _MAX_CONTEXT_WINDOW:
        right = min(right, left + _MAX_CONTEXT_WINDOW)

    while left < right and text[left].isspace():
        left += 1
    while right > left and text[right - 1].isspace():
        right -= 1
    return left, right, text[left:right]


def _medication_sig_payload(
    text: str,
    span: Mapping[str, Any],
    medication_spans: Sequence[Mapping[str, Any]],
) -> dict[str, Any] | None:
    window_start, window_end, window = _medication_window(
        text,
        span,
        medication_spans,
    )
    if not window:
        return None

    sig = _json_safe(parse_sig(window))
    recognized = any(
        (
            sig.get("dose") is not None,
            sig.get("route") is not None,
            sig.get("frequency_per_day") is not None,
            bool(sig.get("as_needed")),
            sig.get("condition") is not None,
            sig.get("duration_days") is not None,
        )
    )
    if not recognized:
        return None

    return {
        "window_start": window_start,
        "window_end": window_end,
        **sig,
    }


def analyze_clinical_context(
    *,
    text: str,
    spans: Sequence[Mapping[str, object]],
    language: str = "en",
    evaluated_at: str | None = None,
) -> dict[str, Any]:
    """Return advisory assertion context and medication-sig evidence.

    All offsets refer to *text*. This function does not confirm, reject, or
    otherwise mutate a MediBrief clinical record.
    """

    source_text = _require_text(text, "text")
    if not isinstance(spans, Sequence) or isinstance(spans, (str, bytes)):
        raise ContextBridgeInputError("spans must be a sequence")

    validated = [_validated_span(source_text, span) for span in spans]
    if not validated:
        return {
            "text": source_text,
            "engine": CONTEXT_ENGINE,
            "engine_version": getattr(openmed, "__version__", None),
            "bridge_version": CONTEXT_BRIDGE_VERSION,
            "language": language or "en",
            "evaluated_at": evaluated_at or _iso_now(),
            "results": [],
        }

    active_language = (language or "en").strip() or "en"
    try:
        sections = detect_sections(source_text, language=active_language)
        context_spans: list[dict[str, Any]] = []
        section_by_id: dict[str, Mapping[str, Any] | None] = {}
        for span in validated:
            section = _section_for_span(
                sections,
                int(span["start"]),
                int(span["end"]),
            )
            section_by_id[str(span["id"])] = section
            context_spans.append(
                {
                    **span,
                    "document_text": source_text,
                    **({"section": section.get("label")} if section else {}),
                }
            )

        cue_map = scan_context_cues(
            source_text,
            context_spans,
            language=active_language,
        )
        medication_spans = [span for span in validated if span["kind"] == "medication"]
        results: list[dict[str, Any]] = []

        for original, context_span in zip(validated, context_spans, strict=True):
            hits = tuple(cue_map.get(context_span, ()) or ())
            section = section_by_id[str(original["id"])]
            section_label = section.get("label") if section else None
            assertion = assert_context_axes(
                context_span,
                hits,
                section=section_label,
                language=active_language,
            )
            assignment = resolve_experiencer(
                source_text,
                context_span,
                section_experiencer=assertion.experiencer,
            )

            result: dict[str, Any] = {
                "id": original["id"],
                "kind": original["kind"],
                "text": original["text"],
                "start": original["start"],
                "end": original["end"],
                "assertion": {
                    "polarity": assertion.negation or "affirmed",
                    "certainty": assertion.certainty,
                    "temporality": assertion.temporality,
                    "experiencer": assignment.experiencer,
                },
                "cues": [
                    {
                        "text": hit.cue,
                        "category": hit.category,
                        "start": hit.start,
                        "end": hit.end,
                        "direction": hit.direction,
                    }
                    for hit in hits
                ],
                "experiencer_evidence": {
                    "source": assignment.source,
                    **({"cue": assignment.cue} if assignment.cue else {}),
                    **(
                        {
                            "start": assignment.cue_offset[0],
                            "end": assignment.cue_offset[1],
                        }
                        if assignment.cue_offset
                        else {}
                    ),
                },
            }
            section_payload = _section_payload(section)
            if section_payload:
                result["section"] = section_payload
            if original["kind"] == "medication":
                sig = _medication_sig_payload(source_text, original, medication_spans)
                if sig:
                    result["medication_sig"] = sig
            results.append(result)

        return {
            "text": source_text,
            "engine": CONTEXT_ENGINE,
            "engine_version": getattr(openmed, "__version__", None),
            "bridge_version": CONTEXT_BRIDGE_VERSION,
            "language": active_language,
            "evaluated_at": evaluated_at or _iso_now(),
            "results": results,
        }
    except ContextBridgeInputError:
        raise
    except Exception as exc:  # pragma: no cover - defensive adapter boundary
        raise ContextBridgeRuntimeError(
            "OpenMed clinical context evaluation failed"
        ) from exc


__all__ = [
    "CONTEXT_BRIDGE_VERSION",
    "CONTEXT_ENGINE",
    "ContextBridgeInputError",
    "ContextBridgeRuntimeError",
    "analyze_clinical_context",
]
