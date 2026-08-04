"""PHI-free NER and OCR evaluation for MediBrief Phase 3.

The evaluator deliberately separates two evidence classes:

* ``deterministic-contract-fixture`` predictions validate corpus parsing,
  metric computation, span integrity, and CI thresholds.
* predictions captured from a named model or OCR engine are measured runtime
  evidence and may be used for acceptance decisions.

Contract fixtures must never be reported as OpenMed model or OCR accuracy.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

SUPPORTED_ENTITY_KINDS = frozenset({"condition", "medication"})
CONTRACT_PREDICTION_SOURCE = "deterministic-contract-fixture"


class EvaluationInputError(ValueError):
    """Raised when a gold corpus or prediction file is malformed."""


@dataclass(frozen=True)
class Entity:
    kind: str
    text: str
    start: int
    end: int
    page_number: int | None = None
    confidence: float | None = None

    @property
    def exact_key(self) -> tuple[object, ...]:
        return (
            self.kind,
            self.start,
            self.end,
            self.text,
            self.page_number,
        )


@dataclass(frozen=True)
class NerCase:
    case_id: str
    text: str
    entities: tuple[Entity, ...]


@dataclass(frozen=True)
class OcrPage:
    page_number: int
    start: int
    end: int
    text: str


@dataclass(frozen=True)
class OcrCase:
    case_id: str
    language: str
    reference_text: str
    pages: tuple[OcrPage, ...]


def _load_json(path: str | Path) -> dict[str, Any]:
    source = Path(path)
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except OSError as exc:
        raise EvaluationInputError(f"Could not read {source}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise EvaluationInputError(f"Invalid JSON in {source}: {exc}") from exc
    if not isinstance(value, dict):
        raise EvaluationInputError(f"{source} must contain a JSON object")
    return value


def _required_string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise EvaluationInputError(f"{field} must be a non-empty string")
    return value


def _required_cases(payload: Mapping[str, Any], field: str = "cases") -> list[Any]:
    value = payload.get(field)
    if not isinstance(value, list):
        raise EvaluationInputError(f"{field} must be an array")
    return value


def _integer(value: object, field: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise EvaluationInputError(f"{field} must be an integer >= {minimum}")
    return value


def _optional_number(value: object, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise EvaluationInputError(f"{field} must be numeric")
    result = float(value)
    if result < 0 or result > 1:
        raise EvaluationInputError(f"{field} must be between 0 and 1")
    return result


def _parse_entity(value: object, source_text: str, field: str) -> Entity:
    if not isinstance(value, Mapping):
        raise EvaluationInputError(f"{field} must be an object")
    kind = _required_string(value.get("kind"), f"{field}.kind")
    if kind not in SUPPORTED_ENTITY_KINDS:
        raise EvaluationInputError(
            f"{field}.kind must be one of {sorted(SUPPORTED_ENTITY_KINDS)}"
        )
    text = _required_string(value.get("text"), f"{field}.text")
    start = _integer(value.get("start"), f"{field}.start")
    end = _integer(value.get("end"), f"{field}.end", minimum=1)
    if end <= start or end > len(source_text):
        raise EvaluationInputError(f"{field} has an invalid source interval")
    if source_text[start:end] != text:
        raise EvaluationInputError(
            f"{field}.text does not match source offsets {start}:{end}"
        )
    page_number_value = value.get("page_number")
    page_number = (
        _integer(page_number_value, f"{field}.page_number", minimum=1)
        if page_number_value is not None
        else None
    )
    return Entity(
        kind=kind,
        text=text,
        start=start,
        end=end,
        page_number=page_number,
        confidence=_optional_number(value.get("confidence"), f"{field}.confidence"),
    )


def load_ner_gold(path: str | Path) -> tuple[dict[str, Any], tuple[NerCase, ...]]:
    payload = _load_json(path)
    seen: set[str] = set()
    cases: list[NerCase] = []
    for index, raw_case in enumerate(_required_cases(payload)):
        field = f"cases[{index}]"
        if not isinstance(raw_case, Mapping):
            raise EvaluationInputError(f"{field} must be an object")
        case_id = _required_string(raw_case.get("id"), f"{field}.id")
        if case_id in seen:
            raise EvaluationInputError(f"duplicate case id: {case_id}")
        seen.add(case_id)
        text = _required_string(raw_case.get("text"), f"{field}.text")
        raw_entities = raw_case.get("entities")
        if not isinstance(raw_entities, list):
            raise EvaluationInputError(f"{field}.entities must be an array")
        entities = tuple(
            _parse_entity(entity, text, f"{field}.entities[{entity_index}]")
            for entity_index, entity in enumerate(raw_entities)
        )
        if len({entity.exact_key for entity in entities}) != len(entities):
            raise EvaluationInputError(f"{field}.entities contains duplicates")
        cases.append(NerCase(case_id=case_id, text=text, entities=entities))
    return payload, tuple(cases)


def load_ner_predictions(
    path: str | Path,
    gold_cases: Sequence[NerCase],
) -> tuple[dict[str, Any], dict[str, tuple[Entity, ...]]]:
    payload = _load_json(path)
    gold_by_id = {case.case_id: case for case in gold_cases}
    predictions: dict[str, tuple[Entity, ...]] = {}
    for index, raw_case in enumerate(_required_cases(payload)):
        field = f"cases[{index}]"
        if not isinstance(raw_case, Mapping):
            raise EvaluationInputError(f"{field} must be an object")
        case_id = _required_string(raw_case.get("id"), f"{field}.id")
        if case_id not in gold_by_id:
            raise EvaluationInputError(f"unknown prediction case id: {case_id}")
        if case_id in predictions:
            raise EvaluationInputError(f"duplicate prediction case id: {case_id}")
        raw_entities = raw_case.get("entities")
        if not isinstance(raw_entities, list):
            raise EvaluationInputError(f"{field}.entities must be an array")
        source_text = gold_by_id[case_id].text
        predictions[case_id] = tuple(
            _parse_entity(entity, source_text, f"{field}.entities[{entity_index}]")
            for entity_index, entity in enumerate(raw_entities)
        )
    return payload, predictions


def _safe_ratio(numerator: int | float, denominator: int | float, *, empty: float = 0.0) -> float:
    return float(numerator) / float(denominator) if denominator else empty


def _f1(precision: float, recall: float) -> float:
    return (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )


def _overlap(left: Entity, right: Entity) -> float:
    intersection = max(0, min(left.end, right.end) - max(left.start, right.start))
    denominator = max(left.end - left.start, right.end - right.start)
    return _safe_ratio(intersection, denominator)


def _relaxed_matches(
    gold: Sequence[Entity],
    predicted: Sequence[Entity],
    *,
    minimum_overlap: float = 0.5,
) -> int:
    candidates: list[tuple[float, int, int]] = []
    for gold_index, expected in enumerate(gold):
        for predicted_index, actual in enumerate(predicted):
            if expected.kind != actual.kind:
                continue
            overlap = _overlap(expected, actual)
            if overlap >= minimum_overlap:
                candidates.append((overlap, gold_index, predicted_index))
    candidates.sort(reverse=True)
    matched_gold: set[int] = set()
    matched_predictions: set[int] = set()
    for _score, gold_index, predicted_index in candidates:
        if gold_index in matched_gold or predicted_index in matched_predictions:
            continue
        matched_gold.add(gold_index)
        matched_predictions.add(predicted_index)
    return len(matched_gold)


def evaluate_ner(
    gold_payload: Mapping[str, Any],
    gold_cases: Sequence[NerCase],
    prediction_payload: Mapping[str, Any],
    predictions: Mapping[str, Sequence[Entity]],
) -> dict[str, Any]:
    total_gold = 0
    total_predicted = 0
    exact_true_positive = 0
    relaxed_true_positive = 0
    exact_cases = 0
    page_total = 0
    page_correct = 0
    per_case: list[dict[str, Any]] = []

    for case in gold_cases:
        expected = tuple(case.entities)
        actual = tuple(predictions.get(case.case_id, ()))
        expected_keys = {entity.exact_key for entity in expected}
        actual_keys = {entity.exact_key for entity in actual}
        exact_tp = len(expected_keys & actual_keys)
        relaxed_tp = _relaxed_matches(expected, actual)
        exact = expected_keys == actual_keys

        total_gold += len(expected)
        total_predicted += len(actual)
        exact_true_positive += exact_tp
        relaxed_true_positive += relaxed_tp
        exact_cases += int(exact)

        expected_pages = {
            (entity.kind, entity.start, entity.end): entity.page_number
            for entity in expected
            if entity.page_number is not None
        }
        for entity in actual:
            key = (entity.kind, entity.start, entity.end)
            if key not in expected_pages:
                continue
            page_total += 1
            page_correct += int(entity.page_number == expected_pages[key])

        per_case.append(
            {
                "id": case.case_id,
                "gold_entities": len(expected),
                "predicted_entities": len(actual),
                "exact_true_positive": exact_tp,
                "relaxed_true_positive": relaxed_tp,
                "exact": exact,
            }
        )

    exact_precision = _safe_ratio(
        exact_true_positive,
        total_predicted,
        empty=1.0 if total_gold == 0 else 0.0,
    )
    exact_recall = _safe_ratio(
        exact_true_positive,
        total_gold,
        empty=1.0 if total_predicted == 0 else 0.0,
    )
    relaxed_precision = _safe_ratio(
        relaxed_true_positive,
        total_predicted,
        empty=1.0 if total_gold == 0 else 0.0,
    )
    relaxed_recall = _safe_ratio(
        relaxed_true_positive,
        total_gold,
        empty=1.0 if total_predicted == 0 else 0.0,
    )

    prediction_source = str(prediction_payload.get("prediction_source", "unknown"))
    evidence_class = (
        "contract-fixture"
        if prediction_source == CONTRACT_PREDICTION_SOURCE
        else "measured-runtime-output"
    )

    return {
        "corpus_id": gold_payload.get("corpus_id"),
        "language": gold_payload.get("language"),
        "phi_free": bool(gold_payload.get("phi_free")),
        "prediction_source": prediction_source,
        "model": prediction_payload.get("model"),
        "evidence_class": evidence_class,
        "cases": len(gold_cases),
        "gold_entities": total_gold,
        "predicted_entities": total_predicted,
        "exact_span": {
            "true_positive": exact_true_positive,
            "false_positive": total_predicted - exact_true_positive,
            "false_negative": total_gold - exact_true_positive,
            "precision": exact_precision,
            "recall": exact_recall,
            "f1": _f1(exact_precision, exact_recall),
        },
        "relaxed_overlap": {
            "minimum_overlap": 0.5,
            "true_positive": relaxed_true_positive,
            "precision": relaxed_precision,
            "recall": relaxed_recall,
            "f1": _f1(relaxed_precision, relaxed_recall),
        },
        "exact_case_accuracy": _safe_ratio(exact_cases, len(gold_cases), empty=1.0),
        "page_attribution_accuracy": (
            _safe_ratio(page_correct, page_total, empty=1.0)
            if page_total
            else None
        ),
        "per_case": per_case,
        "limitations": [
            "Contract fixtures validate the evaluator, not model accuracy."
            if evidence_class == "contract-fixture"
            else "Measured runtime output is specific to the named model, threshold, hardware, and corpus.",
            "This synthetic corpus is not clinical validation.",
        ],
    }


def _parse_ocr_page(value: object, reference_text: str, field: str) -> OcrPage:
    if not isinstance(value, Mapping):
        raise EvaluationInputError(f"{field} must be an object")
    page_number = _integer(value.get("page_number"), f"{field}.page_number", minimum=1)
    start = _integer(value.get("start"), f"{field}.start")
    end = _integer(value.get("end"), f"{field}.end", minimum=1)
    text = _required_string(value.get("text"), f"{field}.text")
    if end <= start or end > len(reference_text):
        raise EvaluationInputError(f"{field} has an invalid text interval")
    if reference_text[start:end] != text:
        raise EvaluationInputError(f"{field}.text does not match its offsets")
    return OcrPage(page_number=page_number, start=start, end=end, text=text)


def load_ocr_gold(path: str | Path) -> tuple[dict[str, Any], tuple[OcrCase, ...]]:
    payload = _load_json(path)
    seen: set[str] = set()
    cases: list[OcrCase] = []
    for index, raw_case in enumerate(_required_cases(payload)):
        field = f"cases[{index}]"
        if not isinstance(raw_case, Mapping):
            raise EvaluationInputError(f"{field} must be an object")
        case_id = _required_string(raw_case.get("id"), f"{field}.id")
        if case_id in seen:
            raise EvaluationInputError(f"duplicate OCR case id: {case_id}")
        seen.add(case_id)
        language = _required_string(raw_case.get("language"), f"{field}.language")
        reference_text = _required_string(
            raw_case.get("reference_text"),
            f"{field}.reference_text",
        )
        raw_pages = raw_case.get("pages")
        if not isinstance(raw_pages, list) or not raw_pages:
            raise EvaluationInputError(f"{field}.pages must be a non-empty array")
        pages = tuple(
            _parse_ocr_page(page, reference_text, f"{field}.pages[{page_index}]")
            for page_index, page in enumerate(raw_pages)
        )
        if [page.page_number for page in pages] != list(range(1, len(pages) + 1)):
            raise EvaluationInputError(f"{field}.pages must be sequential from page 1")
        cases.append(
            OcrCase(
                case_id=case_id,
                language=language,
                reference_text=reference_text,
                pages=pages,
            )
        )
    return payload, tuple(cases)


def load_ocr_predictions(
    path: str | Path,
    gold_cases: Sequence[OcrCase],
) -> tuple[dict[str, Any], dict[str, tuple[str, tuple[OcrPage, ...]]]]:
    payload = _load_json(path)
    gold_by_id = {case.case_id: case for case in gold_cases}
    predictions: dict[str, tuple[str, tuple[OcrPage, ...]]] = {}
    for index, raw_case in enumerate(_required_cases(payload)):
        field = f"cases[{index}]"
        if not isinstance(raw_case, Mapping):
            raise EvaluationInputError(f"{field} must be an object")
        case_id = _required_string(raw_case.get("id"), f"{field}.id")
        if case_id not in gold_by_id:
            raise EvaluationInputError(f"unknown OCR prediction case id: {case_id}")
        if case_id in predictions:
            raise EvaluationInputError(f"duplicate OCR prediction case id: {case_id}")
        text = _required_string(raw_case.get("text"), f"{field}.text")
        raw_pages = raw_case.get("pages")
        if not isinstance(raw_pages, list) or not raw_pages:
            raise EvaluationInputError(f"{field}.pages must be a non-empty array")
        pages = tuple(
            _parse_ocr_page(page, text, f"{field}.pages[{page_index}]")
            for page_index, page in enumerate(raw_pages)
        )
        predictions[case_id] = (text, pages)
    return payload, predictions


def _levenshtein(left: Sequence[Any], right: Sequence[Any]) -> int:
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for left_index, left_value in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_value in enumerate(right, start=1):
            insertion = current[right_index - 1] + 1
            deletion = previous[right_index] + 1
            substitution = previous[right_index - 1] + (left_value != right_value)
            current.append(min(insertion, deletion, substitution))
        previous = current
    return previous[-1]


def _words(text: str) -> tuple[str, ...]:
    return tuple(text.split())


def evaluate_ocr(
    gold_payload: Mapping[str, Any],
    gold_cases: Sequence[OcrCase],
    prediction_payload: Mapping[str, Any],
    predictions: Mapping[str, tuple[str, Sequence[OcrPage]]],
) -> dict[str, Any]:
    character_edits = 0
    reference_characters = 0
    word_edits = 0
    reference_words = 0
    exact_text_cases = 0
    exact_page_count_cases = 0
    exact_pages = 0
    total_pages = 0
    per_language: dict[str, dict[str, int]] = {}
    per_case: list[dict[str, Any]] = []

    for case in gold_cases:
        predicted_text, predicted_pages = predictions.get(case.case_id, ("", ()))
        char_edits = _levenshtein(tuple(case.reference_text), tuple(predicted_text))
        reference_word_tokens = _words(case.reference_text)
        predicted_word_tokens = _words(predicted_text)
        case_word_edits = _levenshtein(reference_word_tokens, predicted_word_tokens)
        exact_text = predicted_text == case.reference_text
        exact_page_count = len(predicted_pages) == len(case.pages)

        character_edits += char_edits
        reference_characters += len(case.reference_text)
        word_edits += case_word_edits
        reference_words += len(reference_word_tokens)
        exact_text_cases += int(exact_text)
        exact_page_count_cases += int(exact_page_count)

        language_totals = per_language.setdefault(
            case.language,
            {
                "cases": 0,
                "character_edits": 0,
                "reference_characters": 0,
                "word_edits": 0,
                "reference_words": 0,
                "exact_text_cases": 0,
            },
        )
        language_totals["cases"] += 1
        language_totals["character_edits"] += char_edits
        language_totals["reference_characters"] += len(case.reference_text)
        language_totals["word_edits"] += case_word_edits
        language_totals["reference_words"] += len(reference_word_tokens)
        language_totals["exact_text_cases"] += int(exact_text)

        predicted_by_number = {page.page_number: page for page in predicted_pages}
        page_results: list[dict[str, Any]] = []
        for expected_page in case.pages:
            total_pages += 1
            actual_page = predicted_by_number.get(expected_page.page_number)
            page_exact = bool(actual_page and actual_page.text == expected_page.text)
            exact_pages += int(page_exact)
            page_results.append(
                {
                    "page_number": expected_page.page_number,
                    "exact": page_exact,
                }
            )

        per_case.append(
            {
                "id": case.case_id,
                "language": case.language,
                "character_edits": char_edits,
                "character_error_rate": _safe_ratio(
                    char_edits,
                    len(case.reference_text),
                    empty=0.0,
                ),
                "word_edits": case_word_edits,
                "word_error_rate": _safe_ratio(
                    case_word_edits,
                    len(reference_word_tokens),
                    empty=0.0,
                ),
                "exact_text": exact_text,
                "exact_page_count": exact_page_count,
                "pages": page_results,
            }
        )

    language_reports = {
        language: {
            "cases": values["cases"],
            "character_error_rate": _safe_ratio(
                values["character_edits"],
                values["reference_characters"],
                empty=0.0,
            ),
            "word_error_rate": _safe_ratio(
                values["word_edits"],
                values["reference_words"],
                empty=0.0,
            ),
            "exact_text_accuracy": _safe_ratio(
                values["exact_text_cases"],
                values["cases"],
                empty=1.0,
            ),
        }
        for language, values in sorted(per_language.items())
    }

    prediction_source = str(prediction_payload.get("prediction_source", "unknown"))
    evidence_class = (
        "contract-fixture"
        if prediction_source == CONTRACT_PREDICTION_SOURCE
        else "measured-runtime-output"
    )

    return {
        "corpus_id": gold_payload.get("corpus_id"),
        "phi_free": bool(gold_payload.get("phi_free")),
        "prediction_source": prediction_source,
        "engine": prediction_payload.get("engine"),
        "evidence_class": evidence_class,
        "cases": len(gold_cases),
        "character_error_rate": _safe_ratio(
            character_edits,
            reference_characters,
            empty=0.0,
        ),
        "word_error_rate": _safe_ratio(word_edits, reference_words, empty=0.0),
        "exact_text_accuracy": _safe_ratio(exact_text_cases, len(gold_cases), empty=1.0),
        "exact_page_count_accuracy": _safe_ratio(
            exact_page_count_cases,
            len(gold_cases),
            empty=1.0,
        ),
        "page_text_accuracy": _safe_ratio(exact_pages, total_pages, empty=1.0),
        "languages": language_reports,
        "per_case": per_case,
        "limitations": [
            "Contract fixtures validate the evaluator, not OCR accuracy."
            if evidence_class == "contract-fixture"
            else "Measured OCR output is specific to the named engine, language data, resolution, hardware, and corpus.",
            "OCR character accuracy does not establish clinical NER or assertion-context accuracy.",
        ],
    }


def validate_blocked_corpus(path: str | Path) -> dict[str, Any]:
    payload, cases = load_ner_gold(path)
    return {
        "corpus_id": payload.get("corpus_id"),
        "language": payload.get("language"),
        "phi_free": bool(payload.get("phi_free")),
        "acceptance_status": payload.get("acceptance_status"),
        "cases": len(cases),
        "gold_entities": sum(len(case.entities) for case in cases),
        "prediction_evidence": "not-provided",
        "route_decision": "blocked-pending-measurement",
        "limitations": payload.get("limitations", []),
    }


def evaluate_all(
    *,
    ner_gold_path: str | Path,
    ner_predictions_path: str | Path,
    ocr_gold_path: str | Path,
    ocr_predictions_path: str | Path,
    blocked_ner_gold_path: str | Path | None = None,
) -> dict[str, Any]:
    ner_gold_payload, ner_gold_cases = load_ner_gold(ner_gold_path)
    ner_prediction_payload, ner_predictions = load_ner_predictions(
        ner_predictions_path,
        ner_gold_cases,
    )
    ocr_gold_payload, ocr_gold_cases = load_ocr_gold(ocr_gold_path)
    ocr_prediction_payload, ocr_predictions = load_ocr_predictions(
        ocr_predictions_path,
        ocr_gold_cases,
    )
    return {
        "schema_version": "1",
        "evaluation": "medibrief-phase3-extraction",
        "ner": evaluate_ner(
            ner_gold_payload,
            ner_gold_cases,
            ner_prediction_payload,
            ner_predictions,
        ),
        "ocr": evaluate_ocr(
            ocr_gold_payload,
            ocr_gold_cases,
            ocr_prediction_payload,
            ocr_predictions,
        ),
        **(
            {"blocked_language_corpus": validate_blocked_corpus(blocked_ner_gold_path)}
            if blocked_ner_gold_path
            else {}
        ),
        "interpretation": [
            "Contract-fixture scores prove metric and corpus correctness only.",
            "Only measured-runtime-output may support a model or OCR route decision.",
            "All extracted clinical statements remain candidates requiring human review.",
        ],
    }


def _threshold_failed(report: Mapping[str, Any], args: argparse.Namespace) -> bool:
    ner = report["ner"]
    ocr = report["ocr"]
    if args.require_measured_predictions:
        if ner["evidence_class"] != "measured-runtime-output":
            return True
        if ocr["evidence_class"] != "measured-runtime-output":
            return True
    return any(
        (
            ner["exact_span"]["f1"] < args.minimum_exact_span_f1,
            ner["relaxed_overlap"]["f1"] < args.minimum_relaxed_span_f1,
            ner["exact_case_accuracy"] < args.minimum_exact_case_accuracy,
            ocr["character_error_rate"] > args.maximum_character_error_rate,
            ocr["word_error_rate"] > args.maximum_word_error_rate,
            ocr["page_text_accuracy"] < args.minimum_page_text_accuracy,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ner-gold", required=True)
    parser.add_argument("--ner-predictions", required=True)
    parser.add_argument("--ocr-gold", required=True)
    parser.add_argument("--ocr-predictions", required=True)
    parser.add_argument("--blocked-ner-gold")
    parser.add_argument("--minimum-exact-span-f1", type=float, default=1.0)
    parser.add_argument("--minimum-relaxed-span-f1", type=float, default=1.0)
    parser.add_argument("--minimum-exact-case-accuracy", type=float, default=1.0)
    parser.add_argument("--maximum-character-error-rate", type=float, default=0.0)
    parser.add_argument("--maximum-word-error-rate", type=float, default=0.0)
    parser.add_argument("--minimum-page-text-accuracy", type=float, default=1.0)
    parser.add_argument("--require-measured-predictions", action="store_true")
    parser.add_argument("--output")
    args = parser.parse_args()

    try:
        report = evaluate_all(
            ner_gold_path=args.ner_gold,
            ner_predictions_path=args.ner_predictions,
            ocr_gold_path=args.ocr_gold,
            ocr_predictions_path=args.ocr_predictions,
            blocked_ner_gold_path=args.blocked_ner_gold,
        )
    except EvaluationInputError as exc:
        print(json.dumps({"error": str(exc)}, indent=2))
        return 2

    rendered = json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True)
    print(rendered)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    return 1 if _threshold_failed(report, args) else 0


if __name__ == "__main__":
    raise SystemExit(main())
