from __future__ import annotations

import pytest

from openmed_bridge.context_service import (
    ContextBridgeInputError,
    analyze_clinical_context,
)


def span(text: str, surface: str, *, kind: str = "condition", occurrence: int = 0):
    starts = []
    cursor = text.find(surface)
    while cursor != -1:
        starts.append(cursor)
        cursor = text.find(surface, cursor + 1)
    start = starts[occurrence]
    return {
        "id": f"{kind}-{start}",
        "kind": kind,
        "text": surface,
        "label": surface,
        "start": start,
        "end": start + len(surface),
    }


def result_for(payload: dict[str, object], result_id: str) -> dict[str, object]:
    return next(item for item in payload["results"] if item["id"] == result_id)  # type: ignore[index,union-attr]


def test_negation_uncertainty_and_scope_are_advisory_and_span_scoped():
    text = (
        "No evidence of pneumonia, but asthma is present. "
        "Possible bronchitis."
    )
    pneumonia = span(text, "pneumonia")
    asthma = span(text, "asthma")
    bronchitis = span(text, "bronchitis")

    payload = analyze_clinical_context(
        text=text,
        spans=[pneumonia, asthma, bronchitis],
        evaluated_at="2026-07-31T12:00:00Z",
    )

    pneumonia_result = result_for(payload, pneumonia["id"])
    asthma_result = result_for(payload, asthma["id"])
    bronchitis_result = result_for(payload, bronchitis["id"])

    assert pneumonia_result["assertion"]["polarity"] == "negated"  # type: ignore[index]
    assert asthma_result["assertion"]["polarity"] == "affirmed"  # type: ignore[index]
    assert bronchitis_result["assertion"]["certainty"] == "uncertain"  # type: ignore[index]
    assert any(
        cue["category"] == "negation"
        for cue in pneumonia_result["cues"]  # type: ignore[union-attr]
    )


def test_historical_hypothetical_and_family_experiencer_are_preserved():
    text = (
        "Past Medical History:\nHistory of asthma.\n"
        "Family History:\nMother has diabetes.\n"
        "Plan:\nIf wheezing occurs, use inhaler."
    )
    asthma = span(text, "asthma")
    diabetes = span(text, "diabetes")
    wheezing = span(text, "wheezing")

    payload = analyze_clinical_context(
        text=text,
        spans=[asthma, diabetes, wheezing],
        evaluated_at="2026-07-31T12:00:00Z",
    )

    asthma_result = result_for(payload, asthma["id"])
    diabetes_result = result_for(payload, diabetes["id"])
    wheezing_result = result_for(payload, wheezing["id"])

    assert asthma_result["assertion"]["temporality"] == "historical"  # type: ignore[index]
    assert diabetes_result["assertion"]["experiencer"] == "family"  # type: ignore[index]
    assert diabetes_result["experiencer_evidence"]["source"] in {"cue", "section"}  # type: ignore[index]
    assert wheezing_result["assertion"]["temporality"] == "hypothetical"  # type: ignore[index]
    assert wheezing_result["assertion"]["certainty"] == "uncertain"  # type: ignore[index]


def test_medication_sig_is_attached_only_when_attributes_are_recognized():
    text = "Medications:\nMetformin 500 mg PO BID for 7 days. Aspirin."
    metformin = span(text, "Metformin", kind="medication")
    aspirin = span(text, "Aspirin", kind="medication")

    payload = analyze_clinical_context(
        text=text,
        spans=[metformin, aspirin],
        evaluated_at="2026-07-31T12:00:00Z",
    )

    metformin_result = result_for(payload, metformin["id"])
    aspirin_result = result_for(payload, aspirin["id"])
    sig = metformin_result["medication_sig"]

    assert sig["dose"] == 500.0  # type: ignore[index]
    assert sig["unit"] == "mg"  # type: ignore[index]
    assert sig["route"] == "oral"  # type: ignore[index]
    assert sig["frequency_per_day"] == 2.0  # type: ignore[index]
    assert sig["duration_days"] == 7  # type: ignore[index]
    assert "medication_sig" not in aspirin_result


def test_source_offsets_and_sections_remain_exact():
    text = "Assessment:\nPossible pneumonia."
    pneumonia = span(text, "pneumonia")

    payload = analyze_clinical_context(
        text=text,
        spans=[pneumonia],
        evaluated_at="2026-07-31T12:00:00Z",
    )
    result = result_for(payload, pneumonia["id"])

    assert result["start"] == pneumonia["start"]
    assert result["end"] == pneumonia["end"]
    assert text[result["start"] : result["end"]] == "pneumonia"  # type: ignore[index]
    assert result["section"]["label"] == "assessment"  # type: ignore[index]
    assert payload["evaluated_at"] == "2026-07-31T12:00:00Z"


def test_mismatched_span_text_fails_closed():
    text = "Patient has asthma."
    invalid = span(text, "asthma")
    invalid["text"] = "diabetes"

    with pytest.raises(ContextBridgeInputError):
        analyze_clinical_context(text=text, spans=[invalid])
