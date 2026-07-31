from __future__ import annotations

import json
from pathlib import Path

import pytest

from openmed_bridge.evaluate_extraction import (
    EvaluationInputError,
    Entity,
    NerCase,
    OcrCase,
    OcrPage,
    evaluate_all,
    evaluate_ner,
    evaluate_ocr,
    load_ner_gold,
    validate_blocked_corpus,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
EVALUATION_ROOT = REPO_ROOT / "evaluation" / "phase3"


def test_reference_fixtures_validate_metric_contracts_without_claiming_model_accuracy():
    report = evaluate_all(
        ner_gold_path=EVALUATION_ROOT / "clinical_ner_en_gold.json",
        ner_predictions_path=(
            EVALUATION_ROOT / "clinical_ner_en_reference_predictions.json"
        ),
        ocr_gold_path=EVALUATION_ROOT / "ocr_gold.json",
        ocr_predictions_path=EVALUATION_ROOT / "ocr_reference_predictions.json",
        blocked_ner_gold_path=EVALUATION_ROOT / "clinical_ner_ar_gold.json",
    )

    assert report["ner"]["evidence_class"] == "contract-fixture"
    assert report["ner"]["exact_span"]["f1"] == 1.0
    assert report["ner"]["relaxed_overlap"]["f1"] == 1.0
    assert report["ner"]["exact_case_accuracy"] == 1.0
    assert report["ocr"]["evidence_class"] == "contract-fixture"
    assert report["ocr"]["character_error_rate"] == 0.0
    assert report["ocr"]["word_error_rate"] == 0.0
    assert report["ocr"]["page_text_accuracy"] == 1.0
    assert report["blocked_language_corpus"] == {
        "corpus_id": "medibrief-phase3-clinical-ner-ar-v1",
        "language": "ar",
        "phi_free": True,
        "acceptance_status": "route-blocked-pending-measurement",
        "cases": 6,
        "gold_entities": 10,
        "prediction_evidence": "not-provided",
        "route_decision": "blocked-pending-measurement",
        "limitations": report["blocked_language_corpus"]["limitations"],
    }


def test_ner_metrics_penalize_missed_and_extra_valid_spans():
    text = "Asthma treated with albuterol."
    gold = (
        NerCase(
            case_id="case-1",
            text=text,
            entities=(
                Entity("condition", "Asthma", 0, 6),
                Entity("medication", "albuterol", 20, 29),
            ),
        ),
    )
    predictions = {
        "case-1": (
            Entity("condition", "Asthma", 0, 6, confidence=0.9),
            Entity("condition", "treated", 7, 14, confidence=0.7),
        )
    }

    report = evaluate_ner(
        {"corpus_id": "unit", "language": "en", "phi_free": True},
        gold,
        {
            "prediction_source": "openmed-live",
            "model": "synthetic-unit-model",
        },
        predictions,
    )

    assert report["evidence_class"] == "measured-runtime-output"
    assert report["exact_span"]["true_positive"] == 1
    assert report["exact_span"]["false_positive"] == 1
    assert report["exact_span"]["false_negative"] == 1
    assert report["exact_span"]["precision"] == 0.5
    assert report["exact_span"]["recall"] == 0.5
    assert report["exact_span"]["f1"] == 0.5
    assert report["exact_case_accuracy"] == 0.0


def test_ocr_metrics_report_character_word_and_page_errors():
    gold = (
        OcrCase(
            case_id="ocr-1",
            language="en",
            reference_text="Asthma stable",
            pages=(OcrPage(1, 0, 13, "Asthma stable"),),
        ),
    )
    predictions = {
        "ocr-1": (
            "Astma stable",
            (OcrPage(1, 0, 12, "Astma stable"),),
        )
    }

    report = evaluate_ocr(
        {"corpus_id": "ocr-unit", "phi_free": True},
        gold,
        {"prediction_source": "tesseract-live", "engine": "tesseract"},
        predictions,
    )

    assert report["evidence_class"] == "measured-runtime-output"
    assert report["character_error_rate"] == pytest.approx(1 / 13)
    assert report["word_error_rate"] == 0.5
    assert report["exact_text_accuracy"] == 0.0
    assert report["page_text_accuracy"] == 0.0
    assert report["languages"]["en"]["character_error_rate"] == pytest.approx(
        1 / 13
    )


def test_invalid_gold_offsets_fail_closed(tmp_path: Path):
    path = tmp_path / "invalid.json"
    path.write_text(
        json.dumps(
            {
                "cases": [
                    {
                        "id": "bad",
                        "text": "Asthma",
                        "entities": [
                            {
                                "kind": "condition",
                                "text": "Asthma",
                                "start": 0,
                                "end": 99,
                            }
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(EvaluationInputError, match="invalid source interval"):
        load_ner_gold(path)


def test_arabic_corpus_stays_blocked_without_prediction_evidence():
    report = validate_blocked_corpus(
        EVALUATION_ROOT / "clinical_ner_ar_gold.json"
    )

    assert report["language"] == "ar"
    assert report["cases"] == 6
    assert report["gold_entities"] == 10
    assert report["prediction_evidence"] == "not-provided"
    assert report["route_decision"] == "blocked-pending-measurement"
