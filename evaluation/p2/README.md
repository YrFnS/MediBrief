# P2 Multilingual Clinical-Document Evaluation

This directory contains a PHI-free engineering corpus and metric contract for MediBrief's multilingual medical-document validation work.

## What is represented

The corpus includes synthetic English, Arabic, and mixed-script examples across:

- discharge summaries;
- laboratory reports;
- medication lists;
- prescriptions;
- imaging reports;
- clinical notes;
- deliberately degraded scan-derived text.

Each case records the expected language route, exact fact spans, assertion context, dates, and quantities. The evaluator reports exact entity precision/recall/F1, unsupported additions, omissions, language-route accuracy, assertion-axis accuracy, date accuracy, and quantity accuracy, grouped by language and document type.

## Contract fixture versus measured output

`multilingual_contract_predictions.json` uses:

```text
prediction_source: deterministic-contract-fixture
```

It mirrors the gold data so CI can verify parsing, grouping, metrics, thresholds, and retained evidence. Its perfect score is **not** model accuracy, OCR accuracy, clinical validation, or evidence that Arabic/mixed-script extraction should be enabled.

A future measured prediction file must identify the actual model or OCR engine, version, thresholds, language data, runtime configuration, source fixtures, and capture conditions. Use `--require-measured-predictions` for a decision gate that must reject contract fixtures.

## Run the contract gate

```bash
python -m openmed_bridge.evaluate_multilingual_documents \
  --gold evaluation/p2/multilingual_clinical_documents_gold.json \
  --predictions evaluation/p2/multilingual_contract_predictions.json \
  --require-contract-fixture \
  --output p2-evidence/multilingual-document-report.json
```

## Safety boundary

The current application policy remains fail-closed:

- English/default clinical NER is available only through its evaluated route.
- Arabic OCR text can be preserved, but Arabic clinical NER and Arabic assertion context remain blocked until a named route has measured evidence and review approval.
- Mixed-script clinical NER remains blocked.
- A terminology mapping is never proof that a clinical statement is true.
- Extracted information remains a candidate until source review and explicit confirmation.
- Synthetic evaluation is engineering evidence, not prospective clinical validation or regulatory clearance.
