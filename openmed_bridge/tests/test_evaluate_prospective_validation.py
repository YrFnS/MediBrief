from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest

from openmed_bridge.evaluate_prospective_validation import (
    CONTRACT_EVIDENCE,
    MEASURED_EVIDENCE,
    ProspectiveValidationError,
    evaluate,
    main,
)

ROOT = Path(__file__).resolve().parents[2]
P3 = ROOT / "evaluation" / "p3"


def load(name: str):
    return json.loads((P3 / name).read_text(encoding="utf-8"))


def contract_inputs():
    return (
        load("protocol_contract_fixture.json"),
        load("runtime_results_contract_fixture.json"),
        load("clinician_reviews_contract_fixture.json"),
        load("release_policy_contract_fixture.json"),
    )


def measured_inputs():
    protocol, results, reviews, policy = copy.deepcopy(contract_inputs())

    protocol["evidence_class"] = MEASURED_EVIDENCE
    protocol["dataset"]["gold_labels"].update({
        "clinician_authored": True,
        "author_count": 2,
        "independent_annotation": True,
        "adjudication_complete": True,
        "version": "clinician-gold-v1.0.0",
    })
    protocol["approvals"] = {
        "clinical_owner": True,
        "statistical_owner": True,
        "engineering_owner": True,
    }
    for index, configuration in enumerate(
        protocol["runtime_configurations"],
        start=1,
    ):
        configuration["provider"] = "measured-provider"
        configuration["model_or_engine"] = f"locked-runtime-{index}"
        configuration["version"] = "2.0.0"
        configuration["source_revision"] = f"commit-{index:02d}"

    results["evidence_class"] = MEASURED_EVIDENCE
    for index, result in enumerate(results["results"], start=1):
        result["source_hash"] = (
            "sha256:"
            + hashlib.sha256(f"source-{index}".encode()).hexdigest()
        )
        result["prediction_hash"] = (
            "sha256:"
            + hashlib.sha256(f"prediction-{index}".encode()).hexdigest()
        )

    reviews["evidence_class"] = MEASURED_EVIDENCE
    for review in reviews["reviews"]:
        review["role"] = "clinician"
        review["credential_verified"] = True

    policy["policy_class"] = "approved-release-policy"
    policy["approvals"] = {
        "clinical_owner": True,
        "statistical_owner": True,
        "engineering_owner": True,
    }
    return protocol, results, reviews, policy


def test_contract_fixture_validates_plumbing_without_release_claim():
    protocol, results, reviews, policy = contract_inputs()
    report = evaluate(protocol, results, reviews, policy)

    assert report["evidence_class"] == CONTRACT_EVIDENCE
    assert report["decision"] == "contract-only"
    assert report["contract_valid"] is True
    assert report["measured_release_applicable"] is False
    assert report["route_change_authorized"] is False
    assert report["clinical_validation_established"] is False
    assert report["medication_safety_enabled"] is False
    assert report["coverage"]["total_cases"] == 7
    assert set(report["metrics"]["by_document_type"]) == {
        "clinical-note",
        "discharge-summary",
        "imaging-report",
        "laboratory-report",
        "medication-list",
        "poor-quality-scan",
        "prescription",
    }
    assert report["clinician_review"]["review_completion_rate"] == 1.0
    assert report["clinician_review"]["safety_agreement_rate"] == 1.0


def test_fully_governed_measured_fixture_can_only_be_engineering_candidate():
    protocol, results, reviews, policy = measured_inputs()
    report = evaluate(protocol, results, reviews, policy)

    assert report["evidence_class"] == MEASURED_EVIDENCE
    assert report["policy_class"] == "approved-release-policy"
    assert report["decision"] == "engineering-release-candidate"
    assert report["failed_release_gate_ids"] == []
    assert report["route_change_authorized"] is False
    assert report["clinical_validation_established"] is False
    assert report["medication_safety_enabled"] is False


def test_critical_error_forces_stop_ship():
    protocol, results, reviews, policy = measured_inputs()
    results["results"][0]["critical_errors"] = [
        {"id": "critical-1", "code": "UNSUPPORTED_MEDICATION_ADDITION"}
    ]

    report = evaluate(protocol, results, reviews, policy)

    assert report["decision"] == "stop-ship"
    assert "zero_tolerance.critical_error_count" in report[
        "failed_release_gate_ids"
    ]


def test_unadjudicated_safety_disagreement_forces_stop_ship():
    protocol, results, reviews, policy = measured_inputs()
    target = results["results"][0]["result_id"]
    changed = False
    for review in reviews["reviews"]:
        if review["result_id"] == target and not changed:
            review["verdict"] = "unsafe"
            changed = True

    report = evaluate(protocol, results, reviews, policy)

    assert report["decision"] == "stop-ship"
    assert target in report["clinician_review"][
        "unadjudicated_disagreement_result_ids"
    ]
    assert "review.safety_agreement_rate" in report[
        "failed_release_gate_ids"
    ]
    assert "review.unadjudicated_disagreements" in report[
        "failed_release_gate_ids"
    ]


def test_measured_runtime_must_be_locked_and_versioned():
    protocol, results, reviews, policy = measured_inputs()
    protocol["runtime_configurations"][0]["version"] = "latest"

    with pytest.raises(
        ProspectiveValidationError,
        match="version must be explicit",
    ):
        evaluate(protocol, results, reviews, policy)


def test_derived_evidence_rejects_raw_source_text():
    protocol, results, reviews, policy = contract_inputs()
    results["results"][0]["raw_text"] = "Synthetic but forbidden"

    with pytest.raises(
        ProspectiveValidationError,
        match="must not contain raw patient/source fields",
    ):
        evaluate(protocol, results, reviews, policy)


def test_cli_contract_requirement_passes_and_measured_requirement_fails(tmp_path):
    report_path = tmp_path / "report.json"
    common = [
        "--protocol", str(P3 / "protocol_contract_fixture.json"),
        "--results", str(P3 / "runtime_results_contract_fixture.json"),
        "--reviews", str(P3 / "clinician_reviews_contract_fixture.json"),
        "--policy", str(P3 / "release_policy_contract_fixture.json"),
        "--output", str(report_path),
    ]

    assert main([*common, "--require-contract-fixture"]) == 0
    assert report_path.exists()
    assert main([*common, "--require-measured-evidence"]) == 1
