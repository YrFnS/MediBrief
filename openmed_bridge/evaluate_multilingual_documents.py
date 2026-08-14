"""Evaluate PHI-free multilingual clinical-document extraction contracts.

The evaluator intentionally separates deterministic contract fixtures from
measured runtime predictions. Perfect contract scores prove only that the
corpus, metric, grouping, and threshold plumbing are functioning.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

CONTEXT_AXES = ("polarity", "certainty", "temporality", "experiencer")


@dataclass(frozen=True)
class FactKey:
    kind: str
    text: str
    start: int
    end: int


class EvaluationError(ValueError):
    """Raised when an evaluation input violates the P2 contract."""


def _load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EvaluationError(f"Could not read {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise EvaluationError(f"{path} must contain a JSON object")
    return payload


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise EvaluationError(message)


def _index_cases(payload: dict[str, Any], label: str) -> dict[str, dict[str, Any]]:
    cases = payload.get("cases")
    _require(isinstance(cases, list) and cases, f"{label}.cases must be a non-empty list")
    result: dict[str, dict[str, Any]] = {}
    for index, case in enumerate(cases):
        _require(isinstance(case, dict), f"{label}.cases[{index}] must be an object")
        case_id = case.get("id")
        _require(isinstance(case_id, str) and case_id, f"{label}.cases[{index}].id is required")
        _require(case_id not in result, f"Duplicate {label} case id: {case_id}")
        result[case_id] = case
    return result


def _fact_key(fact: dict[str, Any], label: str) -> FactKey:
    for field in ("kind", "text", "start", "end"):
        _require(field in fact, f"{label}.{field} is required")
    kind = fact["kind"]
    text = fact["text"]
    start = fact["start"]
    end = fact["end"]
    _require(isinstance(kind, str) and kind, f"{label}.kind must be text")
    _require(isinstance(text, str) and text, f"{label}.text must be text")
    _require(isinstance(start, int) and start >= 0, f"{label}.start must be a non-negative integer")
    _require(isinstance(end, int) and end > start, f"{label}.end must be greater than start")
    return FactKey(kind=kind, text=text, start=start, end=end)


def _facts(case: dict[str, Any], label: str) -> dict[FactKey, dict[str, Any]]:
    raw = case.get("facts", [])
    _require(isinstance(raw, list), f"{label}.facts must be a list")
    result: dict[FactKey, dict[str, Any]] = {}
    source_text = case.get("text")
    for index, fact in enumerate(raw):
        _require(isinstance(fact, dict), f"{label}.facts[{index}] must be an object")
        key = _fact_key(fact, f"{label}.facts[{index}]")
        _require(key not in result, f"Duplicate fact in {label}: {key}")
        if isinstance(source_text, str):
            _require(
                source_text[key.start:key.end] == key.text,
                f"{label}.facts[{index}] span does not match source text",
            )
        context = fact.get("context", {})
        _require(isinstance(context, dict), f"{label}.facts[{index}].context must be an object")
        result[key] = fact
    return result


def _list_value(case: dict[str, Any], field: str, label: str) -> list[Any]:
    value = case.get(field, [])
    _require(isinstance(value, list), f"{label}.{field} must be a list")
    return value


def _accuracy(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 1.0


def _error_rate(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def _prf(tp: int, fp: int, fn: int) -> dict[str, float]:
    precision = _accuracy(tp, tp + fp)
    recall = _accuracy(tp, tp + fn)
    f1 = 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def _empty_counts() -> dict[str, int]:
    return {
        "cases": 0,
        "route_correct": 0,
        "fact_tp": 0,
        "fact_fp": 0,
        "fact_fn": 0,
        "context_correct": 0,
        "context_total": 0,
        "date_correct": 0,
        "date_total": 0,
        "quantity_correct": 0,
        "quantity_total": 0,
    }


def _quantity_key(quantity: Any) -> str:
    _require(isinstance(quantity, dict), "quantity entries must be objects")
    return json.dumps(quantity, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _evaluate_group(counts: dict[str, int]) -> dict[str, Any]:
    prf = _prf(counts["fact_tp"], counts["fact_fp"], counts["fact_fn"])
    predicted = counts["fact_tp"] + counts["fact_fp"]
    gold = counts["fact_tp"] + counts["fact_fn"]
    return {
        "cases": counts["cases"],
        "route_accuracy": _accuracy(counts["route_correct"], counts["cases"]),
        "fact_exact": {
            **prf,
            "true_positive": counts["fact_tp"],
            "false_positive": counts["fact_fp"],
            "false_negative": counts["fact_fn"],
        },
        "unsupported_addition_rate": _error_rate(counts["fact_fp"], predicted),
        "omission_rate": _error_rate(counts["fact_fn"], gold),
        "context_axis_accuracy": _accuracy(
            counts["context_correct"], counts["context_total"]
        ),
        "context_axes": {
            "correct": counts["context_correct"],
            "total": counts["context_total"],
        },
        "date_exact_accuracy": _accuracy(counts["date_correct"], counts["date_total"]),
        "dates": {
            "correct": counts["date_correct"],
            "total": counts["date_total"],
        },
        "quantity_exact_accuracy": _accuracy(
            counts["quantity_correct"], counts["quantity_total"]
        ),
        "quantities": {
            "correct": counts["quantity_correct"],
            "total": counts["quantity_total"],
        },
    }


def evaluate(
    gold_payload: dict[str, Any],
    prediction_payload: dict[str, Any],
) -> dict[str, Any]:
    _require(gold_payload.get("phi_free") is True, "Gold corpus must declare phi_free=true")
    _require(prediction_payload.get("phi_free") is True, "Predictions must declare phi_free=true")
    _require(
        gold_payload.get("corpus_id") == prediction_payload.get("corpus_id"),
        "Gold and predictions must use the same corpus_id",
    )

    gold_cases = _index_cases(gold_payload, "gold")
    predicted_cases = _index_cases(prediction_payload, "predictions")
    _require(set(gold_cases) == set(predicted_cases), "Prediction case ids must exactly match gold case ids")

    overall = _empty_counts()
    by_language: dict[str, dict[str, int]] = defaultdict(_empty_counts)
    by_document_type: dict[str, dict[str, int]] = defaultdict(_empty_counts)
    case_reports: list[dict[str, Any]] = []

    for case_id, gold_case in gold_cases.items():
        predicted_case = predicted_cases[case_id]
        language = gold_case.get("language")
        document_type = gold_case.get("document_type")
        _require(isinstance(language, str) and language, f"gold.{case_id}.language is required")
        _require(isinstance(document_type, str) and document_type, f"gold.{case_id}.document_type is required")
        _require(isinstance(gold_case.get("text"), str), f"gold.{case_id}.text is required")

        buckets = (overall, by_language[language], by_document_type[document_type])
        for bucket in buckets:
            bucket["cases"] += 1

        expected_route = gold_case.get("expected_route")
        _require(
            isinstance(expected_route, str) and expected_route,
            f"gold.{case_id}.expected_route is required",
        )
        route_correct = predicted_case.get("predicted_route") == expected_route
        if route_correct:
            for bucket in buckets:
                bucket["route_correct"] += 1

        gold_facts = _facts(gold_case, f"gold.{case_id}")
        predicted_facts = _facts(predicted_case, f"predictions.{case_id}")
        gold_keys = set(gold_facts)
        predicted_keys = set(predicted_facts)
        matched = gold_keys & predicted_keys
        tp = len(matched)
        fp = len(predicted_keys - gold_keys)
        fn = len(gold_keys - predicted_keys)
        for bucket in buckets:
            bucket["fact_tp"] += tp
            bucket["fact_fp"] += fp
            bucket["fact_fn"] += fn

        context_correct = 0
        context_total = 0
        for key in matched:
            gold_context = gold_facts[key].get("context", {})
            predicted_context = predicted_facts[key].get("context", {})
            for axis in CONTEXT_AXES:
                if axis in gold_context:
                    context_total += 1
                    if predicted_context.get(axis) == gold_context.get(axis):
                        context_correct += 1
        for bucket in buckets:
            bucket["context_correct"] += context_correct
            bucket["context_total"] += context_total

        gold_dates = _list_value(gold_case, "dates", f"gold.{case_id}")
        predicted_dates = _list_value(predicted_case, "dates", f"predictions.{case_id}")
        date_total = max(len(gold_dates), len(predicted_dates))
        date_correct = len(set(gold_dates) & set(predicted_dates))
        for bucket in buckets:
            bucket["date_correct"] += date_correct
            bucket["date_total"] += date_total

        gold_quantities = {
            _quantity_key(item) for item in _list_value(
                gold_case, "quantities", f"gold.{case_id}"
            )
        }
        predicted_quantities = {
            _quantity_key(item) for item in _list_value(
                predicted_case, "quantities", f"predictions.{case_id}"
            )
        }
        quantity_total = max(len(gold_quantities), len(predicted_quantities))
        quantity_correct = len(gold_quantities & predicted_quantities)
        for bucket in buckets:
            bucket["quantity_correct"] += quantity_correct
            bucket["quantity_total"] += quantity_total

        case_reports.append({
            "id": case_id,
            "language": language,
            "document_type": document_type,
            "route_correct": route_correct,
            "fact_true_positive": tp,
            "fact_false_positive": fp,
            "fact_false_negative": fn,
            "context_correct": context_correct,
            "context_total": context_total,
            "date_correct": date_correct,
            "date_total": date_total,
            "quantity_correct": quantity_correct,
            "quantity_total": quantity_total,
        })

    return {
        "schema_version": "1",
        "corpus_id": gold_payload.get("corpus_id"),
        "prediction_source": prediction_payload.get("prediction_source"),
        "engine": prediction_payload.get("engine"),
        "engine_version": prediction_payload.get("engine_version"),
        "phi_free": True,
        "overall": _evaluate_group(overall),
        "by_language": {
            key: _evaluate_group(value)
            for key, value in sorted(by_language.items())
        },
        "by_document_type": {
            key: _evaluate_group(value)
            for key, value in sorted(by_document_type.items())
        },
        "cases": case_reports,
        "application_route_changed": False,
        "clinical_validation_established": False,
    }


def _threshold_failures(report: dict[str, Any], args: argparse.Namespace) -> list[str]:
    overall = report["overall"]
    checks = {
        "route_accuracy": (overall["route_accuracy"], args.min_route_accuracy),
        "fact_exact_f1": (overall["fact_exact"]["f1"], args.min_fact_f1),
        "context_axis_accuracy": (
            overall["context_axis_accuracy"], args.min_context_accuracy
        ),
        "date_exact_accuracy": (
            overall["date_exact_accuracy"], args.min_date_accuracy
        ),
        "quantity_exact_accuracy": (
            overall["quantity_exact_accuracy"], args.min_quantity_accuracy
        ),
    }
    failures = [
        f"{name}={actual:.4f} is below {minimum:.4f}"
        for name, (actual, minimum) in checks.items()
        if actual < minimum
    ]
    if overall["unsupported_addition_rate"] > args.max_unsupported_addition_rate:
        failures.append(
            "unsupported_addition_rate="
            f"{overall['unsupported_addition_rate']:.4f} exceeds "
            f"{args.max_unsupported_addition_rate:.4f}"
        )
    if overall["omission_rate"] > args.max_omission_rate:
        failures.append(
            f"omission_rate={overall['omission_rate']:.4f} exceeds "
            f"{args.max_omission_rate:.4f}"
        )
    return failures


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-contract-fixture", action="store_true")
    parser.add_argument("--require-measured-predictions", action="store_true")
    parser.add_argument("--min-route-accuracy", type=float, default=1.0)
    parser.add_argument("--min-fact-f1", type=float, default=1.0)
    parser.add_argument("--min-context-accuracy", type=float, default=1.0)
    parser.add_argument("--min-date-accuracy", type=float, default=1.0)
    parser.add_argument("--min-quantity-accuracy", type=float, default=1.0)
    parser.add_argument("--max-unsupported-addition-rate", type=float, default=0.0)
    parser.add_argument("--max-omission-rate", type=float, default=0.0)
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    gold = _load_json(args.gold)
    predictions = _load_json(args.predictions)
    source = predictions.get("prediction_source")
    if not isinstance(source, str) or not source:
        raise EvaluationError("Predictions must name a non-empty prediction_source")
    if args.require_contract_fixture and source != "deterministic-contract-fixture":
        raise EvaluationError(
            "The validation gate requires prediction_source=deterministic-contract-fixture"
        )
    if args.require_measured_predictions and source == "deterministic-contract-fixture":
        raise EvaluationError(
            "Measured evaluation cannot use a deterministic contract fixture"
        )
    if args.require_measured_predictions:
        engine = predictions.get("engine")
        engine_version = predictions.get("engine_version")
        captured_at = predictions.get("captured_at")
        if not all(isinstance(value, str) and value.strip() for value in (
            engine, engine_version, captured_at,
        )):
            raise EvaluationError(
                "Measured predictions must name engine, engine_version, and captured_at"
            )
    report = evaluate(gold, predictions)
    failures = _threshold_failures(report, args)
    report["thresholds_passed"] = not failures
    report["threshold_failures"] = failures
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
