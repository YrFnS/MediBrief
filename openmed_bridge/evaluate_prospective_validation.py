"""Fail-closed prospective validation gate for MediBrief P3.

This module evaluates derived, case-level engineering evidence. It never reads
or emits source clinical documents. A passing report can identify an
engineering release candidate for a locked extraction configuration, but it
never authorizes an application route change or establishes clinical
validation.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

SCHEMA_VERSION = "1"
CONTRACT_EVIDENCE = "contract-fixture"
MEASURED_EVIDENCE = "measured-prospective-run"
EVIDENCE_CLASSES = frozenset({CONTRACT_EVIDENCE, MEASURED_EVIDENCE})

TASK_EXTRACTION = "document-fact-extraction"
TASK_OCR = "ocr"
TASK_MEDICATION = "medication-reconciliation"
TASKS = frozenset({TASK_EXTRACTION, TASK_OCR, TASK_MEDICATION})

DOCUMENT_TYPES = frozenset(
    {
        "discharge-summary",
        "laboratory-report",
        "medication-list",
        "prescription",
        "imaging-report",
        "clinical-note",
        "poor-quality-scan",
    }
)
RISK_LEVELS = frozenset({"standard", "high", "boundary"})
VERDICTS = frozenset(
    {"acceptable", "minor-correction", "major-correction", "unsafe"}
)
SAFETY_ACCEPTABLE = frozenset({"acceptable", "minor-correction"})
FORBIDDEN_DERIVED_KEYS = frozenset(
    {
        "raw_text",
        "source_text",
        "patient_name",
        "patient_identifier",
        "medical_record_number",
        "mrn",
        "date_of_birth",
        "dob",
        "street_address",
        "phone_number",
        "email_address",
    }
)
SHA256_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
PLACEHOLDER_VERSIONS = frozenset(
    {"unknown", "latest", "unversioned", "development", "dev", "n/a"}
)


class ProspectiveValidationError(ValueError):
    """Raised when P3 evidence violates its validation contract."""


def _load_json(path: str | Path) -> dict[str, Any]:
    source = Path(path)
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ProspectiveValidationError(
            f"Could not read {source}: {exc}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise ProspectiveValidationError(
            f"Invalid JSON in {source}: {exc}"
        ) from exc
    if not isinstance(payload, dict):
        raise ProspectiveValidationError(
            f"{source} must contain a JSON object"
        )
    return payload


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ProspectiveValidationError(message)


def _required_string(value: object, field: str) -> str:
    _require(
        isinstance(value, str) and bool(value.strip()),
        f"{field} must be a non-empty string",
    )
    return str(value).strip()


def _required_bool(value: object, field: str) -> bool:
    _require(isinstance(value, bool), f"{field} must be boolean")
    return bool(value)


def _required_int(
    value: object,
    field: str,
    *,
    minimum: int = 0,
) -> int:
    _require(
        isinstance(value, int)
        and not isinstance(value, bool)
        and value >= minimum,
        f"{field} must be an integer >= {minimum}",
    )
    return int(value)


def _required_number(
    value: object,
    field: str,
    *,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    _require(
        isinstance(value, (int, float)) and not isinstance(value, bool),
        f"{field} must be numeric",
    )
    result = float(value)
    if minimum is not None:
        _require(result >= minimum, f"{field} must be >= {minimum}")
    if maximum is not None:
        _require(result <= maximum, f"{field} must be <= {maximum}")
    return result


def _required_mapping(value: object, field: str) -> dict[str, Any]:
    _require(isinstance(value, dict), f"{field} must be an object")
    return dict(value)


def _required_list(value: object, field: str) -> list[Any]:
    _require(isinstance(value, list), f"{field} must be a list")
    return list(value)


def _required_string_list(
    value: object,
    field: str,
    *,
    allow_empty: bool = False,
) -> list[str]:
    raw = _required_list(value, field)
    if not allow_empty:
        _require(bool(raw), f"{field} must not be empty")
    result: list[str] = []
    for index, item in enumerate(raw):
        result.append(_required_string(item, f"{field}[{index}]"))
    _require(len(set(result)) == len(result), f"{field} contains duplicates")
    return result


def _require_sha256(value: object, field: str) -> str:
    result = _required_string(value, field).lower()
    _require(
        bool(SHA256_PATTERN.fullmatch(result)),
        f"{field} must use sha256:<64 lowercase hex characters>",
    )
    return result


def _find_forbidden_key(value: object, path: str = "payload") -> str | None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            normalized = str(key).strip().lower()
            if normalized in FORBIDDEN_DERIVED_KEYS:
                return f"{path}.{key}"
            found = _find_forbidden_key(child, f"{path}.{key}")
            if found:
                return found
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found = _find_forbidden_key(child, f"{path}[{index}]")
            if found:
                return found
    return None


def _validate_evidence_header(
    payload: Mapping[str, Any],
    label: str,
) -> tuple[str, str]:
    _require(
        payload.get("schema_version") == SCHEMA_VERSION,
        f"{label}.schema_version must be {SCHEMA_VERSION}",
    )
    study_id = _required_string(payload.get("study_id"), f"{label}.study_id")
    evidence_class = _required_string(
        payload.get("evidence_class"),
        f"{label}.evidence_class",
    )
    _require(
        evidence_class in EVIDENCE_CLASSES,
        f"{label}.evidence_class must be one of {sorted(EVIDENCE_CLASSES)}",
    )
    return study_id, evidence_class


def _version_is_named(value: str) -> bool:
    return value.strip().lower() not in PLACEHOLDER_VERSIONS


def validate_protocol(payload: Mapping[str, Any]) -> dict[str, Any]:
    study_id, evidence_class = _validate_evidence_header(payload, "protocol")
    _required_string(payload.get("protocol_version"), "protocol.protocol_version")
    _required_string(payload.get("intended_use"), "protocol.intended_use")
    _require(
        payload.get("route_change_requested") is False,
        "protocol.route_change_requested must be false",
    )

    tasks = _required_string_list(payload.get("tasks"), "protocol.tasks")
    unknown_tasks = sorted(set(tasks) - TASKS)
    _require(not unknown_tasks, f"protocol.tasks contains unsupported tasks: {unknown_tasks}")

    languages = _required_string_list(
        payload.get("languages"),
        "protocol.languages",
    )
    document_types = _required_string_list(
        payload.get("document_types"),
        "protocol.document_types",
    )
    unknown_document_types = sorted(set(document_types) - DOCUMENT_TYPES)
    _require(
        not unknown_document_types,
        "protocol.document_types contains unsupported values: "
        f"{unknown_document_types}",
    )

    raw_configs = _required_list(
        payload.get("runtime_configurations"),
        "protocol.runtime_configurations",
    )
    _require(raw_configs, "protocol.runtime_configurations must not be empty")
    configurations: dict[str, dict[str, Any]] = {}
    for index, raw_config in enumerate(raw_configs):
        field = f"protocol.runtime_configurations[{index}]"
        config = _required_mapping(raw_config, field)
        config_id = _required_string(config.get("id"), f"{field}.id")
        _require(config_id not in configurations, f"duplicate runtime configuration id: {config_id}")
        task = _required_string(config.get("task"), f"{field}.task")
        _require(task in TASKS, f"{field}.task is unsupported")
        _require(task in tasks, f"{field}.task is not declared in protocol.tasks")
        provider = _required_string(config.get("provider"), f"{field}.provider")
        model_or_engine = _required_string(
            config.get("model_or_engine"),
            f"{field}.model_or_engine",
        )
        version = _required_string(config.get("version"), f"{field}.version")
        source_revision = _required_string(
            config.get("source_revision"),
            f"{field}.source_revision",
        )
        locked = _required_bool(config.get("locked"), f"{field}.locked")
        parameters = _required_mapping(config.get("parameters"), f"{field}.parameters")
        runtime = _required_mapping(config.get("runtime"), f"{field}.runtime")
        _required_string(runtime.get("operating_system"), f"{field}.runtime.operating_system")
        _required_string(runtime.get("hardware"), f"{field}.runtime.hardware")
        _required_string(runtime.get("language_runtime"), f"{field}.runtime.language_runtime")

        if evidence_class == MEASURED_EVIDENCE:
            _require(locked, f"{field}.locked must be true for measured evidence")
            _require(_version_is_named(version), f"{field}.version must be explicit")
            _require(
                _version_is_named(source_revision),
                f"{field}.source_revision must be explicit",
            )
            _require(provider.lower() != "contract", f"{field}.provider cannot be contract")
            _require(
                not model_or_engine.lower().startswith("reference-"),
                f"{field}.model_or_engine cannot be a reference fixture",
            )
        configurations[config_id] = {
            **config,
            "id": config_id,
            "task": task,
            "provider": provider,
            "model_or_engine": model_or_engine,
            "version": version,
            "source_revision": source_revision,
            "locked": locked,
            "parameters": parameters,
            "runtime": runtime,
        }

    dataset = _required_mapping(payload.get("dataset"), "protocol.dataset")
    _required_string(dataset.get("dataset_id"), "protocol.dataset.dataset_id")
    case_inventory_hash = _require_sha256(
        dataset.get("case_inventory_hash"),
        "protocol.dataset.case_inventory_hash",
    )
    legally_usable = _required_bool(
        dataset.get("legally_usable"),
        "protocol.dataset.legally_usable",
    )
    independent_test_set = _required_bool(
        dataset.get("independent_test_set"),
        "protocol.dataset.independent_test_set",
    )
    training_overlap_assessed = _required_bool(
        dataset.get("training_overlap_assessed"),
        "protocol.dataset.training_overlap_assessed",
    )
    preprocessing_locked = _required_bool(
        dataset.get("preprocessing_locked_before_scoring"),
        "protocol.dataset.preprocessing_locked_before_scoring",
    )
    source_documents_committed = _required_bool(
        dataset.get("source_documents_committed"),
        "protocol.dataset.source_documents_committed",
    )
    derived_evidence_only = _required_bool(
        dataset.get("derived_evidence_only"),
        "protocol.dataset.derived_evidence_only",
    )
    contains_phi = _required_bool(
        dataset.get("contains_phi"),
        "protocol.dataset.contains_phi",
    )
    controlled_environment = _required_bool(
        dataset.get("controlled_environment"),
        "protocol.dataset.controlled_environment",
    )
    _require(
        source_documents_committed is False,
        "protocol.dataset.source_documents_committed must be false",
    )
    _require(
        derived_evidence_only is True,
        "protocol.dataset.derived_evidence_only must be true",
    )
    if contains_phi:
        _require(
            controlled_environment,
            "protocol.dataset.controlled_environment must be true when contains_phi=true",
        )

    gold_labels = _required_mapping(
        dataset.get("gold_labels"),
        "protocol.dataset.gold_labels",
    )
    clinician_authored = _required_bool(
        gold_labels.get("clinician_authored"),
        "protocol.dataset.gold_labels.clinician_authored",
    )
    author_count = _required_int(
        gold_labels.get("author_count"),
        "protocol.dataset.gold_labels.author_count",
    )
    independent_annotation = _required_bool(
        gold_labels.get("independent_annotation"),
        "protocol.dataset.gold_labels.independent_annotation",
    )
    adjudication_complete = _required_bool(
        gold_labels.get("adjudication_complete"),
        "protocol.dataset.gold_labels.adjudication_complete",
    )
    _required_string(
        gold_labels.get("version"),
        "protocol.dataset.gold_labels.version",
    )
    _require_sha256(
        gold_labels.get("content_hash"),
        "protocol.dataset.gold_labels.content_hash",
    )

    registration = _required_mapping(
        payload.get("registration"),
        "protocol.registration",
    )
    registered_before_execution = _required_bool(
        registration.get("registered_before_execution"),
        "protocol.registration.registered_before_execution",
    )
    _required_string(
        registration.get("identifier"),
        "protocol.registration.identifier",
    )
    _required_string(
        registration.get("frozen_at"),
        "protocol.registration.frozen_at",
    )

    review_plan = _required_mapping(
        payload.get("review_plan"),
        "protocol.review_plan",
    )
    blinded_to_configuration = _required_bool(
        review_plan.get("blinded_to_configuration"),
        "protocol.review_plan.blinded_to_configuration",
    )
    minimum_independent_reviewers = _required_int(
        review_plan.get("minimum_independent_reviewers"),
        "protocol.review_plan.minimum_independent_reviewers",
        minimum=1,
    )
    adjudication_required = _required_bool(
        review_plan.get("adjudication_required_on_disagreement"),
        "protocol.review_plan.adjudication_required_on_disagreement",
    )

    approvals = _required_mapping(payload.get("approvals"), "protocol.approvals")
    approval_values = {
        role: _required_bool(
            approvals.get(role),
            f"protocol.approvals.{role}",
        )
        for role in (
            "clinical_owner",
            "statistical_owner",
            "engineering_owner",
        )
    }

    if evidence_class == MEASURED_EVIDENCE:
        _require(legally_usable, "Measured evidence requires a legally usable dataset")
        _require(independent_test_set, "Measured evidence requires an independent test set")
        _require(
            training_overlap_assessed,
            "Measured evidence requires documented training-overlap assessment",
        )
        _require(
            preprocessing_locked,
            "Measured evidence requires preprocessing locked before scoring",
        )
        _require(
            clinician_authored and author_count >= 2,
            "Measured evidence requires clinician-authored gold labels from at least two authors",
        )
        _require(
            independent_annotation,
            "Measured evidence requires independent gold annotation",
        )
        _require(
            adjudication_complete,
            "Measured evidence requires completed gold-label adjudication",
        )
        _require(
            registered_before_execution,
            "Measured evidence requires protocol registration before execution",
        )
        _require(
            blinded_to_configuration,
            "Measured evidence requires clinician review blinded to runtime configuration",
        )
        _require(
            adjudication_required,
            "Measured evidence requires adjudication on reviewer disagreement",
        )
        _require(
            all(approval_values.values()),
            "Measured evidence requires clinical, statistical, and engineering protocol approval",
        )

    return {
        "study_id": study_id,
        "evidence_class": evidence_class,
        "tasks": tuple(tasks),
        "languages": tuple(languages),
        "document_types": tuple(document_types),
        "configurations": configurations,
        "case_inventory_hash": case_inventory_hash,
        "review_plan": {
            "blinded_to_configuration": blinded_to_configuration,
            "minimum_independent_reviewers": minimum_independent_reviewers,
            "adjudication_required_on_disagreement": adjudication_required,
        },
        "protocol_governance": {
            "legally_usable": legally_usable,
            "independent_test_set": independent_test_set,
            "training_overlap_assessed": training_overlap_assessed,
            "preprocessing_locked_before_scoring": preprocessing_locked,
            "gold_labels_clinician_authored": clinician_authored,
            "gold_label_author_count": author_count,
            "gold_labels_independent_annotation": independent_annotation,
            "gold_labels_adjudication_complete": adjudication_complete,
            "registered_before_execution": registered_before_execution,
            "review_blinded_to_configuration": blinded_to_configuration,
            "approvals_complete": all(approval_values.values()),
        },
    }


COUNT_FIELDS = {
    TASK_EXTRACTION: (
        "fact_tp",
        "fact_fp",
        "fact_fn",
        "context_correct",
        "context_total",
        "date_correct",
        "date_total",
        "quantity_correct",
        "quantity_total",
    ),
    TASK_OCR: (
        "character_edits",
        "reference_characters",
        "word_edits",
        "reference_words",
        "page_text_correct",
        "page_text_total",
    ),
    TASK_MEDICATION: (
        "true_positive",
        "false_positive",
        "false_negative",
        "attribute_correct",
        "attribute_total",
    ),
}


def validate_results(
    payload: Mapping[str, Any],
    protocol: Mapping[str, Any],
) -> tuple[dict[str, Any], ...]:
    study_id, evidence_class = _validate_evidence_header(payload, "results")
    _require(study_id == protocol["study_id"], "results.study_id must match protocol")
    _require(
        evidence_class == protocol["evidence_class"],
        "results.evidence_class must match protocol",
    )
    _required_string(payload.get("run_id"), "results.run_id")
    _required_string(payload.get("captured_at"), "results.captured_at")
    _require(
        payload.get("derived_evidence_only") is True,
        "results.derived_evidence_only must be true",
    )
    _require(
        payload.get("source_documents_committed") is False,
        "results.source_documents_committed must be false",
    )
    _require(
        _require_sha256(
            payload.get("case_inventory_hash"),
            "results.case_inventory_hash",
        )
        == protocol["case_inventory_hash"],
        "results.case_inventory_hash must match protocol",
    )
    forbidden = _find_forbidden_key(payload, "results")
    _require(
        forbidden is None,
        f"Derived results must not contain raw patient/source fields: {forbidden}",
    )

    raw_results = _required_list(payload.get("results"), "results.results")
    _require(raw_results, "results.results must not be empty")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw_result in enumerate(raw_results):
        field = f"results.results[{index}]"
        result = _required_mapping(raw_result, field)
        result_id = _required_string(result.get("result_id"), f"{field}.result_id")
        _require(result_id not in seen, f"duplicate result_id: {result_id}")
        seen.add(result_id)
        case_id = _required_string(result.get("case_id"), f"{field}.case_id")
        configuration_id = _required_string(
            result.get("configuration_id"),
            f"{field}.configuration_id",
        )
        _require(
            configuration_id in protocol["configurations"],
            f"{field}.configuration_id is not declared in the protocol",
        )
        task = _required_string(result.get("task"), f"{field}.task")
        _require(task in TASKS, f"{field}.task is unsupported")
        _require(
            protocol["configurations"][configuration_id]["task"] == task,
            f"{field}.task does not match its runtime configuration",
        )
        document_type = _required_string(
            result.get("document_type"),
            f"{field}.document_type",
        )
        _require(
            document_type in protocol["document_types"],
            f"{field}.document_type is not declared in the protocol",
        )
        language = _required_string(result.get("language"), f"{field}.language")
        _require(
            language in protocol["languages"],
            f"{field}.language is not declared in the protocol",
        )
        risk_level = _required_string(
            result.get("risk_level"),
            f"{field}.risk_level",
        )
        _require(risk_level in RISK_LEVELS, f"{field}.risk_level is unsupported")
        quality_tags = _required_string_list(
            result.get("quality_tags", []),
            f"{field}.quality_tags",
            allow_empty=True,
        )
        runtime_failure = _required_bool(
            result.get("runtime_failure"),
            f"{field}.runtime_failure",
        )
        identity_mismatch = _required_bool(
            result.get("identity_mismatch"),
            f"{field}.identity_mismatch",
        )
        counts = _required_mapping(result.get("counts"), f"{field}.counts")
        expected_fields = set(COUNT_FIELDS[task])
        _require(
            set(counts) == expected_fields,
            f"{field}.counts must contain exactly {sorted(expected_fields)}",
        )
        normalized_counts = {
            name: _required_int(counts.get(name), f"{field}.counts.{name}")
            for name in COUNT_FIELDS[task]
        }
        for correct_field, total_field in (
            ("context_correct", "context_total"),
            ("date_correct", "date_total"),
            ("quantity_correct", "quantity_total"),
            ("page_text_correct", "page_text_total"),
            ("attribute_correct", "attribute_total"),
        ):
            if correct_field in normalized_counts:
                _require(
                    normalized_counts[correct_field]
                    <= normalized_counts[total_field],
                    f"{field}.counts.{correct_field} cannot exceed {total_field}",
                )

        raw_critical = _required_list(
            result.get("critical_errors", []),
            f"{field}.critical_errors",
        )
        critical_errors: list[dict[str, str]] = []
        for error_index, raw_error in enumerate(raw_critical):
            error_field = f"{field}.critical_errors[{error_index}]"
            error = _required_mapping(raw_error, error_field)
            critical_errors.append(
                {
                    "id": _required_string(error.get("id"), f"{error_field}.id"),
                    "code": _required_string(
                        error.get("code"),
                        f"{error_field}.code",
                    ),
                }
            )

        if evidence_class == MEASURED_EVIDENCE:
            _require_sha256(result.get("source_hash"), f"{field}.source_hash")
            _require_sha256(
                result.get("prediction_hash"),
                f"{field}.prediction_hash",
            )

        normalized.append(
            {
                "result_id": result_id,
                "case_id": case_id,
                "configuration_id": configuration_id,
                "task": task,
                "document_type": document_type,
                "language": language,
                "risk_level": risk_level,
                "quality_tags": tuple(quality_tags),
                "runtime_failure": runtime_failure,
                "identity_mismatch": identity_mismatch,
                "counts": normalized_counts,
                "critical_errors": tuple(critical_errors),
            }
        )
    return tuple(normalized)


def validate_reviews(
    payload: Mapping[str, Any],
    protocol: Mapping[str, Any],
    results: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    study_id, evidence_class = _validate_evidence_header(payload, "reviews")
    _require(study_id == protocol["study_id"], "reviews.study_id must match protocol")
    _require(
        evidence_class == protocol["evidence_class"],
        "reviews.evidence_class must match protocol",
    )
    _require(
        payload.get("derived_evidence_only") is True,
        "reviews.derived_evidence_only must be true",
    )
    forbidden = _find_forbidden_key(payload, "reviews")
    _require(
        forbidden is None,
        f"Derived reviews must not contain raw patient/source fields: {forbidden}",
    )
    blinding_preserved = _required_bool(
        payload.get("blinding_preserved"),
        "reviews.blinding_preserved",
    )
    if evidence_class == MEASURED_EVIDENCE:
        _require(
            blinding_preserved,
            "Measured reviews require configuration blinding",
        )

    result_ids = {str(result["result_id"]) for result in results}
    raw_reviews = _required_list(payload.get("reviews"), "reviews.reviews")
    raw_adjudications = _required_list(
        payload.get("adjudications"),
        "reviews.adjudications",
    )

    normalized_reviews: list[dict[str, Any]] = []
    seen_review_ids: set[str] = set()
    for index, raw_review in enumerate(raw_reviews):
        field = f"reviews.reviews[{index}]"
        review = _required_mapping(raw_review, field)
        review_id = _required_string(review.get("review_id"), f"{field}.review_id")
        _require(review_id not in seen_review_ids, f"duplicate review_id: {review_id}")
        seen_review_ids.add(review_id)
        result_id = _required_string(review.get("result_id"), f"{field}.result_id")
        _require(result_id in result_ids, f"{field}.result_id is unknown")
        reviewer_id = _required_string(
            review.get("reviewer_id"),
            f"{field}.reviewer_id",
        )
        role = _required_string(review.get("role"), f"{field}.role")
        credential_verified = _required_bool(
            review.get("credential_verified"),
            f"{field}.credential_verified",
        )
        independent = _required_bool(
            review.get("independent"),
            f"{field}.independent",
        )
        blinded = _required_bool(
            review.get("blinded_to_configuration"),
            f"{field}.blinded_to_configuration",
        )
        verdict = _required_string(review.get("verdict"), f"{field}.verdict")
        _require(verdict in VERDICTS, f"{field}.verdict is unsupported")
        raw_critical_ids = _required_string_list(
            review.get("critical_error_ids", []),
            f"{field}.critical_error_ids",
            allow_empty=True,
        )
        if evidence_class == MEASURED_EVIDENCE:
            _require(role == "clinician", f"{field}.role must be clinician")
            _require(
                credential_verified,
                f"{field}.credential_verified must be true",
            )
            _require(independent, f"{field}.independent must be true")
            _require(blinded, f"{field}.blinded_to_configuration must be true")
        normalized_reviews.append(
            {
                "review_id": review_id,
                "result_id": result_id,
                "reviewer_id": reviewer_id,
                "role": role,
                "credential_verified": credential_verified,
                "independent": independent,
                "blinded_to_configuration": blinded,
                "verdict": verdict,
                "critical_error_ids": tuple(raw_critical_ids),
            }
        )

    normalized_adjudications: dict[str, dict[str, Any]] = {}
    for index, raw_adjudication in enumerate(raw_adjudications):
        field = f"reviews.adjudications[{index}]"
        adjudication = _required_mapping(raw_adjudication, field)
        result_id = _required_string(
            adjudication.get("result_id"),
            f"{field}.result_id",
        )
        _require(result_id in result_ids, f"{field}.result_id is unknown")
        _require(
            result_id not in normalized_adjudications,
            f"duplicate adjudication for result_id: {result_id}",
        )
        role = _required_string(adjudication.get("role"), f"{field}.role")
        credential_verified = _required_bool(
            adjudication.get("credential_verified"),
            f"{field}.credential_verified",
        )
        blinded = _required_bool(
            adjudication.get("blinded_to_configuration"),
            f"{field}.blinded_to_configuration",
        )
        final_verdict = _required_string(
            adjudication.get("final_verdict"),
            f"{field}.final_verdict",
        )
        _require(
            final_verdict in VERDICTS,
            f"{field}.final_verdict is unsupported",
        )
        if evidence_class == MEASURED_EVIDENCE:
            _require(role == "clinician", f"{field}.role must be clinician")
            _require(
                credential_verified,
                f"{field}.credential_verified must be true",
            )
            _require(
                blinded,
                f"{field}.blinded_to_configuration must be true",
            )
        normalized_adjudications[result_id] = {
            "result_id": result_id,
            "adjudicator_id": _required_string(
                adjudication.get("adjudicator_id"),
                f"{field}.adjudicator_id",
            ),
            "role": role,
            "credential_verified": credential_verified,
            "blinded_to_configuration": blinded,
            "final_verdict": final_verdict,
            "rationale_code": _required_string(
                adjudication.get("rationale_code"),
                f"{field}.rationale_code",
            ),
        }

    return {
        "blinding_preserved": blinding_preserved,
        "reviews": tuple(normalized_reviews),
        "adjudications": normalized_adjudications,
    }


VALID_OPERATORS = frozenset({">=", "<=", "=="})


def validate_policy(payload: Mapping[str, Any]) -> dict[str, Any]:
    _require(
        payload.get("schema_version") == SCHEMA_VERSION,
        f"policy.schema_version must be {SCHEMA_VERSION}",
    )
    policy_id = _required_string(payload.get("policy_id"), "policy.policy_id")
    policy_class = _required_string(
        payload.get("policy_class"),
        "policy.policy_class",
    )
    _require(
        policy_class in {"contract-fixture", "approved-release-policy"},
        "policy.policy_class is unsupported",
    )
    _require(
        payload.get("route_change_authorized") is False,
        "policy.route_change_authorized must be false",
    )
    _required_string(payload.get("decision_scope"), "policy.decision_scope")

    approvals = _required_mapping(payload.get("approvals"), "policy.approvals")
    approval_values = {
        role: _required_bool(approvals.get(role), f"policy.approvals.{role}")
        for role in (
            "clinical_owner",
            "statistical_owner",
            "engineering_owner",
        )
    }
    if policy_class == "approved-release-policy":
        _require(
            all(approval_values.values()),
            "An approved release policy requires clinical, statistical, and engineering approval",
        )

    coverage = _required_mapping(payload.get("coverage"), "policy.coverage")
    minimum_total_cases = _required_int(
        coverage.get("minimum_total_cases"),
        "policy.coverage.minimum_total_cases",
        minimum=1,
    )
    coverage_maps: dict[str, dict[str, int]] = {}
    for name in ("per_document_type", "per_language", "per_task"):
        raw_map = _required_mapping(
            coverage.get(name),
            f"policy.coverage.{name}",
        )
        coverage_maps[name] = {
            _required_string(key, f"policy.coverage.{name}.key"):
            _required_int(value, f"policy.coverage.{name}.{key}", minimum=1)
            for key, value in raw_map.items()
        }

    raw_task_thresholds = _required_mapping(
        payload.get("task_thresholds"),
        "policy.task_thresholds",
    )
    task_thresholds: dict[str, dict[str, dict[str, Any]]] = {}
    for task, raw_metrics in raw_task_thresholds.items():
        _require(task in TASKS, f"policy.task_thresholds.{task} is unsupported")
        metrics = _required_mapping(
            raw_metrics,
            f"policy.task_thresholds.{task}",
        )
        _require(metrics, f"policy.task_thresholds.{task} must not be empty")
        task_thresholds[task] = {}
        for metric, raw_threshold in metrics.items():
            field = f"policy.task_thresholds.{task}.{metric}"
            threshold = _required_mapping(raw_threshold, field)
            operator = _required_string(threshold.get("operator"), f"{field}.operator")
            _require(operator in VALID_OPERATORS, f"{field}.operator is unsupported")
            task_thresholds[task][metric] = {
                "operator": operator,
                "value": _required_number(
                    threshold.get("value"),
                    f"{field}.value",
                ),
            }

    review = _required_mapping(payload.get("review"), "policy.review")
    required_risk_levels = _required_string_list(
        review.get("required_risk_levels"),
        "policy.review.required_risk_levels",
    )
    _require(
        not (set(required_risk_levels) - RISK_LEVELS),
        "policy.review.required_risk_levels contains unsupported values",
    )
    review_policy = {
        "required_risk_levels": tuple(required_risk_levels),
        "minimum_independent_reviewers": _required_int(
            review.get("minimum_independent_reviewers"),
            "policy.review.minimum_independent_reviewers",
            minimum=1,
        ),
        "minimum_safety_agreement_rate": _required_number(
            review.get("minimum_safety_agreement_rate"),
            "policy.review.minimum_safety_agreement_rate",
            minimum=0,
            maximum=1,
        ),
        "maximum_unadjudicated_disagreements": _required_int(
            review.get("maximum_unadjudicated_disagreements"),
            "policy.review.maximum_unadjudicated_disagreements",
        ),
        "maximum_final_unsafe": _required_int(
            review.get("maximum_final_unsafe"),
            "policy.review.maximum_final_unsafe",
        ),
        "maximum_review_critical_errors": _required_int(
            review.get("maximum_review_critical_errors"),
            "policy.review.maximum_review_critical_errors",
        ),
    }

    zero_tolerance = _required_mapping(
        payload.get("zero_tolerance"),
        "policy.zero_tolerance",
    )
    zero_tolerance_values = {
        "critical_error_count": _required_int(
            zero_tolerance.get("critical_error_count"),
            "policy.zero_tolerance.critical_error_count",
        ),
        "identity_mismatch_count": _required_int(
            zero_tolerance.get("identity_mismatch_count"),
            "policy.zero_tolerance.identity_mismatch_count",
        ),
        "runtime_failure_count": _required_int(
            zero_tolerance.get("runtime_failure_count"),
            "policy.zero_tolerance.runtime_failure_count",
        ),
    }

    regression = _required_mapping(payload.get("regression"), "policy.regression")
    baseline_required = _required_bool(
        regression.get("baseline_required"),
        "policy.regression.baseline_required",
    )
    raw_regression_metrics = _required_mapping(
        regression.get("metrics"),
        "policy.regression.metrics",
    )
    regression_metrics: dict[str, dict[str, Any]] = {}
    for metric_key, raw_rule in raw_regression_metrics.items():
        field = f"policy.regression.metrics.{metric_key}"
        rule = _required_mapping(raw_rule, field)
        direction = _required_string(rule.get("direction"), f"{field}.direction")
        _require(direction in {"higher", "lower"}, f"{field}.direction is unsupported")
        regression_metrics[metric_key] = {
            "direction": direction,
            "maximum_absolute_regression": _required_number(
                rule.get("maximum_absolute_regression"),
                f"{field}.maximum_absolute_regression",
                minimum=0,
            ),
        }

    return {
        "policy_id": policy_id,
        "policy_class": policy_class,
        "approvals_complete": all(approval_values.values()),
        "minimum_total_cases": minimum_total_cases,
        **coverage_maps,
        "task_thresholds": task_thresholds,
        "review": review_policy,
        "zero_tolerance": zero_tolerance_values,
        "regression": {
            "baseline_required": baseline_required,
            "metrics": regression_metrics,
        },
    }


def _safe_ratio(
    numerator: int | float,
    denominator: int | float,
    *,
    empty: float | None,
) -> float | None:
    return float(numerator) / float(denominator) if denominator else empty


def _prf(tp: int, fp: int, fn: int) -> dict[str, float]:
    precision = _safe_ratio(tp, tp + fp, empty=1.0 if tp + fn == 0 else 0.0)
    recall = _safe_ratio(tp, tp + fn, empty=1.0 if tp + fp == 0 else 0.0)
    assert precision is not None and recall is not None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )
    return {"precision": precision, "recall": recall, "f1": f1}


def _empty_task_counts(task: str) -> dict[str, int]:
    return {
        "results": 0,
        "runtime_failures": 0,
        "critical_errors": 0,
        "identity_mismatches": 0,
        **{field: 0 for field in COUNT_FIELDS[task]},
    }


def _summarize_task(task: str, records: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    counts = _empty_task_counts(task)
    case_ids: set[str] = set()
    for record in records:
        counts["results"] += 1
        counts["runtime_failures"] += int(bool(record["runtime_failure"]))
        counts["critical_errors"] += len(record["critical_errors"])
        counts["identity_mismatches"] += int(bool(record["identity_mismatch"]))
        case_ids.add(str(record["case_id"]))
        for field in COUNT_FIELDS[task]:
            counts[field] += int(record["counts"][field])

    common = {
        "case_count": len(case_ids),
        "result_count": counts["results"],
        "runtime_failure_rate": _safe_ratio(
            counts["runtime_failures"],
            counts["results"],
            empty=0.0,
        ),
        "runtime_failure_count": counts["runtime_failures"],
        "critical_error_count": counts["critical_errors"],
        "identity_mismatch_count": counts["identity_mismatches"],
    }
    if task == TASK_EXTRACTION:
        prf = _prf(counts["fact_tp"], counts["fact_fp"], counts["fact_fn"])
        return {
            **common,
            "fact_exact_precision": prf["precision"],
            "fact_exact_recall": prf["recall"],
            "fact_exact_f1": prf["f1"],
            "unsupported_addition_rate": _safe_ratio(
                counts["fact_fp"],
                counts["fact_tp"] + counts["fact_fp"],
                empty=0.0,
            ),
            "omission_rate": _safe_ratio(
                counts["fact_fn"],
                counts["fact_tp"] + counts["fact_fn"],
                empty=0.0,
            ),
            "context_axis_accuracy": _safe_ratio(
                counts["context_correct"],
                counts["context_total"],
                empty=None,
            ),
            "date_exact_accuracy": _safe_ratio(
                counts["date_correct"],
                counts["date_total"],
                empty=None,
            ),
            "quantity_exact_accuracy": _safe_ratio(
                counts["quantity_correct"],
                counts["quantity_total"],
                empty=None,
            ),
        }
    if task == TASK_OCR:
        return {
            **common,
            "character_error_rate": _safe_ratio(
                counts["character_edits"],
                counts["reference_characters"],
                empty=None,
            ),
            "word_error_rate": _safe_ratio(
                counts["word_edits"],
                counts["reference_words"],
                empty=None,
            ),
            "page_text_accuracy": _safe_ratio(
                counts["page_text_correct"],
                counts["page_text_total"],
                empty=None,
            ),
        }
    prf = _prf(
        counts["true_positive"],
        counts["false_positive"],
        counts["false_negative"],
    )
    return {
        **common,
        "medication_exact_precision": prf["precision"],
        "medication_exact_recall": prf["recall"],
        "medication_exact_f1": prf["f1"],
        "unsupported_addition_rate": _safe_ratio(
            counts["false_positive"],
            counts["true_positive"] + counts["false_positive"],
            empty=0.0,
        ),
        "omission_rate": _safe_ratio(
            counts["false_negative"],
            counts["true_positive"] + counts["false_negative"],
            empty=0.0,
        ),
        "attribute_exact_accuracy": _safe_ratio(
            counts["attribute_correct"],
            counts["attribute_total"],
            empty=None,
        ),
    }


def _summarize_group(records: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    by_task: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for record in records:
        by_task[str(record["task"])].append(record)
    return {
        "case_count": len({str(record["case_id"]) for record in records}),
        "result_count": len(records),
        "tasks": {
            task: _summarize_task(task, task_records)
            for task, task_records in sorted(by_task.items())
        },
    }


def aggregate_results(
    results: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    by_language: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    by_document_type: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    by_stratum: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    by_task: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for result in results:
        language = str(result["language"])
        document_type = str(result["document_type"])
        task = str(result["task"])
        by_language[language].append(result)
        by_document_type[document_type].append(result)
        by_stratum[f"{task}|{language}|{document_type}"].append(result)
        by_task[task].append(result)

    return {
        "overall": _summarize_group(results),
        "by_task": {
            task: _summarize_task(task, records)
            for task, records in sorted(by_task.items())
        },
        "by_language": {
            key: _summarize_group(records)
            for key, records in sorted(by_language.items())
        },
        "by_document_type": {
            key: _summarize_group(records)
            for key, records in sorted(by_document_type.items())
        },
        "by_task_language_document_type": {
            key: _summarize_group(records)
            for key, records in sorted(by_stratum.items())
        },
    }


def _safety_class(verdict: str) -> str:
    return "acceptable" if verdict in SAFETY_ACCEPTABLE else "unsafe"


def evaluate_reviews(
    reviews: Mapping[str, Any],
    protocol: Mapping[str, Any],
    policy: Mapping[str, Any],
    results: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    minimum_reviewers = max(
        int(protocol["review_plan"]["minimum_independent_reviewers"]),
        int(policy["review"]["minimum_independent_reviewers"]),
    )
    required_risk_levels = set(policy["review"]["required_risk_levels"])
    required_results = [
        result for result in results
        if str(result["risk_level"]) in required_risk_levels
    ]

    reviews_by_result: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for review in reviews["reviews"]:
        if review["independent"] and review["blinded_to_configuration"]:
            reviews_by_result[str(review["result_id"])].append(review)

    fully_reviewed = 0
    safety_agreements = 0
    exact_agreements = 0
    missing_review_ids: list[str] = []
    disagreements: list[str] = []
    unadjudicated: list[str] = []
    final_unsafe: list[str] = []
    review_critical_ids: set[str] = set()
    per_result: list[dict[str, Any]] = []

    for result in required_results:
        result_id = str(result["result_id"])
        result_reviews = reviews_by_result.get(result_id, [])
        unique_reviewers = {str(review["reviewer_id"]) for review in result_reviews}
        enough = (
            len(result_reviews) >= minimum_reviewers
            and len(unique_reviewers) >= minimum_reviewers
        )
        if enough:
            fully_reviewed += 1
        else:
            missing_review_ids.append(result_id)

        verdicts = [str(review["verdict"]) for review in result_reviews]
        safety_classes = {_safety_class(verdict) for verdict in verdicts}
        exact_agreement = bool(verdicts) and len(set(verdicts)) == 1
        safety_agreement = bool(verdicts) and len(safety_classes) == 1
        if enough and exact_agreement:
            exact_agreements += 1
        if enough and safety_agreement:
            safety_agreements += 1

        disagreement = enough and not safety_agreement
        if disagreement:
            disagreements.append(result_id)

        for review in result_reviews:
            review_critical_ids.update(review["critical_error_ids"])

        adjudication = reviews["adjudications"].get(result_id)
        if disagreement and protocol["review_plan"]["adjudication_required_on_disagreement"]:
            if adjudication is None:
                unadjudicated.append(result_id)

        if adjudication is not None:
            final_verdict = str(adjudication["final_verdict"])
        elif safety_agreement and verdicts:
            final_verdict = verdicts[0]
        else:
            final_verdict = "unresolved"

        if final_verdict in {"major-correction", "unsafe"}:
            final_unsafe.append(result_id)

        per_result.append(
            {
                "result_id": result_id,
                "review_count": len(result_reviews),
                "unique_reviewer_count": len(unique_reviewers),
                "minimum_reviewers_met": enough,
                "exact_verdict_agreement": exact_agreement,
                "safety_class_agreement": safety_agreement,
                "adjudicated": adjudication is not None,
                "final_verdict": final_verdict,
            }
        )

    required_count = len(required_results)
    return {
        "required_result_count": required_count,
        "fully_reviewed_count": fully_reviewed,
        "review_completion_rate": _safe_ratio(
            fully_reviewed,
            required_count,
            empty=1.0,
        ),
        "exact_verdict_agreement_rate": _safe_ratio(
            exact_agreements,
            required_count,
            empty=1.0,
        ),
        "safety_agreement_rate": _safe_ratio(
            safety_agreements,
            required_count,
            empty=1.0,
        ),
        "missing_review_result_ids": sorted(missing_review_ids),
        "disagreement_result_ids": sorted(disagreements),
        "unadjudicated_disagreement_result_ids": sorted(unadjudicated),
        "final_unsafe_result_ids": sorted(final_unsafe),
        "review_critical_error_ids": sorted(review_critical_ids),
        "per_result": per_result,
    }


def _gate(
    gate_id: str,
    *,
    passed: bool,
    actual: Any,
    required: Any,
    detail: str,
) -> dict[str, Any]:
    return {
        "id": gate_id,
        "severity": "stop-ship",
        "passed": bool(passed),
        "actual": actual,
        "required": required,
        "detail": detail,
    }


def _compare(actual: float, operator: str, expected: float) -> bool:
    if operator == ">=":
        return actual >= expected
    if operator == "<=":
        return actual <= expected
    return actual == expected


def _metric_value(
    aggregate: Mapping[str, Any],
    task: str,
    metric: str,
) -> float | None:
    task_metrics = aggregate["by_task"].get(task)
    if not isinstance(task_metrics, Mapping):
        return None
    value = task_metrics.get(metric)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _coverage_counts(
    results: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    case_ids = {str(result["case_id"]) for result in results}
    by_document_type: dict[str, set[str]] = defaultdict(set)
    by_language: dict[str, set[str]] = defaultdict(set)
    by_task: dict[str, set[str]] = defaultdict(set)
    for result in results:
        case_id = str(result["case_id"])
        by_document_type[str(result["document_type"])].add(case_id)
        by_language[str(result["language"])].add(case_id)
        by_task[str(result["task"])].add(case_id)
    return {
        "total_cases": len(case_ids),
        "per_document_type": {
            key: len(values) for key, values in sorted(by_document_type.items())
        },
        "per_language": {
            key: len(values) for key, values in sorted(by_language.items())
        },
        "per_task": {
            key: len(values) for key, values in sorted(by_task.items())
        },
    }


def _flatten_task_metrics(aggregate: Mapping[str, Any]) -> dict[str, float]:
    flattened: dict[str, float] = {}
    for task, metrics in aggregate.get("by_task", {}).items():
        if not isinstance(metrics, Mapping):
            continue
        for name, value in metrics.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                flattened[f"{task}.{name}"] = float(value)
    return flattened


def _validate_baseline_report(
    baseline: Mapping[str, Any],
    study_id: str,
) -> dict[str, float]:
    _require(
        baseline.get("evaluation") == "medibrief-p3-prospective-validation",
        "baseline.evaluation is not a P3 prospective validation report",
    )
    _require(
        baseline.get("study_id") == study_id,
        "baseline.study_id must match the current study",
    )
    metrics = baseline.get("metrics")
    _require(isinstance(metrics, Mapping), "baseline.metrics must be an object")
    return _flatten_task_metrics(metrics)


def build_release_gates(
    *,
    protocol: Mapping[str, Any],
    policy: Mapping[str, Any],
    results: Sequence[Mapping[str, Any]],
    aggregate: Mapping[str, Any],
    review_report: Mapping[str, Any],
    baseline_report: Mapping[str, Any] | None,
) -> list[dict[str, Any]]:
    gates: list[dict[str, Any]] = []
    governance = protocol["protocol_governance"]
    for key, value in governance.items():
        if key == "gold_label_author_count":
            passed = int(value) >= 2
            required: Any = ">= 2"
        else:
            passed = bool(value)
            required = True
        gates.append(
            _gate(
                f"protocol.{key}",
                passed=passed,
                actual=value,
                required=required,
                detail="Prospective measured evidence must satisfy the frozen protocol governance contract.",
            )
        )

    gates.append(
        _gate(
            "policy.approvals_complete",
            passed=bool(policy["approvals_complete"]),
            actual=policy["approvals_complete"],
            required=True,
            detail="Release thresholds require clinical, statistical, and engineering approval.",
        )
    )

    coverage = _coverage_counts(results)
    gates.append(
        _gate(
            "coverage.total_cases",
            passed=coverage["total_cases"] >= policy["minimum_total_cases"],
            actual=coverage["total_cases"],
            required=f">= {policy['minimum_total_cases']}",
            detail="The independent test set must meet the pre-registered total case minimum.",
        )
    )
    for map_name in ("per_document_type", "per_language", "per_task"):
        actual_map = coverage[map_name]
        for key, minimum in policy[map_name].items():
            actual = int(actual_map.get(key, 0))
            gates.append(
                _gate(
                    f"coverage.{map_name}.{key}",
                    passed=actual >= minimum,
                    actual=actual,
                    required=f">= {minimum}",
                    detail="Every required evaluation stratum must meet its pre-registered case minimum.",
                )
            )

    for task, thresholds in policy["task_thresholds"].items():
        for metric, rule in thresholds.items():
            actual = _metric_value(aggregate, task, metric)
            passed = actual is not None and _compare(
                actual,
                str(rule["operator"]),
                float(rule["value"]),
            )
            gates.append(
                _gate(
                    f"metric.{task}.{metric}",
                    passed=passed,
                    actual=actual,
                    required=f"{rule['operator']} {rule['value']}",
                    detail="Measured task performance must satisfy the approved task-and-language release policy.",
                )
            )

    review_policy = policy["review"]
    review_values = (
        (
            "review.completion_rate",
            review_report["review_completion_rate"],
            ">=",
            1.0,
        ),
        (
            "review.safety_agreement_rate",
            review_report["safety_agreement_rate"],
            ">=",
            review_policy["minimum_safety_agreement_rate"],
        ),
        (
            "review.unadjudicated_disagreements",
            len(review_report["unadjudicated_disagreement_result_ids"]),
            "<=",
            review_policy["maximum_unadjudicated_disagreements"],
        ),
        (
            "review.final_unsafe",
            len(review_report["final_unsafe_result_ids"]),
            "<=",
            review_policy["maximum_final_unsafe"],
        ),
        (
            "review.critical_errors",
            len(review_report["review_critical_error_ids"]),
            "<=",
            review_policy["maximum_review_critical_errors"],
        ),
    )
    for gate_id, actual, operator, expected in review_values:
        numeric_actual = float(actual)
        gates.append(
            _gate(
                gate_id,
                passed=_compare(numeric_actual, operator, float(expected)),
                actual=actual,
                required=f"{operator} {expected}",
                detail="High-risk and boundary results require complete blinded clinician review and adjudication.",
            )
        )

    critical_error_count = sum(len(result["critical_errors"]) for result in results)
    identity_mismatch_count = sum(int(bool(result["identity_mismatch"])) for result in results)
    runtime_failure_count = sum(int(bool(result["runtime_failure"])) for result in results)
    zero_values = {
        "critical_error_count": critical_error_count,
        "identity_mismatch_count": identity_mismatch_count,
        "runtime_failure_count": runtime_failure_count,
    }
    for name, actual in zero_values.items():
        maximum = int(policy["zero_tolerance"][name])
        gates.append(
            _gate(
                f"zero_tolerance.{name}",
                passed=actual <= maximum,
                actual=actual,
                required=f"<= {maximum}",
                detail="Critical safety, identity, and execution failures are explicit stop-ship conditions.",
            )
        )

    regression_policy = policy["regression"]
    if regression_policy["baseline_required"]:
        gates.append(
            _gate(
                "regression.baseline_present",
                passed=baseline_report is not None,
                actual=baseline_report is not None,
                required=True,
                detail="A measured release candidate must be compared with the accepted baseline configuration.",
            )
        )
    if baseline_report is not None:
        baseline_metrics = _validate_baseline_report(
            baseline_report,
            str(protocol["study_id"]),
        )
        current_metrics = _flatten_task_metrics(aggregate)
        for metric_key, rule in regression_policy["metrics"].items():
            current = current_metrics.get(metric_key)
            baseline = baseline_metrics.get(metric_key)
            passed = current is not None and baseline is not None
            if passed:
                maximum = float(rule["maximum_absolute_regression"])
                if rule["direction"] == "higher":
                    passed = current >= baseline - maximum
                else:
                    passed = current <= baseline + maximum
            gates.append(
                _gate(
                    f"regression.{metric_key}",
                    passed=bool(passed),
                    actual={"current": current, "baseline": baseline},
                    required={
                        "direction": rule["direction"],
                        "maximum_absolute_regression": rule[
                            "maximum_absolute_regression"
                        ],
                    },
                    detail="A locked model or engine update must not regress beyond the approved absolute tolerance.",
                )
            )
    return gates


def evaluate(
    protocol_payload: Mapping[str, Any],
    results_payload: Mapping[str, Any],
    reviews_payload: Mapping[str, Any],
    policy_payload: Mapping[str, Any],
    *,
    baseline_report: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    protocol = validate_protocol(protocol_payload)
    results = validate_results(results_payload, protocol)
    reviews = validate_reviews(reviews_payload, protocol, results)
    policy = validate_policy(policy_payload)
    aggregate = aggregate_results(results)
    review_report = evaluate_reviews(
        reviews,
        protocol,
        policy,
        results,
    )

    measured_release_applicable = (
        protocol["evidence_class"] == MEASURED_EVIDENCE
        and policy["policy_class"] == "approved-release-policy"
    )
    release_gates = build_release_gates(
        protocol=protocol,
        policy=policy,
        results=results,
        aggregate=aggregate,
        review_report=review_report,
        baseline_report=baseline_report,
    )
    failed_gates = [
        gate["id"] for gate in release_gates if not gate["passed"]
    ]

    if not measured_release_applicable:
        decision = "contract-only"
    elif failed_gates:
        decision = "stop-ship"
    else:
        decision = "engineering-release-candidate"

    return {
        "schema_version": SCHEMA_VERSION,
        "evaluation": "medibrief-p3-prospective-validation",
        "study_id": protocol["study_id"],
        "evidence_class": protocol["evidence_class"],
        "policy_id": policy["policy_id"],
        "policy_class": policy["policy_class"],
        "contract_valid": True,
        "measured_release_applicable": measured_release_applicable,
        "metrics": aggregate,
        "coverage": _coverage_counts(results),
        "clinician_review": review_report,
        "release_gates": release_gates,
        "failed_release_gate_ids": failed_gates,
        "decision": decision,
        "route_change_authorized": False,
        "clinical_validation_established": False,
        "medication_safety_enabled": False,
        "interpretation": [
            "Contract fixtures validate schemas, aggregation, review, and stop-ship plumbing only.",
            "An engineering release candidate remains specific to the named locked configuration, corpus, sites, languages, and document types.",
            "A passing report does not authorize a MediBrief application-route change.",
            "All extracted statements remain candidates requiring source review.",
            "Prospective clinical validation and regulatory clearance are not established by this report.",
        ],
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", required=True)
    parser.add_argument("--results", required=True)
    parser.add_argument("--reviews", required=True)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--baseline-report")
    parser.add_argument("--output")
    parser.add_argument("--require-contract-fixture", action="store_true")
    parser.add_argument("--require-measured-evidence", action="store_true")
    parser.add_argument("--require-release-candidate", action="store_true")
    parser.add_argument("--fail-on-stop-ship", action="store_true")
    args = parser.parse_args(argv)

    try:
        protocol_payload = _load_json(args.protocol)
        results_payload = _load_json(args.results)
        reviews_payload = _load_json(args.reviews)
        policy_payload = _load_json(args.policy)
        baseline_payload = (
            _load_json(args.baseline_report)
            if args.baseline_report
            else None
        )
        report = evaluate(
            protocol_payload,
            results_payload,
            reviews_payload,
            policy_payload,
            baseline_report=baseline_payload,
        )
    except ProspectiveValidationError as exc:
        rendered_error = json.dumps(
            {"error": str(exc)},
            indent=2,
            ensure_ascii=False,
        )
        print(rendered_error)
        return 2

    rendered = json.dumps(
        report,
        indent=2,
        ensure_ascii=False,
        sort_keys=True,
    )
    print(rendered)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered + "\n", encoding="utf-8")

    if args.require_contract_fixture:
        if (
            report["evidence_class"] != CONTRACT_EVIDENCE
            or report["policy_class"] != "contract-fixture"
            or report["decision"] != "contract-only"
        ):
            return 1
    if args.require_measured_evidence:
        if report["evidence_class"] != MEASURED_EVIDENCE:
            return 1
    if args.require_release_candidate:
        if report["decision"] != "engineering-release-candidate":
            return 1
    if args.fail_on_stop_ship and report["decision"] == "stop-ship":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
