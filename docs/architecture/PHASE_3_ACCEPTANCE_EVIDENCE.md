# Phase 3 Acceptance Evidence — Local Clinical Extraction

## Acceptance decision

Phase 3 is accepted **as a local, candidate-only medical-document extraction pipeline**.

It is not accepted as:

- an autonomous diagnosis system;
- an automatic medication-list reconciler;
- a clinical coding authority;
- a substitute for reviewing the original source;
- a validated Arabic clinical-NER or assertion-context system;
- proof that a configured OCR engine is accurate on a particular document;
- proof that OpenMed or Gemini is more accurate than another provider;
- a general-purpose language detector.

Every extracted clinical statement remains:

```text
verificationStatus: candidate
```

The existing Clinical Candidate Review remains the only workflow that can confirm, edit, or reject an extracted statement.

## Accepted architecture

The accepted local pipeline is:

```text
Original local file
        ↓
Direct text / embedded PDF text / local OCR
        ↓
Strict derived-text, page, hash, and offset validation
        ↓
Conservative language-route assessment
        ↓
OpenMed condition and medication NER when eligible
        ↓
Evidence-backed English assertion-context enrichment when eligible
        ↓
Candidate clinical resource with separate provenance layers
        ↓
Human source review
        ↓
Confirm / edit / reject
```

The original uploaded file remains authoritative. Derived text, OCR geometry, confidence values, NER spans, and assertion context are secondary review evidence.

## Accepted language policy

| Source evidence | Local OCR | Default condition/medication NER | English assertion context | Application decision |
|---|---:|---:|---:|---|
| Latin-dominant text with sufficient English routing evidence | Optional | Allowed for candidate generation | Allowed when the bridge is available | Candidate-only English route |
| Latin-dominant text without sufficient English routing evidence | Optional | Blocked | Blocked | Preserve source text; route remains unverified |
| Arabic-dominant text | Allowed when the selected OCR engine supports it | Blocked | Blocked | Preserve source text and pages; create no default local clinical candidates |
| Mixed Latin/Arabic or other mixed-script text | Allowed when supported | Blocked | Blocked | Preserve for manual review |
| Other non-Latin text | Allowed when supported | Blocked | Blocked | Preserve for manual review |
| Numeric, punctuation, or measurement-only text | Not relevant or optional | Blocked | Blocked | Language route remains undetermined |

The router is deliberately a **script-and-lexical heuristic**, not a claim of comprehensive language identification.

Latin script alone does not establish English. Isolated diagnoses and medication names are not language evidence because many clinical terms are shared internationally. The English/default-model route requires multiple distinct English clinical or function-word markers in addition to Latin-script dominance.

A small amount of non-Latin notation in a substantive English note does not block the English route. A single unit suffix, such as the `C` in a temperature measurement, is not enough evidence to classify a measurement-only string as English.

## Why Arabic clinical extraction remains blocked

Phase 3 separates three capabilities:

1. recognizing Arabic characters with OCR;
2. detecting Arabic clinical entities such as conditions and medications;
3. resolving Arabic negation, certainty, temporality, and experiencer.

Evidence for one capability does not establish the others.

The repository includes a PHI-free Arabic clinical-NER gold corpus and metric tooling, but no accepted measured prediction file from a named Arabic clinical model. The accepted application route therefore remains:

```text
Arabic OCR/source preservation: allowed when available
Arabic default clinical NER: blocked
Arabic English-context bridge: blocked
```

Research predictions can be captured only with an explicit unevaluated-language acknowledgement. Capturing them does not change application routing.

## Evaluation evidence classes

### Contract fixtures

Reference prediction files validate:

- corpus parsing;
- exact source spans;
- exact and relaxed NER metrics;
- OCR character-error rate;
- OCR word-error rate;
- page-text and page-count checks;
- CI thresholds;
- provider-comparison plumbing.

They are marked:

```text
prediction_source: deterministic-contract-fixture
```

Perfect scores from these files are contract evidence only. They must not be reported as OpenMed, Gemini, or OCR-engine accuracy.

### Measured runtime output

The evaluators also accept measured files captured from a named model or OCR engine. Measured output is specific to its:

- model or engine;
- version;
- confidence threshold;
- language data;
- rendering resolution;
- service configuration;
- hardware;
- corpus.

The `--require-measured-predictions` gates fail when contract fixtures are supplied where measured evidence is required.

Phase 3 architecture acceptance does not pretend that deployment-specific runtime accuracy was measured in CI. Instead, it provides reproducible capture and scoring tools while preserving conservative application routing.

## PHI-free evaluation assets

The Phase 3 evaluation workspace contains:

- a 12-case English condition/medication span corpus with 20 gold entities;
- a 6-case Arabic research corpus with 10 gold entities whose application route remains blocked;
- four English and Arabic OCR text/page references;
- exact-span OpenMed-shaped contract predictions;
- separate Gemini-shaped contract predictions;
- OCR contract predictions;
- a live OpenMed NER prediction-capture command;
- a live local document-bridge OCR prediction-capture command;
- an example PHI-free OCR fixture manifest;
- independent NER and OCR metric evaluators;
- a provider comparison command.

These assets make future measured evaluation reproducible without weakening the current application boundary.

## Live measurement commands

Measured OpenMed NER output can be captured from a running local service with:

```bash
python -m openmed_bridge.capture_ner_predictions \
  --gold evaluation/phase3/clinical_ner_en_gold.json \
  --output evaluation/phase3/clinical_ner_en_openmed_measured.json \
  --base-url http://127.0.0.1:8080
```

Measured OCR output can be captured from the local document bridge with:

```bash
python -m openmed_bridge.capture_ocr_predictions \
  --gold evaluation/phase3/ocr_gold.json \
  --fixtures evaluation/phase3/ocr_fixture_manifest.local.json \
  --output evaluation/phase3/ocr_measured.json \
  --base-url http://127.0.0.1:8080
```

Fixture files must be PHI-free and match the committed gold text exactly. Capturing Arabic OCR output does not enable Arabic clinical NER or context.

## Provider comparison boundary

OpenMed and Gemini are evaluated as separate providers against the same gold spans.

The comparison report always records:

```text
merged_predictions: false
winner_selected: false
application_route_changed: false
```

The comparison tool does not:

- union provider spans;
- create consensus medical facts;
- hide which provider produced a candidate;
- automatically choose a provider;
- change the user's extraction settings;
- report contract fixtures as provider performance.

A real provider decision requires separately captured measured outputs and explicit review of precision, recall, span correctness, failure modes, cost, privacy, and operational availability.

## Fallback policy

Gemini remains a compatibility fallback, not a hidden co-extractor.

Fallback is possible only when all of these are true:

- extraction mode is `Auto`;
- the user explicitly enabled Gemini fallback;
- local document or NER extraction is unsupported or unavailable.

Fallback is not triggered by:

- a successful local extraction with no mapped entities;
- context-bridge failure after successful NER;
- malformed or oversized input;
- explicit OpenMed-only mode.

Gemini candidates retain separate cloud-extraction provenance.

## Accepted provenance layers

Each candidate can preserve distinct evidence for:

1. original document identity;
2. direct, embedded-PDF, OCR, or hybrid text derivation;
3. page and character offsets;
4. word bounding boxes and OCR confidence where available;
5. source-file and derived-text hashes;
6. language-route evidence;
7. OpenMed NER model and confidence;
8. assertion-context engine, cues, sections, and medication instructions;
9. human review corrections and amendments.

OCR confidence is never represented as NER confidence, assertion context is never attributed to the NER model, and a script heuristic is never represented as clinical-model evidence.

## Failure and recovery acceptance

The accepted document lifecycle includes:

```text
queued
running
completed
partial
empty
unsupported
failed
cancelled
```

Retries preserve attempt counts, warnings, hashes, and candidate counts. Same-source candidate identity includes the document, derived-text hash, model, kind, offsets, and normalized text so an identical retry is reported as a duplicate rather than creating another medical assertion.

## Final validation result

The complete Slice 4 branch state at commit:

```text
f2776dfc3c8e76795193d7e35285faccfedddb43
```

passed GitHub Actions run **449** on Ubuntu 24.04 with Python 3.12 and Node.js 24.

| Validation | Result |
|---|---:|
| Python bridge, capture, comparison, and evaluation tests | **24 / 24 passed** |
| Synthetic English assertion cases | **6 / 6 exact** |
| Synthetic assertion axes | **24 / 24 correct** |
| Synthetic medication-sig fields | **5 / 5 correct** |
| English NER metric-contract corpus | **12 cases / 20 gold entities** |
| Arabic blocked-route corpus | **6 cases / 10 gold entities** |
| OCR metric-contract corpus | **4 cases: 3 English / 1 Arabic** |
| NER/OCR metric-contract validation | **Passed** |
| Separate OpenMed/Gemini comparison-contract validation | **Passed** |
| TypeScript type-check | **Passed** |
| TypeScript test files | **36 / 36 passed** |
| TypeScript tests | **154 / 154 passed** |
| Vite production build | **Passed** |
| Production modules transformed | **1046** |
| Main application chunk | **1,987.55 kB minified / 536.37 kB gzip** |

The deterministic contract fixtures reported exact-span and relaxed-span F1 of `1.0`, OCR CER/WER of `0.0`, and page-text accuracy of `1.0`. Those values validate the corpus, schemas, evaluator, and CI thresholds only. They are not measured OpenMed, Gemini, or OCR-engine accuracy.

The provider-comparison contract also confirmed:

```text
comparison_evidence: contract-only
merged_predictions: false
winner_selected: false
application_route_changed: false
```

## Defect found during final validation

An early Slice 4 CI run exposed a false-negative source-order assertion. The test searched for the first occurrence of `analyzeOpenMedText`, matched the import near the top of the module, and incorrectly concluded that the language guard ran after model inference.

The regression test now scopes its search to `extractOpenMedCandidatesFromUpload` and verifies that the concrete language-block branch appears before the concrete awaited model call. Production behavior was already correctly ordered; the test now checks the intended boundary accurately.

## Known limitations retained after acceptance

- Contract fixtures do not measure real OpenMed, Gemini, or OCR accuracy.
- Deployment OCR availability remains engine- and operating-system-specific.
- Real medical scans, handwriting, stamps, rotated pages, dense tables, and poor contrast remain unvalidated.
- English model quality remains model-, version-, threshold-, and corpus-specific.
- The script-and-lexical router can decline ambiguous English text; this is a deliberate fail-closed tradeoff.
- Arabic clinical NER and Arabic assertion context remain unsupported.
- Mixed-script clinical extraction remains unsupported.
- Allergy relationship extraction remains deferred.
- Code-status extraction remains deferred to authoritative source-specific workflows.
- Extracted dates remain unknown unless explicitly and safely parsed in a later workflow.

These limitations are compatible with Phase 3 acceptance because no extraction result becomes a current patient fact without human review.

## Known non-blocking build observations

The successful production build still reports:

- a main JavaScript chunk above Vite's default 500 kB warning threshold;
- mixed static and dynamic imports for `uuid` and blob storage;
- runtime resolution of `/index.css`;
- Recharts 2.x outside its active maintenance line;
- deprecation warnings from Node runtimes embedded in some GitHub Actions.

These remain dependency and frontend-performance workstreams. They do not change candidate isolation, provenance, local extraction failure behavior, language blocking, or the review boundary.

## Phase transition

Phase 3 provides the extraction and review substrate needed by Phase 4.

The next top-level phase is:

> **Phase 4 — Laboratory and Diagnostic Report Pipeline**

Phase 4 should turn reviewed report content into connected `DiagnosticReport`, `Observation`, and `Specimen` resources while preserving original values, qualitative results, comparators, collection and result dates, reference-range context, corrections, panels, and source-page relationships.
