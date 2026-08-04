# MediBrief Phase 3 — OpenMed Extraction Integration

> Living implementation tracker for the local-first, source-linked clinical extraction pipeline.
>
> **Branch:** `agent/phase-3-openmed-extraction`  
> **Base:** `agent/phase-2-personal-health-record`  
> **Started:** 2026-07-31  
> **Accepted:** 2026-07-31  
> **Current focus:** Phase 4 — Laboratory and Diagnostic Report Pipeline

## Phase 3 result

Phase 3 is complete and accepted **for candidate-only clinical extraction**.

It provides:

- local condition and medication NER through OpenMed;
- local assertion-context evidence;
- medication-instruction evidence;
- direct-text, embedded-PDF, OCR, and hybrid document intake;
- page-aware provenance;
- durable extraction status and retries;
- conservative language routing;
- PHI-free evaluation corpora and metric tooling;
- separate OpenMed and Gemini provider comparison;
- final acceptance evidence.

It does not provide autonomous diagnosis, automatic clinical confirmation, validated Arabic clinical NER, or proof of real-world OCR/model accuracy.

Every extracted clinical statement remains:

```text
verificationStatus: candidate
```

Only the existing Clinical Candidate Review can confirm, edit, or reject it.

## Overall status

| Workstream | Status |
|---|---|
| P3.0 — Baseline, branch, and architecture | Complete |
| P3.1 — Local OpenMed client and settings | Complete |
| P3.2 — Direct text intake and NER mapping | Complete |
| P3.3 — Assertion context and medication evidence | Complete for accepted scope |
| P3.4 — Page-aware PDF text and OCR | Complete for accepted scope |
| P3.5 — Language, evaluation, and fallback policy | Complete for accepted scope |
| P3.6 — Acceptance evidence | Complete |
| **Phase 3** | **Accepted and complete** |

---

# Product goal

Phase 3 replaces the narrow cloud-only entity-extraction path with a local-first pipeline while preserving the safety and data-integrity boundaries established in Phases 1 and 2:

- no extracted fact is confirmed automatically;
- the original uploaded file remains authoritative;
- direct text, PDF-derived text, OCR, NER, context, and cloud fallback keep separate provenance;
- page numbers, offsets, bounding boxes, hashes, engines, confidence, and timestamps remain reviewable;
- unsupported, invalid, partial, empty, cancelled, and unavailable outcomes remain explicit;
- retries do not silently duplicate same-source candidates;
- Gemini remains an explicit compatibility fallback rather than a hidden second source of truth.

## Verified integration surface

The implementation is built against:

```text
openmed[hf,service,multimodal]==2.0.0
```

The upstream OpenMed application provides:

```text
GET  /health
POST /analyze
```

MediBrief preserves those routes and adds:

```text
GET  /medibrief/context/health
POST /medibrief/context
GET  /medibrief/documents/health
POST /medibrief/documents/extract
```

The generic `/analyze` response remains NER output. Context and document/OCR evidence are never falsely attributed to the NER model.

---

# Non-negotiable architecture boundaries

- The recommended service binds to `127.0.0.1`.
- OpenMed settings remain independent from the assistant/chat provider.
- A healthy endpoint is not proof that models or OCR engines are loaded, suitable, accurate, or clinically validated.
- Every service response is runtime-validated before mapping.
- Invalid offsets, page intervals, confidence values, hashes, cues, or identities fail closed.
- Source offsets refer to the exact text submitted to NER.
- PDF or image content is never represented as text without a real extraction or OCR step.
- Candidate creation remains patient-scoped and document-scoped.
- The medical record remains usable when OpenMed, context, or OCR is unavailable.
- Default `affirmed`, `certain`, `recent`, and `patient` context is not positive evidence.
- Candidate confirmation remains centralized in the Clinical Candidate Review.

---

# Workstreams

## P3.0 — Baseline, branch, and architecture

Status: `[x] Complete`

- [x] Create the dedicated Phase 3 branch from the accepted Phase 2 head.
- [x] Maintain this implementation tracker.
- [x] Inventory Gemini upload, candidate, provenance, persistence, backup, and review boundaries.
- [x] Verify the OpenMed REST, context-helper, multimodal, CORS, and trusted-host surfaces used by MediBrief.
- [x] Add architecture notes for NER, assertion context, document extraction, and final acceptance.
- [x] Maintain one local setup guide.
- [x] Maintain stacked draft PR #3.

## P3.1 — Local OpenMed client and settings

Status: `[x] Complete`

- [x] Add typed NER, context, document, health, status, settings, and error contracts.
- [x] Add strict Zod validation.
- [x] Normalize HTTP/HTTPS endpoints and reject embedded credentials.
- [x] Add timeout and cancellation.
- [x] Distinguish timeout, cancellation, HTTP failure, unavailable service, malformed response, unsupported input, partial output, and empty output.
- [x] Add Auto, OpenMed-only, and Gemini-only modes.
- [x] Add disease and medication model settings.
- [x] Add confidence, timeout, and keep-alive settings.
- [x] Add local document extraction, OCR policy, OCR engine, OCR languages, and rendering resolution.
- [x] Add independent base-service, context, and document/OCR health checks.
- [x] Persist settings in the encrypted local settings store.

## P3.2 — Direct text intake and NER candidate mapping

Status: `[x] Complete`

- [x] Decode TXT, Markdown, CSV, TSV, JSON, XML, and HTML locally.
- [x] Infer common MIME types when browsers omit them.
- [x] Reject empty, binary, oversized, malformed, or unsupported text.
- [x] Run disease and medication models independently.
- [x] Map supported labels to candidate `ConditionRecord` and `MedicationRecord` resources.
- [x] Ignore unsupported labels while retaining diagnostics.
- [x] Reject invalid spans and source-text mismatches.
- [x] Preserve exact source excerpts, offsets, document identity, model, version, confidence, and extraction time.
- [x] Keep clinical dates explicitly unknown.
- [x] Preserve encrypted persistence, backup, export, source preview, and candidate review.
- [x] Reuse conservative same-source deduplication.
- [x] Exclude all candidates from confirmed summaries and timelines.

## P3.3 — Assertion context and medication evidence

Status: `[x] Complete for accepted scope`

- [x] Add scoped negation evidence.
- [x] Add uncertainty and hypothetical evidence.
- [x] Add historical evidence from cues and section priors.
- [x] Add patient, family, and other-person experiencer evidence.
- [x] Add section labels and offsets.
- [x] Add medication dose, form, route, frequency, PRN condition, and duration where parseable.
- [x] Preserve context-engine provenance separately from NER provenance.
- [x] Preserve raw cues, sections, and medication sigs in amendment history.
- [x] Copy only evidence-backed risk/context signals into candidate fields.
- [x] Keep default positive axes and condition status unknown until review.
- [x] Add context-evidence correction without creating a second confirmation workflow.
- [x] Retain NER candidates with unknown context when context enrichment fails.
- [x] Prevent context-only failure from triggering Gemini fallback.
- [!] Allergy relationship extraction remains deferred.
- [!] Code-status extraction remains deferred to authoritative source-specific workflows.

## P3.4 — Page-aware PDF text and OCR pipeline

Status: `[x] Complete for accepted scope`

- [x] Add local document extraction and health routes.
- [x] Pin the validated multimodal runtime.
- [x] Add page-aware embedded PDF text extraction.
- [x] Detect pages without usable embedded text.
- [x] Add scanned-PDF and image OCR.
- [x] Support embedded-text, OCR, hybrid, and empty methods.
- [x] Preserve page intervals, word spans, bounding boxes, and OCR confidence where available.
- [x] Preserve source-file and derived-text SHA-256 hashes.
- [x] Preserve extraction engine, bridge version, OCR engine, languages, and extraction time.
- [x] Validate page/span/hash/identity contracts before NER.
- [x] Enforce source-size, page-count, base64, and resolution limits.
- [x] Add queued, running, completed, partial, empty, unsupported, failed, and cancelled states.
- [x] Add durable status and retry controls in Documents.
- [x] Report created and duplicate candidates.
- [x] Keep document, NER, context, and Gemini provenance separate.
- [x] Keep upload/import time separate from authored and clinical dates.
- [x] Keep malformed or oversized sources ineligible for cloud fallback.

## P3.5 — Language, quality evaluation, and fallback policy

Status: `[x] Complete for accepted candidate-only scope`

- [x] Add conservative script-based routing before default clinical NER.
- [x] Require meaningful alphabetic evidence so measurement-only text is not misclassified as English.
- [x] Allow the English/default-model route only for Latin-dominant substantive text.
- [x] Preserve Arabic source/OCR text while blocking default Arabic clinical NER and English assertion context.
- [x] Block mixed-script and other non-Latin clinical NER by default.
- [x] Build a PHI-free 12-case English condition/medication corpus.
- [x] Build a PHI-free 6-case Arabic research corpus.
- [x] Build English and Arabic OCR text/page fixtures.
- [x] Add exact-span precision, recall, F1, relaxed overlap, exact-case, and page-attribution metrics.
- [x] Add OCR character-error, word-error, exact-text, page-count, and page-text metrics.
- [x] Add measured-prediction gates that reject contract fixtures when real runtime evidence is required.
- [x] Add a live OpenMed prediction-capture command.
- [x] Add provider comparison that evaluates OpenMed and Gemini independently.
- [x] Prohibit provider span merging, automatic winner selection, and route changes.
- [x] Document that contract fixtures are not model or OCR accuracy.
- [x] Document the difference between OCR language support, clinical NER, assertion context, and Arabic PII support.
- [x] Keep Gemini fallback explicit and provenance-separated.
- [x] Prevent successful empty local extraction, context-only failure, malformed input, and OpenMed-only mode from silently using cloud fallback.
- [x] Define and display the final language boundary in Settings.
- [!] No live OpenMed-versus-Gemini performance winner was selected because separately captured measured outputs were not available.
- [!] No Arabic clinical route was enabled because no accepted measured Arabic clinical-NER/context evidence was available.
- [!] Real-engine OCR quality remains deployment- and corpus-specific.

## P3.6 — Acceptance evidence

Status: `[x] Complete`

- [x] Add client, mapping, routing, fallback, malformed-response, timeout, and cancellation tests.
- [x] Add candidate-only and same-source deduplication tests.
- [x] Add context bridge and evidence-backed assertion tests.
- [x] Add embedded-PDF, scanned-PDF, hybrid-PDF, and image-OCR tests.
- [x] Add document schema, hash, identity, page, bounding-box, and confidence tests.
- [x] Add extraction lifecycle and retry tests.
- [x] Add page-aware NER/context orchestration tests.
- [x] Add language policy and visible settings-boundary tests.
- [x] Add PHI-free NER/OCR metric-contract validation.
- [x] Add separate OpenMed/Gemini comparison-contract validation.
- [x] Extend GitHub Actions across Python, evaluation, TypeScript, tests, and production build.
- [x] Record final acceptance in `docs/architecture/PHASE_3_ACCEPTANCE_EVIDENCE.md`.
- [x] Pass the complete integrated workflow.

---

# Implementation slices

## Slice 1 — Local OpenMed NER foundation

Status: `[x] Complete`

Delivered:

- strict local REST client;
- independent extraction settings;
- direct-text intake;
- condition and medication candidate mapping;
- exact source offsets and provenance;
- explicit Gemini compatibility fallback;
- existing review integration.

Validation at Slice 1:

- 29 TypeScript test files;
- 125 TypeScript tests;
- type-check passed;
- production build passed;
- 1031 modules transformed.

## Slice 2 — Assertion context and medication evidence

Status: `[x] Complete`

Delivered:

- local context bridge;
- negation, uncertainty, temporality, experiencer, and section evidence;
- medication-sig parsing;
- separate NER/context provenance;
- conservative candidate mapping;
- context correction UI;
- English-only context boundary;
- PHI-free synthetic evaluation.

Validation at Slice 2:

- 7 Python tests;
- 6/6 exact assertion cases;
- 24/24 assertion axes;
- 5/5 medication-sig fields;
- 30 TypeScript test files;
- 134 TypeScript tests;
- type-check and build passed;
- 1037 modules transformed.

## Slice 3 — Page-aware PDF text and OCR

Status: `[x] Complete`

Delivered:

- document bridge and health endpoint;
- embedded PDF text by page;
- scanned-PDF and image OCR;
- hybrid document handling;
- page intervals, word spans, bounding boxes, and OCR confidence;
- source and derived hashes;
- durable status and retry UI;
- page-aware candidate provenance;
- same-source retry deduplication.

Validation at Slice 3:

- 12 Python tests;
- 34 TypeScript test files;
- 144 TypeScript tests;
- type-check and build passed;
- 1045 modules transformed.

## Slice 4 — Language evaluation and final acceptance

Status: `[x] Complete`

Delivered:

- broader PHI-free English NER corpus;
- Arabic research corpus with explicit blocked route;
- English and Arabic OCR fixtures;
- NER and OCR metric tooling;
- measured-output gates;
- live OpenMed prediction capture;
- independent OpenMed/Gemini comparison tooling;
- conservative final language policy;
- measurement-only routing correction;
- visible settings boundary;
- evaluation documentation;
- final acceptance report.

Final integrated validation:

| Validation | Result |
|---|---:|
| Python bridge/evaluation tests | **24 / 24 passed** |
| Synthetic assertion cases | **6 / 6 exact** |
| Synthetic assertion axes | **24 / 24 correct** |
| Medication-sig fields | **5 / 5 correct** |
| NER/OCR metric-contract validation | **Passed** |
| OpenMed/Gemini comparison-contract validation | **Passed** |
| TypeScript type-check | **Passed** |
| TypeScript test files | **36 / 36 passed** |
| TypeScript tests | **154 / 154 passed** |
| Vite production build | **Passed** |
| Production modules transformed | **1046** |

The final main application chunk is approximately:

```text
1.99 MB minified
536 kB gzip
```

These bundle observations remain a separate frontend-performance workstream.

---

# Final language and fallback policy

| Source | Local clinical NER | English context | OCR/source preservation | Fallback behavior |
|---|---:|---:|---:|---|
| English-dominant substantive text | Allowed as candidates | Allowed when available | Yes | Normal local route |
| Arabic-dominant text | Blocked | Blocked | Yes | Gemini only through explicit configured compatibility behavior |
| Mixed-script text | Blocked | Blocked | Yes | Explicit compatibility behavior only |
| Other non-Latin text | Blocked | Blocked | Yes | Explicit compatibility behavior only |
| Measurement-only or insufficient alphabetic text | Blocked | Blocked | Yes | Explicit compatibility behavior only |

OCR recognizing Arabic characters does not enable Arabic clinical extraction.

---

# Final acceptance boundary

Phase 3 is accepted because:

- all output remains candidate-only;
- original documents remain authoritative;
- provenance layers remain distinct;
- source spans and pages are reviewable;
- unsupported languages and capabilities are blocked explicitly;
- retries are durable and duplicate-safe;
- provider outputs are not blended;
- contract fixtures cannot be misreported as measured accuracy;
- the complete integrated workflow passes.

Phase 3 does **not** claim:

- clinical validation;
- autonomous diagnosis;
- real-world OCR accuracy;
- Arabic clinical-NER/context support;
- provider superiority;
- allergy or code-status extraction readiness.

See:

- `docs/architecture/PHASE_3_OPENMED_FOUNDATION.md`
- `docs/architecture/PHASE_3_ASSERTION_CONTEXT.md`
- `docs/architecture/PHASE_3_DOCUMENT_EXTRACTION.md`
- `docs/architecture/PHASE_3_ACCEPTANCE_EVIDENCE.md`
- `docs/OPENMED_LOCAL_SETUP.md`
- `evaluation/phase3/README.md`

---

# Decision log

| Decision | Reason |
|---|---|
| Use a local REST sidecar rather than browser model weights. | Avoid further browser-bundle growth and support multiple local inference/OCR backends. |
| Treat `/analyze` as NER rather than full assertion understanding. | Entity spans do not establish assertion context. |
| Keep Gemini as an explicit compatibility fallback. | Preserve legacy coverage without concealing the processing engine. |
| Do not fall back after successful empty extraction. | No entity found is a valid outcome rather than proof of local failure. |
| Store context and document evidence separately. | Preserve engine provenance without silently replacing the clinical-record schema. |
| Keep default positive context axes unknown. | OpenMed defaults are not affirmative patient evidence. |
| Auto-OCR only pages without usable embedded text. | Preserve native text while recovering scanned pages. |
| Hash original bytes and derived text separately. | Distinguish source identity from extraction output. |
| Track extraction status outside clinical resources. | Operational state is not a clinical fact. |
| Use source-aware deduplication on retry. | Recovery must not create duplicate patient facts. |
| Require meaningful alphabetic evidence for language routing. | Unit suffixes must not turn numeric measurements into an English clinical note. |
| Block Arabic and mixed-script default clinical NER. | OCR/script support does not establish clinical entity or assertion accuracy. |
| Compare providers independently and select no automatic winner. | Prevent hidden blending and unsupported performance claims. |
| Defer allergy and code-status extraction. | Neither domain has an accepted authoritative measured path. |

---

# Deferred work after Phase 3

- Desktop packaging that installs and supervises the OpenMed bridge.
- Browser/WebGPU inference as an alternative local runtime.
- Real-engine OCR benchmarks by operating system and document family.
- Handwriting, table, rotation, stamp, and low-quality scan evaluation.
- Separately captured OpenMed and Gemini measured-provider comparison.
- A measured Arabic clinical-NER and Arabic assertion-context route.
- Allergy relationship extraction.
- Authoritative code-status extraction.
- Frontend bundle splitting and dependency modernization.

---

# Next phase

The next top-level phase is:

> **Phase 4 — Laboratory and Diagnostic Report Pipeline**

Recommended first slice:

1. durable report-level intake;
2. `DiagnosticReport → Observation[] → Specimen → source document` relationships;
3. collection date versus result date;
4. original and normalized values/units;
5. qualitative and comparator results;
6. report-level human review before confirmation.
