"""Synthetic, PHI-free evaluation for the MediBrief OpenMed context bridge."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from .context_service import analyze_clinical_context


@dataclass(frozen=True)
class AssertionCase:
    name: str
    text: str
    surface: str
    expected: dict[str, str]


ASSERTION_CASES = (
    AssertionCase(
        name="explicit-negation",
        text="No evidence of pneumonia.",
        surface="pneumonia",
        expected={
            "polarity": "negated",
            "certainty": "certain",
            "temporality": "recent",
            "experiencer": "patient",
        },
    ),
    AssertionCase(
        name="uncertainty",
        text="Possible pneumonia.",
        surface="pneumonia",
        expected={
            "polarity": "affirmed",
            "certainty": "uncertain",
            "temporality": "recent",
            "experiencer": "patient",
        },
    ),
    AssertionCase(
        name="historical",
        text="Past Medical History:\nHistory of asthma.",
        surface="asthma",
        expected={
            "polarity": "affirmed",
            "certainty": "certain",
            "temporality": "historical",
            "experiencer": "patient",
        },
    ),
    AssertionCase(
        name="hypothetical",
        text="If wheezing occurs, use the rescue inhaler.",
        surface="wheezing",
        expected={
            "polarity": "affirmed",
            "certainty": "uncertain",
            "temporality": "hypothetical",
            "experiencer": "patient",
        },
    ),
    AssertionCase(
        name="family-experiencer",
        text="Family History:\nMother has diabetes.",
        surface="diabetes",
        expected={
            "polarity": "affirmed",
            "certainty": "certain",
            "temporality": "recent",
            "experiencer": "family",
        },
    ),
    AssertionCase(
        name="pseudo-negation",
        text="Pneumonia not ruled out.",
        surface="Pneumonia",
        expected={
            "polarity": "affirmed",
            "certainty": "uncertain",
            "temporality": "recent",
            "experiencer": "patient",
        },
    ),
)


def _span(text: str, surface: str, *, kind: str = "condition") -> dict[str, object]:
    start = text.index(surface)
    return {
        "id": f"{kind}-{start}",
        "kind": kind,
        "text": surface,
        "label": surface,
        "start": start,
        "end": start + len(surface),
    }


def evaluate_context_cases() -> dict[str, Any]:
    axis_total = 0
    axis_correct = 0
    exact_correct = 0
    cases: list[dict[str, Any]] = []

    for case in ASSERTION_CASES:
        result = analyze_clinical_context(
            text=case.text,
            spans=[_span(case.text, case.surface)],
            evaluated_at="2026-07-31T12:00:00Z",
        )["results"][0]
        predicted = result["assertion"]
        per_axis = {
            axis: predicted[axis] == expected
            for axis, expected in case.expected.items()
        }
        correct = sum(per_axis.values())
        axis_total += len(per_axis)
        axis_correct += correct
        exact = correct == len(per_axis)
        exact_correct += int(exact)
        cases.append(
            {
                "name": case.name,
                "expected": case.expected,
                "predicted": predicted,
                "per_axis": per_axis,
                "exact": exact,
            }
        )

    medication_text = "Metformin 500 mg PO BID for 7 days."
    medication_result = analyze_clinical_context(
        text=medication_text,
        spans=[_span(medication_text, "Metformin", kind="medication")],
        evaluated_at="2026-07-31T12:00:00Z",
    )["results"][0]
    sig = medication_result.get("medication_sig") or {}
    sig_expected = {
        "dose": 500.0,
        "unit": "mg",
        "route": "oral",
        "frequency_per_day": 2.0,
        "duration_days": 7,
    }
    sig_fields = {
        field: sig.get(field) == expected
        for field, expected in sig_expected.items()
    }

    return {
        "corpus": "synthetic-english-context-v1",
        "phi_free": True,
        "assertion_cases": len(ASSERTION_CASES),
        "axis_total": axis_total,
        "axis_correct": axis_correct,
        "axis_accuracy": axis_correct / axis_total if axis_total else 0.0,
        "exact_case_accuracy": exact_correct / len(ASSERTION_CASES),
        "medication_sig_field_accuracy": (
            sum(sig_fields.values()) / len(sig_fields)
            if sig_fields
            else 0.0
        ),
        "medication_sig_fields": sig_fields,
        "cases": cases,
        "limitations": [
            "Synthetic English examples only.",
            "Does not estimate performance on real clinical documents.",
            "Does not validate Arabic or other language packs.",
            "Outputs remain advisory candidates requiring human review.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--minimum-axis-accuracy", type=float, default=1.0)
    parser.add_argument("--minimum-exact-case-accuracy", type=float, default=1.0)
    parser.add_argument("--minimum-medication-sig-accuracy", type=float, default=1.0)
    args = parser.parse_args()

    report = evaluate_context_cases()
    print(json.dumps(report, indent=2, sort_keys=True))

    if report["axis_accuracy"] < args.minimum_axis_accuracy:
        return 1
    if report["exact_case_accuracy"] < args.minimum_exact_case_accuracy:
        return 1
    if report["medication_sig_field_accuracy"] < args.minimum_medication_sig_accuracy:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
