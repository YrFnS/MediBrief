import json
from pathlib import Path

import pytest

from openmed_bridge.evaluate_multilingual_documents import (
    EvaluationError,
    evaluate,
    main,
)

ROOT = Path(__file__).resolve().parents[2]
GOLD = ROOT / "evaluation/p2/multilingual_clinical_documents_gold.json"
PREDICTIONS = ROOT / "evaluation/p2/multilingual_contract_predictions.json"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_contract_fixture_scores_every_supported_dimension():
    report = evaluate(load(GOLD), load(PREDICTIONS))

    assert report["overall"]["route_accuracy"] == 1.0
    assert report["overall"]["fact_exact"]["f1"] == 1.0
    assert report["overall"]["context_axis_accuracy"] == 1.0
    assert report["overall"]["date_exact_accuracy"] == 1.0
    assert report["overall"]["quantity_exact_accuracy"] == 1.0
    assert set(report["by_language"]) == {"ar", "en", "mixed"}
    assert "poor-quality-scan" in report["by_document_type"]
    assert report["application_route_changed"] is False
    assert report["clinical_validation_established"] is False


def test_missing_case_fails_closed():
    predictions = load(PREDICTIONS)
    predictions["cases"].pop()

    with pytest.raises(EvaluationError, match="case ids"):
        evaluate(load(GOLD), predictions)


def test_contract_fixture_cannot_be_reported_as_measured():
    with pytest.raises(EvaluationError, match="Measured evaluation"):
        main([
            "--gold", str(GOLD),
            "--predictions", str(PREDICTIONS),
            "--require-measured-predictions",
        ])


def test_false_addition_fails_zero_tolerance_gate(tmp_path: Path):
    predictions = load(PREDICTIONS)
    predictions["cases"][0]["facts"].append({
        "kind": "condition",
        "text": "Discharge",
        "start": 0,
        "end": 9,
        "context": {
            "polarity": "affirmed",
            "certainty": "certain",
            "temporality": "current",
            "experiencer": "patient",
        },
    })
    path = tmp_path / "predictions.json"
    path.write_text(json.dumps(predictions), encoding="utf-8")

    assert main([
        "--gold", str(GOLD),
        "--predictions", str(path),
        "--min-fact-f1", "0",
        "--min-route-accuracy", "0",
        "--min-context-accuracy", "0",
        "--min-date-accuracy", "0",
        "--min-quantity-accuracy", "0",
        "--max-unsupported-addition-rate", "0",
        "--max-omission-rate", "1",
    ]) == 1
