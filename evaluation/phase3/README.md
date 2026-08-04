# Phase 3 Extraction Evaluation

This directory contains PHI-free corpora, metric contracts, and examples for measuring MediBrief's Phase 3 extraction pipeline.

## Evidence classes

MediBrief keeps two evidence classes separate.

### Contract fixtures

Files whose `prediction_source` is:

```text
deterministic-contract-fixture
```

validate:

- corpus parsing;
- source-span integrity;
- exact and relaxed NER metrics;
- OCR character and word metrics;
- page attribution;
- CI thresholds;
- provider-comparison plumbing.

They are not output from OpenMed, Gemini, Tesseract, EasyOCR, docTR, PaddleOCR, or another runtime. Their perfect scores must never be reported as model or OCR accuracy.

### Measured runtime output

A measured prediction file must name the actual runtime source, model or OCR engine, threshold, corpus, and capture conditions. It may support a route decision only for that exact configuration and corpus.

Measured output still does not establish clinical validation, and every MediBrief extraction result remains a candidate requiring source review.

## Corpora and examples

| File | Purpose |
|---|---|
| `clinical_ner_en_gold.json` | PHI-free English condition and medication gold spans |
| `clinical_ner_ar_gold.json` | PHI-free Arabic research corpus; application route remains blocked |
| `ocr_gold.json` | PHI-free English and Arabic OCR text/page references |
| `clinical_ner_en_reference_predictions.json` | OpenMed-shaped evaluator contract fixture |
| `clinical_ner_en_gemini_reference_predictions.json` | Gemini-shaped comparison contract fixture |
| `ocr_reference_predictions.json` | OCR evaluator contract fixture |
| `ocr_fixture_manifest.example.json` | Example local file mapping for measured OCR capture |

The repository intentionally does not commit OCR fixture binaries. Local fixture files must be synthetic or otherwise free of personal health information.

## Validate metric contracts

```bash
python -m openmed_bridge.evaluate_extraction \
  --ner-gold evaluation/phase3/clinical_ner_en_gold.json \
  --ner-predictions evaluation/phase3/clinical_ner_en_reference_predictions.json \
  --blocked-ner-gold evaluation/phase3/clinical_ner_ar_gold.json \
  --ocr-gold evaluation/phase3/ocr_gold.json \
  --ocr-predictions evaluation/phase3/ocr_reference_predictions.json
```

A contract-fixture result proves the evaluator and corpus contracts, not live model performance.

## Capture measured OpenMed NER predictions

Start the local OpenMed service, then run:

```bash
python -m openmed_bridge.capture_ner_predictions \
  --gold evaluation/phase3/clinical_ner_en_gold.json \
  --output evaluation/phase3/clinical_ner_en_openmed_measured.json \
  --base-url http://127.0.0.1:8080 \
  --disease-model disease_detection_superclinical \
  --medication-model pharma_detection_superclinical \
  --confidence-threshold 0.6
```

Then evaluate with `--require-measured-predictions`.

Capturing Arabic research output requires the explicit `--allow-unevaluated-language` acknowledgement. That capture does not enable Arabic clinical extraction in the application.

## Capture measured OCR output

1. Copy `ocr_fixture_manifest.example.json` to a local file, such as `ocr_fixture_manifest.local.json`.
2. Create PHI-free PDF/image fixtures whose expected text matches `ocr_gold.json`.
3. Start `openmed_bridge.app:app` with the required OCR backend installed.
4. Run:

```bash
python -m openmed_bridge.capture_ocr_predictions \
  --gold evaluation/phase3/ocr_gold.json \
  --fixtures evaluation/phase3/ocr_fixture_manifest.local.json \
  --output evaluation/phase3/ocr_measured.json \
  --base-url http://127.0.0.1:8080
```

The capture file records the bridge endpoint, engine, per-case extraction outcome, warnings, failed pages, configured OCR languages, and source/derived-text hashes. A case that produces no text is scored as an empty prediction rather than being silently omitted from evaluation.

Evaluate the measured files with:

```bash
python -m openmed_bridge.evaluate_extraction \
  --ner-gold evaluation/phase3/clinical_ner_en_gold.json \
  --ner-predictions evaluation/phase3/clinical_ner_en_openmed_measured.json \
  --blocked-ner-gold evaluation/phase3/clinical_ner_ar_gold.json \
  --ocr-gold evaluation/phase3/ocr_gold.json \
  --ocr-predictions evaluation/phase3/ocr_measured.json \
  --require-measured-predictions
```

Thresholds should be chosen for the intended deployment and documented with the model/engine versions, language data, resolution, and fixture characteristics.

## Compare provider files without merging them

```bash
python -m openmed_bridge.compare_ner_predictions \
  --gold evaluation/phase3/clinical_ner_en_gold.json \
  --provider OpenMed=evaluation/phase3/clinical_ner_en_reference_predictions.json \
  --provider Gemini=evaluation/phase3/clinical_ner_en_gemini_reference_predictions.json
```

The comparison report always records:

```text
merged_predictions: false
winner_selected: false
application_route_changed: false
```

Use `--require-measured-predictions` when a decision must fail unless every provider file is captured runtime output.

## Accepted application language boundary

The application uses a conservative script-and-lexical routing heuristic:

- Latin script alone does not establish English.
- The default English route requires Latin dominance plus multiple distinct English clinical/function-word markers.
- Isolated diagnoses and medication names are not sufficient language evidence.
- Arabic-dominant text may be preserved through OCR but default Arabic clinical NER and English assertion context remain blocked.
- Mixed-script, other non-Latin, and measurement-only text remain blocked from the default local clinical models.

This route intentionally prefers false refusal over applying an unevaluated clinical model to the wrong language.

## Arabic decision

MediBrief separates three capabilities:

1. an OCR engine may recognize Arabic characters;
2. a clinical NER model may identify Arabic conditions and medications;
3. an assertion-context system may resolve Arabic negation, certainty, temporality, and experiencer.

Evidence for one capability does not establish either of the others. The accepted Phase 3 application policy therefore preserves Arabic OCR text and source pages but blocks default Arabic clinical NER and English assertion context until a named Arabic clinical route is measured and reviewed.

## Provider comparison boundary

OpenMed and Gemini prediction files must remain separate. The comparison tooling does not union their spans, create consensus facts, select a provider automatically, or change the user's extraction settings. Any later provider decision must be documented with measured evidence and must preserve the candidate-only review boundary.
