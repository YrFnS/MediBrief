from __future__ import annotations

import json
from pathlib import Path

import pytest

from openmed_bridge.compare_ner_predictions import (
    ComparisonInputError,
    compare_ner_prediction_files,
    comparison_is_fully_measured,
    parse_provider_spec,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
EVALUATION_ROOT = REPO_ROOT / "evaluation" / "phase3"


def test_contract_fixtures_are_scored_separately_without_selecting_a_winner():
    report = compare_ner_prediction_files(
        gold_path=EVALUATION_ROOT / "clinical_ner_en_gold.json",
        providers={
            "openmed": (
                EVALUATION_ROOT / "clinical_ner_en_reference_predictions.json"
            ),
            "gemini": (
                EVALUATION_ROOT
                / "clinical_ner_en_gemini_reference_predictions.json"
            ),
        },
    )

    assert report["comparison_evidence"] == "contract-only"
    assert report["merged_predictions"] is False
    assert report["winner_selected"] is False
    assert report["application_route_changed"] is False
    assert set(report["providers"]) == {"openmed", "gemini"}
    assert report["providers"]["openmed"]["model"] == "reference-exact-spans"
    assert (
        report["providers"]["gemini"]["model"]
        == "gemini-reference-exact-spans"
    )
    assert report["providers"]["openmed"]["evaluation"]["exact_span"]["f1"] == 1.0
    assert report["providers"]["gemini"]["evaluation"]["exact_span"]["f1"] == 1.0
    assert comparison_is_fully_measured(report) is False


def test_measured_provider_files_remain_independent(tmp_path: Path):
    gold = {
        "corpus_id": "comparison-unit",
        "language": "en",
        "phi_free": True,
        "cases": [
            {
                "id": "case-1",
                "text": "Asthma treated with albuterol.",
                "entities": [
                    {
                        "kind": "condition",
                        "text": "Asthma",
                        "start": 0,
                        "end": 6,
                    },
                    {
                        "kind": "medication",
                        "text": "albuterol",
                        "start": 20,
                        "end": 29,
                    },
                ],
            }
        ],
    }
    openmed = {
        "corpus_id": "comparison-unit",
        "prediction_source": "openmed-live",
        "model": "openmed-test-model",
        "cases": [
            {
                "id": "case-1",
                "entities": [
                    {
                        "kind": "condition",
                        "text": "Asthma",
                        "start": 0,
                        "end": 6,
                        "confidence": 0.9,
                    }
                ],
            }
        ],
    }
    gemini = {
        "corpus_id": "comparison-unit",
        "prediction_source": "gemini-live",
        "model": "gemini-test-model",
        "cases": [
            {
                "id": "case-1",
                "entities": [
                    {
                        "kind": "medication",
                        "text": "albuterol",
                        "start": 20,
                        "end": 29,
                        "confidence": 0.8,
                    }
                ],
            }
        ],
    }

    gold_path = tmp_path / "gold.json"
    openmed_path = tmp_path / "openmed.json"
    gemini_path = tmp_path / "gemini.json"
    gold_path.write_text(json.dumps(gold), encoding="utf-8")
    openmed_path.write_text(json.dumps(openmed), encoding="utf-8")
    gemini_path.write_text(json.dumps(gemini), encoding="utf-8")

    report = compare_ner_prediction_files(
        gold_path=gold_path,
        providers={"openmed": openmed_path, "gemini": gemini_path},
    )

    assert comparison_is_fully_measured(report) is True
    assert report["providers"]["openmed"]["evaluation"]["exact_span"]["recall"] == 0.5
    assert report["providers"]["gemini"]["evaluation"]["exact_span"]["recall"] == 0.5
    assert report["providers"]["openmed"]["prediction_source"] == "openmed-live"
    assert report["providers"]["gemini"]["prediction_source"] == "gemini-live"
    assert report["merged_predictions"] is False


def test_comparison_rejects_a_prediction_file_for_another_corpus(tmp_path: Path):
    prediction = json.loads(
        (
            EVALUATION_ROOT / "clinical_ner_en_reference_predictions.json"
        ).read_text(encoding="utf-8")
    )
    prediction["corpus_id"] = "wrong-corpus"
    wrong_path = tmp_path / "wrong.json"
    wrong_path.write_text(json.dumps(prediction), encoding="utf-8")

    with pytest.raises(ComparisonInputError, match="not 'medibrief-phase3"):
        compare_ner_prediction_files(
            gold_path=EVALUATION_ROOT / "clinical_ner_en_gold.json",
            providers={
                "openmed": wrong_path,
                "gemini": (
                    EVALUATION_ROOT
                    / "clinical_ner_en_gemini_reference_predictions.json"
                ),
            },
        )


def test_provider_spec_requires_an_explicit_name_and_path():
    assert parse_provider_spec("OpenMed=predictions/openmed.json") == (
        "OpenMed",
        Path("predictions/openmed.json"),
    )
    with pytest.raises(ComparisonInputError, match="NAME=PATH"):
        parse_provider_spec("predictions.json")
    with pytest.raises(ComparisonInputError, match="missing a prediction path"):
        parse_provider_spec("Gemini=")
