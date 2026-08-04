from __future__ import annotations

from openmed_bridge.evaluate_context import evaluate_context_cases


def test_synthetic_english_context_corpus_meets_slice_two_gate():
    report = evaluate_context_cases()

    assert report["phi_free"] is True
    assert report["assertion_cases"] >= 6
    assert report["axis_accuracy"] == 1.0
    assert report["exact_case_accuracy"] == 1.0
    assert report["medication_sig_field_accuracy"] == 1.0
