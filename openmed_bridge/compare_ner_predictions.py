"""Compare provider NER prediction files without merging clinical evidence.

The comparison consumes one PHI-free gold corpus and two or more prediction
files that already conform to :mod:`openmed_bridge.evaluate_extraction`.
Every provider is evaluated independently. The report never unions spans,
chooses a winner, changes the application route, or converts contract fixtures
into claims about real model accuracy.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Mapping

from .evaluate_extraction import (
    EvaluationInputError,
    evaluate_ner,
    load_ner_gold,
    load_ner_predictions,
)


class ComparisonInputError(ValueError):
    """Raised when provider comparison arguments are ambiguous or unsafe."""


def _provider_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ComparisonInputError("provider name must not be blank")
    if any(character in normalized for character in "\r\n\t"):
        raise ComparisonInputError("provider name must be a single-line label")
    return normalized


def parse_provider_spec(value: str) -> tuple[str, Path]:
    """Parse ``NAME=PATH`` while preserving path separators and spaces."""

    if "=" not in value:
        raise ComparisonInputError(
            "provider specification must use NAME=PATH"
        )
    raw_name, raw_path = value.split("=", 1)
    name = _provider_name(raw_name)
    path_text = raw_path.strip()
    if not path_text:
        raise ComparisonInputError(f"provider {name!r} is missing a prediction path")
    return name, Path(path_text)


def compare_ner_prediction_files(
    *,
    gold_path: str | Path,
    providers: Mapping[str, str | Path],
) -> dict[str, Any]:
    """Evaluate each provider independently against the same gold corpus."""

    if len(providers) < 2:
        raise ComparisonInputError("at least two provider prediction files are required")

    gold_payload, gold_cases = load_ner_gold(gold_path)
    corpus_id = gold_payload.get("corpus_id")
    provider_reports: dict[str, Any] = {}

    for raw_name, prediction_path in providers.items():
        name = _provider_name(raw_name)
        if name in provider_reports:
            raise ComparisonInputError(f"duplicate provider name: {name}")

        prediction_payload, predictions = load_ner_predictions(
            prediction_path,
            gold_cases,
        )
        prediction_corpus_id = prediction_payload.get("corpus_id")
        if (
            corpus_id is not None
            and prediction_corpus_id is not None
            and prediction_corpus_id != corpus_id
        ):
            raise ComparisonInputError(
                f"provider {name!r} targets corpus {prediction_corpus_id!r}, "
                f"not {corpus_id!r}"
            )

        evaluation = evaluate_ner(
            gold_payload,
            gold_cases,
            prediction_payload,
            predictions,
        )
        provider_reports[name] = {
            "provider": name,
            "prediction_source": prediction_payload.get("prediction_source"),
            "model": prediction_payload.get("model"),
            "evidence_class": evaluation["evidence_class"],
            "evaluation": evaluation,
        }

    measured = all(
        report["evidence_class"] == "measured-runtime-output"
        for report in provider_reports.values()
    )

    return {
        "schema_version": "1",
        "comparison": "medibrief-phase3-provider-ner",
        "corpus_id": corpus_id,
        "language": gold_payload.get("language"),
        "phi_free": bool(gold_payload.get("phi_free")),
        "comparison_evidence": (
            "measured-runtime-output" if measured else "contract-only"
        ),
        "providers": provider_reports,
        "merged_predictions": False,
        "winner_selected": False,
        "application_route_changed": False,
        "interpretation": [
            "Each provider is scored independently against the same gold spans.",
            "Provider spans are never merged into one clinical assertion set.",
            "Contract fixtures validate comparison plumbing only and are not model accuracy.",
            "Measured outputs remain specific to the named model, threshold, service, and corpus.",
            "All application extraction output remains candidate-only and requires source review.",
        ],
    }


def comparison_is_fully_measured(report: Mapping[str, Any]) -> bool:
    return report.get("comparison_evidence") == "measured-runtime-output"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", required=True)
    parser.add_argument(
        "--provider",
        action="append",
        required=True,
        metavar="NAME=PATH",
        help="Repeat for each independently captured provider prediction file.",
    )
    parser.add_argument("--require-measured-predictions", action="store_true")
    parser.add_argument("--output")
    args = parser.parse_args()

    try:
        providers: dict[str, Path] = {}
        for raw_spec in args.provider:
            name, path = parse_provider_spec(raw_spec)
            if name in providers:
                raise ComparisonInputError(f"duplicate provider name: {name}")
            providers[name] = path
        report = compare_ner_prediction_files(
            gold_path=args.gold,
            providers=providers,
        )
    except (ComparisonInputError, EvaluationInputError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2))
        return 2

    rendered = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    print(rendered)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")

    if args.require_measured_predictions and not comparison_is_fully_measured(report):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
