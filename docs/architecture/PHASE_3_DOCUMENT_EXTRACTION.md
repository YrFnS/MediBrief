# Phase 3 Local Document Text and OCR Pipeline

## Purpose

This document describes Phase 3 Slice 3: page-aware local text derivation for PDFs and images before OpenMed NER and assertion-context review.

Slice 3 adds:

- embedded PDF text extraction;
- scanned-PDF page OCR;
- image OCR;
- hybrid documents containing embedded-text and OCR pages;
- page and character-offset provenance;
- bounding boxes and OCR confidence where available;
- source and derived-text hashes;
- durable extraction status and retry controls;
- same-source duplicate protection;
- separate document, NER, context, and cloud-fallback provenance.

It does not make derived text authoritative, confirm extracted facts, estimate OCR accuracy on real medical documents, or turn import time into a clinical date.

## Safety boundary

The original uploaded file remains the authoritative source.

Derived text is secondary review evidence because:

- embedded PDF text may have reading-order or encoding defects;
- OCR may omit, merge, split, or substitute characters;
- tables, handwriting, stamps, low contrast, rotation, and page geometry may reduce quality;
- an OCR confidence score is engine-specific and does not establish clinical correctness.

Every clinical statement extracted from derived text remains:

```text
verificationStatus: candidate
```

Only the existing Clinical Candidate Review can confirm or reject it.

## Local bridge architecture

`openmed_bridge.app` imports the upstream OpenMed FastAPI application and preserves:

```text
GET  /health
POST /analyze
```

It also preserves the Slice 2 context routes:

```text
GET  /medibrief/context/health
POST /medibrief/context
```

Slice 3 adds:

```text
GET  /medibrief/documents/health
POST /medibrief/documents/extract
```

The browser therefore uses one loopback origin and one CORS/trusted-host policy for document derivation, NER, and context.

## Runtime dependency boundary

The validated bridge requirements pin:

```text
openmed[hf,service,multimodal]==2.0.0
```

The document adapter loads OpenMed's public multimodal APIs dynamically. If the multimodal package or a requested OCR backend is unavailable, the health endpoint and extraction response report the limitation instead of pretending OCR exists.

Available OCR engines are detected at runtime. The application supports selecting:

- auto;
- docTR;
- Tesseract;
- EasyOCR;
- PaddleOCR.

Engine-specific model files, Python dependencies, language data, or system binaries remain deployment concerns. Repository tests validate the adapter with deterministic injected engines; they do not certify a host installation.

## Request contract

A document request contains:

```json
{
  "document_id": "document-storage-1",
  "file_name": "report.pdf",
  "mime_type": "application/pdf",
  "document_base64": "...",
  "ocr_mode": "auto",
  "ocr_engine": "auto",
  "languages": ["en"],
  "resolution": 200
}
```

Validation rejects:

- blank identifiers, filenames, or MIME types;
- invalid or empty base64;
- decoded input above 10 MiB;
- PDFs above 200 pages;
- unsupported source families;
- OCR modes or engines outside the declared enum;
- rendering resolution outside 72–400 DPI.

Rejected input creates no derived clinical candidate.

## Response contract

A successful or partial response preserves:

- stable document ID;
- original filename and MIME type;
- source-file SHA-256;
- exact derived text;
- derived-text SHA-256;
- overall method;
- page count;
- page-level intervals and methods;
- word-level source spans;
- bounding boxes where available;
- OCR confidence where available;
- warnings and failed pages;
- extraction engine and bridge version;
- evaluation timestamp;
- configured OCR engine and languages.

The TypeScript client validates that:

- page intervals are ordered and inside the exact returned text;
- source spans are inside the exact returned text;
- page numbers are valid;
- hashes have the expected format;
- confidence values stay between zero and one;
- bounding boxes contain four finite values;
- the returned document identity matches the request.

Malformed responses fail closed and are not passed to NER.

## PDF processing strategy

### Embedded-text inspection

OpenMed's PDF extraction output is converted into page-indexed word evidence. Each word retains its source page and bounding box when available.

A page is considered to have usable embedded text when its non-whitespace character count meets the conservative threshold used by the adapter.

### Auto OCR policy

In Auto mode:

- pages with usable embedded text remain embedded-text pages;
- pages without usable embedded text are rasterized and sent to OCR;
- successful embedded and OCR pages are assembled into a hybrid document;
- failed pages remain explicit.

This avoids unnecessarily OCRing every text-bearing page while still recovering scanned pages in mixed documents.

### Always OCR policy

Every PDF page is rasterized and processed by OCR. Embedded text is not treated as the chosen evidence path for those pages.

### Never OCR policy

Only embedded PDF text is used. Pages without usable embedded text remain empty and produce warnings.

## Image processing strategy

Supported image families are sent directly to the configured OpenMed OCR interface. The result is represented as a one-page document with page number 1, word-level offsets, bounding boxes, and confidence where provided.

An empty OCR result remains empty. It is not converted into a claim that the image contains no clinical information.

## Page assembly and offsets

The adapter assembles pages in page order.

Two newline characters separate adjacent pages:

```text
page 1 text\n\npage 2 text
```

Every page record contains:

- `page_number`;
- `start` and `end` in the assembled text;
- extraction method;
- word count;
- character count;
- engine;
- optional average and minimum OCR confidence.

Every source span contains:

- `start` and `end` in the same assembled text;
- page number;
- method;
- optional bounding box;
- optional OCR confidence.

NER offsets therefore refer to the exact derived text submitted to `/analyze`, while the associated page evidence allows the reviewer to return to the original source page.

## Extraction methods

The document result uses:

| Method | Meaning |
|---|---|
| `embedded-pdf` | All useful text came from embedded PDF text |
| `ocr` | All useful text came from OCR |
| `hybrid` | At least one embedded-text page and one OCR page contributed |
| `none` | No usable derived text was produced |

Direct browser-decoded text continues to use `local-text` in the TypeScript document contract.

## Durable extraction status

Document extraction is tracked independently from clinical resources with:

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

The status record preserves:

- patient and document identity;
- filename, MIME type, and storage ID;
- attempt count;
- timestamps;
- extraction method;
- page and character counts;
- hashes;
- OCR engine and languages;
- warnings and failed pages;
- created and duplicate candidate counts;
- whether cloud compatibility fallback was used;
- a user-facing diagnostic message.

The Documents module renders this state and exposes retry for recoverable outcomes.

## Retry and idempotency

A retry starts a new extraction attempt for the same document but does not assume the previous run was absent.

OpenMed candidate external identity includes:

- source document ID;
- resource kind;
- model;
- derived-text hash;
- character start and end offsets;
- normalized entity text.

The clinical store then applies its existing conservative same-source deduplication. The extraction status reports created and skipped duplicate counts rather than presenting every retry as new clinical information.

A genuinely changed source file or changed derived-text hash remains distinguishable from an identical retry.

## Candidate provenance layers

Slice 3 keeps four processing layers distinct.

### Original document

The confirmed `DocumentReferenceRecord` states only that the user uploaded and stored the file. Upload confirmation does not confirm claims inside the file.

### Document derivation evidence

Stored in the candidate's amendment history under:

```text
previousValues.openMedDocumentEvidence
```

It preserves page, method, hashes, coordinates, OCR confidence, engine, languages, bridge version, and extraction time.

### NER provenance

Stored in:

```text
resource.provenance.extraction
```

with engine:

```text
OpenMed local REST NER
```

### Assertion-context evidence

Stored separately under:

```text
previousValues.openMedContextEvidence
```

It preserves raw assertion output, scoped cues, sections, experiencer evidence, and medication sigs.

### Gemini compatibility provenance

When explicitly allowed fallback is used, Gemini candidates retain their own external system, engine, tags, and cloud provenance. They are never labelled as OpenMed or OCR results.

## Conservative assertion mapping

Page-aware document derivation does not weaken Slice 2's assertion policy.

OpenMed's default `affirmed`, `certain`, `recent`, and `patient` values remain review evidence rather than positive proof. MediBrief copies only supported evidence-backed signals such as scoped negation, uncertainty, historical/hypothetical cues, or non-default experiencer evidence.

Other axes remain unknown, condition status remains unknown, and the candidate remains unconfirmed.

## Failure and fallback behavior

### Local extraction failure

Invalid, malformed, oversized, or unsafe input fails closed and is not eligible for cloud fallback.

### Unsupported or unavailable local extraction

Auto mode may use Gemini compatibility fallback only when:

- the local result is `unsupported` or `unavailable`;
- fallback is explicitly enabled;
- a Gemini key is configured.

### Successful empty extraction

An empty local result is a valid outcome and does not trigger cloud fallback.

### Context-only failure

If document derivation and NER succeed but context fails, NER candidates remain available with unknown assertion axes. Context failure alone does not trigger Gemini.

### Partial document result

Successful pages remain available, while warnings and failed page numbers stay visible. The result is not silently upgraded to complete.

## Privacy and resource controls

- The recommended service binds to `127.0.0.1`.
- The browser sends the file to the local bridge, not directly to a cloud provider in OpenMed-only mode.
- The bridge writes a temporary local file for extraction and removes it when the request finishes.
- Source size and page-count limits reduce accidental resource exhaustion.
- OCR resolution is bounded.
- The original file remains in MediBrief's local encrypted/source storage; the bridge does not become the document store.

Loopback is a deployment recommendation, not a guarantee. Binding to a public interface requires deliberate authentication, TLS, firewall, trusted-host, and access-control design.

## User interface

Settings provide:

- local document extraction enable/disable;
- OCR policy;
- OCR engine;
- OCR languages;
- OCR resolution;
- document bridge health testing.

The Documents module provides:

- current run state;
- method and page counts;
- warnings and failed pages;
- candidate and duplicate counts;
- explicit fallback status;
- retry control;
- reminders that the original file is authoritative.

Candidate source review continues to use the original stored document and page reference rather than treating derived text as the sole source.

## Validation evidence

The completed Slice 3 workflow passed:

- Python bridge tests: **12 / 12**;
- synthetic English assertion cases: **6 / 6 exact**;
- synthetic assertion axes: **24 / 24 correct**;
- synthetic medication-sig fields: **5 / 5 correct**;
- TypeScript type-check: passed;
- TypeScript test files: **34 / 34**;
- TypeScript tests: **144 / 144**;
- production build: passed;
- production modules transformed: **1045**.

Document-specific coverage verifies:

- embedded PDF page and character offsets;
- scanned-PDF OCR;
- hybrid embedded/OCR documents;
- image OCR page evidence;
- bounding boxes and confidence;
- source and text hashes;
- invalid base64 and unsupported inputs;
- strict client response validation;
- cancellation and unavailable-service behavior;
- document status lifecycle;
- page-aware NER/context orchestration;
- same-source retry deduplication;
- separate document, NER, context, and Gemini provenance.

## Validation limitations

The document tests use deterministic synthetic document and OCR objects. This validates contracts, orchestration, provenance, status, offsets, and failure behavior, but it does not:

- prove that a deployment has an OCR backend installed;
- measure OCR character accuracy;
- measure page-layout or table reconstruction quality;
- validate handwriting recognition;
- validate English or Arabic clinical NER on real documents;
- constitute clinical validation.

Every deployment must check `/medibrief/documents/health` and test representative non-sensitive files using the intended local OCR engine and language data.

## Deferred work

Slice 4 remains responsible for:

- a broader PHI-free English extraction corpus;
- a measured Arabic clinical NER/context decision;
- entity precision, recall, and span correctness;
- OCR quality fixtures across representative layouts;
- explicit per-language routing policy;
- comparison with Gemini compatibility output without mixing provenance;
- final Phase 3 acceptance evidence.
