# Run OpenMed Locally for MediBrief

MediBrief Phase 3 uses one local REST service for named-entity recognition, advisory assertion context, PDF text extraction, and image/scanned-page OCR.

The default endpoint is:

```text
http://127.0.0.1:8080
```

Keep the service on loopback for a normal personal installation and allow only the exact MediBrief browser origin.

## What the MediBrief bridge adds

The upstream OpenMed application continues to provide:

```text
GET  /health
POST /analyze
```

MediBrief imports that application and adds:

```text
GET  /medibrief/context/health
POST /medibrief/context
GET  /medibrief/documents/health
POST /medibrief/documents/extract
```

The context endpoints expose OpenMed's deterministic clinical-context helpers. The document endpoints expose page-aware embedded PDF text and configured local OCR. None of these endpoints confirms or rejects a clinical fact.

## 1. Create a Python environment

OpenMed 2.0 requires Python 3.10 or newer.

```bash
python -m venv .venv
```

Activate it:

```bash
# Linux / macOS
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

## 2. Install the validated bridge runtime

Run this from the MediBrief repository root:

```bash
python -m pip install --upgrade pip
python -m pip install -r openmed_bridge/requirements.txt
```

The requirements file pins the validated runtime:

```text
openmed[hf,service,multimodal]==2.0.0
```

The extras provide:

- Hugging Face inference support for the configured NER models;
- the upstream OpenMed REST service;
- OpenMed multimodal PDF and OCR interfaces.

Some OCR engines may also require engine-specific Python packages, local model files, or system binaries. The document health endpoint reports which engines are actually available in the running environment. A successful package installation alone is not proof that OCR is operational.

The first use of a model or OCR backend may download model files. For an air-gapped installation, prepare the model directories and OCR dependencies before disconnecting the machine.

## 3. Start the extended local service

For the normal Vite development origin:

```bash
OPENMED_SERVICE_CORS_ORIGINS=http://localhost:5173 \
OPENMED_SERVICE_TRUSTED_HOSTS=127.0.0.1,localhost \
uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080
```

PowerShell:

```powershell
$env:OPENMED_SERVICE_CORS_ORIGINS = "http://localhost:5173"
$env:OPENMED_SERVICE_TRUSTED_HOSTS = "127.0.0.1,localhost"
uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080
```

Use the exact origin shown in the browser address bar. These are different origins:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Do not bind to `0.0.0.0` for a personal setup unless network exposure is intentional and authentication, TLS, firewall rules, trusted hosts, and access logging have been designed.

### Starting only the upstream OpenMed app

This command still supports `/health` and `/analyze`:

```bash
uvicorn openmed.service.app:app --host 127.0.0.1 --port 8080
```

It does **not** provide MediBrief's context or document endpoints. Start `openmed_bridge.app:app` for the complete Phase 3 pipeline.

## 4. Optional NER model preload

Preloading can reduce first-request delay:

```bash
OPENMED_SERVICE_CORS_ORIGINS=http://localhost:5173 \
OPENMED_SERVICE_TRUSTED_HOSTS=127.0.0.1,localhost \
OPENMED_SERVICE_PRELOAD_MODELS=disease_detection_superclinical,pharma_detection_superclinical \
OPENMED_SERVICE_MAX_RESIDENT_MODELS=2 \
uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080
```

Preload success means the service attempted to prepare the named models. It does not establish that the models are suitable for a document language or clinically validated for a patient.

## 5. Verify all service layers

### Base OpenMed service

```bash
curl http://127.0.0.1:8080/health
```

A healthy service normally reports `ok` or `ready`.

### Assertion-context bridge

```bash
curl http://127.0.0.1:8080/medibrief/context/health
```

A healthy response lists advisory features such as negation, certainty, temporality, experiencer, section context, and medication-sig parsing.

### Document and OCR bridge

```bash
curl http://127.0.0.1:8080/medibrief/documents/health
```

Check these fields:

- `status` — whether the local multimodal adapter can load;
- `features` — embedded PDF text, page provenance, image OCR, and scanned-PDF OCR;
- `available_ocr_engines` — engines detected in this environment;
- `ocr_available` — whether at least one OCR engine is available.

The health response confirms capability discovery only. It does not prove accuracy on a particular scan, language, handwriting style, table, or medical form.

### Verify from MediBrief

1. Open **Settings**.
2. Find **Clinical document extraction**.
3. Select **Auto** or **OpenMed only**.
4. Keep the endpoint at `http://127.0.0.1:8080`.
5. Select **Test local service**.
6. Select **Test context bridge**.
7. Select **Test document bridge**.

## 6. Default NER models

Default disease model:

```text
disease_detection_superclinical
```

Default medication model:

```text
pharma_detection_superclinical
```

MediBrief calls the two models independently and maps only recognized condition and medication labels. Every result remains a candidate requiring review.

## 7. Supported source files

### Files decoded directly in the browser

- TXT
- Markdown
- CSV and TSV
- JSON
- XML
- HTML source text

### Files handled by the local document bridge

- PDF documents
- BMP
- GIF
- JPEG/JPG
- PNG
- TIFF
- WebP

The bridge currently enforces conservative limits:

- maximum decoded document size: **10 MiB**;
- maximum PDF pages: **200**;
- OCR rendering resolution: configurable from **72 to 400 DPI**, with a default of **200 DPI**.

A rejected size, page count, malformed base64 payload, or unsupported file family fails closed and creates no clinical candidate.

## 8. PDF extraction behavior

For each PDF page, MediBrief distinguishes:

- **embedded-pdf** — usable text already present in the PDF;
- **ocr** — page rasterized and processed by a configured OCR engine;
- **hybrid** — the document contains both embedded-text and OCR-derived pages;
- **none** — no usable text was produced for that page.

Pages are assembled into one derived text stream separated by two newline characters. Page start/end offsets and word-level source spans refer to that exact derived text.

The response preserves:

- page number;
- page start and end offsets;
- extraction method;
- word and character counts;
- extraction/OCR engine;
- bounding boxes where available;
- OCR confidence where available;
- source-file SHA-256;
- derived-text SHA-256;
- failed pages and warnings.

The original uploaded file remains authoritative. Derived text, offsets, bounding boxes, and confidence values are secondary review evidence.

## 9. OCR policy

MediBrief provides three policies:

### Auto

- Uses embedded PDF text when a page has enough usable text.
- OCRs PDF pages without usable embedded text.
- OCRs supported image uploads.

### Always

- OCRs every PDF page and supported image.
- Useful when embedded text is unreliable, but slower and more resource intensive.

### Never

- Uses embedded PDF text only.
- Does not OCR scanned pages or images.

Selectable OCR engines are:

- Auto-select installed engine
- docTR
- Tesseract
- EasyOCR
- PaddleOCR

The selected engine must be installed and discoverable locally. Use **Test document bridge** to inspect the actual runtime capability before relying on a choice.

OCR languages are configured as a comma-separated list in Settings. Language availability depends on the selected OCR backend and its installed language data.

## 10. Extraction status and retry behavior

The local record tracks document extraction separately from clinical facts with these states:

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

The Documents module shows:

- extraction method;
- page count and pages containing text;
- derived character count;
- warnings and failed pages;
- created candidate count;
- skipped same-source duplicate count;
- whether Gemini compatibility fallback was used;
- retry controls for recoverable runs.

Retrying does not blindly duplicate facts. Candidate identity includes the source document, model, derived-text hash, offsets, and normalized entity text, and the clinical store applies its existing same-source deduplication policy.

## 11. Assertion context after PDF/OCR

Once page-aware text is derived, it follows the same local pipeline as ordinary text:

1. OpenMed NER extracts candidate condition and medication spans.
2. The context bridge evaluates supported English spans.
3. Page/OCR evidence is attached separately from NER and context provenance.
4. The candidate review remains the only confirmation/rejection workflow.

Default OpenMed values such as affirmed, certain, recent, and patient are not treated as positive proof. Only scoped evidence-backed context is copied to candidate assertion fields; other axes remain unknown.

Non-Latin clinical text currently skips the evaluated English context layer. OCR may still derive text, but clinical assertion axes remain unknown until language-specific evaluation exists.

## 12. Extraction modes and cloud fallback

### Auto

- Uses local OpenMed for supported direct text, PDFs, and images.
- Uses Gemini only when local document or NER extraction is **unsupported** or **unavailable**, compatibility fallback is explicitly enabled, and a Gemini key is configured.
- Does not use Gemini after successful empty local extraction.
- Does not use Gemini for invalid or oversized input.
- Does not use Gemini merely because the optional context layer failed.

### OpenMed only

- Keeps extraction on the local service.
- Never uses Gemini fallback.
- Retains NER candidates with unknown context when the context bridge is unavailable.

### Gemini only

- Uses the existing compatibility extractor.
- Does not contact OpenMed or the local document bridge.

OpenMed NER, OpenMed context, OpenMed document extraction, and Gemini retain separate engines, identifiers, tags, hashes, and audit-visible provenance.

## 13. Privacy boundary

With OpenMed-only mode and a loopback service:

- the original file is sent from the MediBrief browser only to the local bridge;
- the bridge uses a temporary local file and does not retain the upload after extraction;
- derived text is processed by the local NER/context pipeline;
- every extracted clinical statement remains an unconfirmed candidate.

Review the configuration before exposing the service outside the device. A local endpoint is not automatically safe if it is bound to a public interface or reachable by other users on the network.

## 14. Run validation locally

Install the bridge runtime and test dependency:

```bash
python -m pip install -r openmed_bridge/requirements.txt
python -m pip install pytest
```

Run Python bridge tests:

```bash
python -m pytest -q openmed_bridge/tests
```

Run the TypeScript pipeline:

```bash
npm install --no-audit --no-fund
npm run typecheck
npm run test:run
npm run build:app
```

The document tests use deterministic synthetic PDF/OCR objects to validate offsets, page assembly, status, routing, provenance, failure behavior, and duplicate safety. They do not prove that a particular host has an OCR engine installed or estimate OCR quality on real medical documents. Verify the document health endpoint and test representative non-sensitive files on every deployment environment.

## 15. Troubleshooting

### Base service unavailable

```bash
curl http://127.0.0.1:8080/health
```

Confirm the port and that the service is bound to the expected host.

### NER works but context remains unknown

```bash
curl http://127.0.0.1:8080/medibrief/context/health
```

A `404` usually means the upstream `openmed.service.app:app` was started instead of `openmed_bridge.app:app`.

### Document bridge returns unavailable

```bash
curl http://127.0.0.1:8080/medibrief/documents/health
```

Reinstall the pinned requirements and inspect `available_ocr_engines`. Embedded PDF extraction and OCR capability are reported independently from NER model readiness.

### PDF returns embedded text but scanned pages are empty

- Confirm OCR policy is **Auto** or **Always**.
- Confirm `ocr_available` is true.
- Confirm the selected engine appears in `available_ocr_engines`, or select Auto.
- Confirm the requested OCR language data is installed for that engine.

### PDF result is partial

A partial result preserves successful pages and lists warnings and failed page numbers. Review the original document and retry after correcting the local OCR dependency or configuration.

### Image produces no text

Check the document health response, OCR engine, language list, image format, image resolution, and whether the source contains readable printed text. An empty OCR result is not evidence that the image contains no clinical information.

### Browser reports CORS failure

Set `OPENMED_SERVICE_CORS_ORIGINS` to the exact MediBrief origin, including scheme and port, then restart the bridge.

### Invalid host error

Keep loopback trusted hosts or add the exact intended host to `OPENMED_SERVICE_TRUSTED_HOSTS`.

### First request is slow

NER or OCR models may be downloading or loading for the first time. Use model preload where supported and test the chosen OCR backend before production use.

### Arabic or other non-Latin text has unknown context

That remains intentional. OCR language support and clinical-context validation are separate concerns; recognizing characters does not validate clinical assertion interpretation.
