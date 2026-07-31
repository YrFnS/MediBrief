# Run OpenMed Locally for MediBrief

MediBrief Phase 3 connects to OpenMed through a local REST service. The default endpoint is:

```text
http://127.0.0.1:8080
```

This guide keeps the service on loopback, allows only the exact MediBrief browser origin, and starts the MediBrief bridge that extends OpenMed with advisory assertion-context endpoints.

## What the bridge adds

OpenMed's standard REST application provides:

```text
GET  /health
POST /analyze
```

Those endpoints provide service status and named-entity recognition.

OpenMed's negation, certainty, temporality, experiencer, section, and medication-sig helpers are Python APIs rather than part of the standard `/analyze` response. MediBrief therefore includes `openmed_bridge.app`, which imports the upstream OpenMed REST application and adds:

```text
GET  /medibrief/context/health
POST /medibrief/context
```

The added endpoint is deterministic and advisory. It never confirms or rejects a clinical fact.

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

## 2. Install OpenMed with inference and service support

Run this from the MediBrief repository root:

```bash
python -m pip install --upgrade pip
python -m pip install --upgrade "openmed[hf,service]==2.0.0"
```

The first use of a model alias may download its model files. For a fully air-gapped installation, prepare the model directories beforehand and configure local model paths instead of remote aliases.

The bridge source itself lives in the repository under:

```text
openmed_bridge/
```

No separate Python package installation is required when Uvicorn is started from the repository root.

## 3. Start the extended local REST service

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

Use the exact origin shown in the browser address bar. For example, `http://127.0.0.1:5173` and `http://localhost:5173` are different origins.

Do not bind to `0.0.0.0` for a personal local setup unless network exposure is intentional and authentication, TLS, firewall rules, and trusted hosts have been designed.

### Standard OpenMed app versus MediBrief bridge

Starting this command still supports Slice 1 NER but not Slice 2 assertion context:

```bash
uvicorn openmed.service.app:app --host 127.0.0.1 --port 8080
```

When MediBrief can reach `/analyze` but cannot reach `/medibrief/context`, it keeps the NER findings as candidates and leaves assertion axes unknown. It does not invent context and it does not silently call Gemini because the context bridge alone is missing.

## 4. Optional model preload

Preloading reduces the delay on the first NER request:

```bash
OPENMED_SERVICE_CORS_ORIGINS=http://localhost:5173 \
OPENMED_SERVICE_TRUSTED_HOSTS=127.0.0.1,localhost \
OPENMED_SERVICE_PRELOAD_MODELS=disease_detection_superclinical,pharma_detection_superclinical \
OPENMED_SERVICE_MAX_RESIDENT_MODELS=2 \
uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080
```

Preload success means the service attempted to prepare those models. It is still important to test the configured extraction path in MediBrief.

## 5. Verify both service layers

### Upstream OpenMed service

```bash
curl http://127.0.0.1:8080/health
```

A healthy service should return JSON whose status is `ok` or `ready`.

### MediBrief context bridge

```bash
curl http://127.0.0.1:8080/medibrief/context/health
```

A healthy bridge reports advisory features such as negation, certainty, temporality, experiencer, section context, and medication-sig parsing.

In MediBrief:

1. Open **Settings**.
2. Find **Clinical document extraction**.
3. Select **Auto** or **OpenMed only**.
4. Keep the endpoint at `http://127.0.0.1:8080`.
5. Select **Test local service**.
6. Select **Test context bridge**.

The checks confirm reachability only. They do not prove that every configured NER model is downloaded, loadable, suitable for the document language, or clinically validated.

## 6. Default NER models

Default disease model:

```text
disease_detection_superclinical
```

Default medication model:

```text
pharma_detection_superclinical
```

MediBrief calls the two models independently and maps only recognized disease/condition and medication/pharmaceutical spans.

## 7. Slice 2 context behavior

For evaluated English text, the bridge can attach advisory evidence for:

- affirmed versus negated polarity;
- certain versus uncertain language;
- current, historical, or hypothetical temporality;
- patient, family, or other experiencer cues;
- recognized clinical section context;
- medication dose, route, frequency, PRN condition, and duration when parseable.

Every result retains source offsets and the matched cue or section evidence. Context is stored separately from NER provenance in the candidate's amendment history.

The app presents a dedicated context-evidence review before the existing confirm/reject workflow. Saving a context correction does not confirm the underlying clinical fact.

### Language boundary

Slice 2 context application is currently limited to English text in MediBrief. Non-Latin clinical text skips context enrichment and keeps all assertion dimensions unknown until measured language-specific evidence is added.

This limitation is separate from any Arabic PII support that OpenMed may provide.

## 8. Extraction modes

### Auto

- Uses OpenMed for supported text files.
- Does not call Gemini when OpenMed succeeds but finds no entities.
- Keeps NER candidates when the optional context bridge is unavailable.
- Can use Gemini for an unsupported source file or unavailable NER service only when compatibility fallback is enabled and a Gemini key is configured.

### OpenMed only

- Keeps extraction on the configured local OpenMed service.
- Does not send unsupported PDF/image content to Gemini.
- Keeps NER candidates with unknown context if only the bridge endpoint is unavailable.

### Gemini only

- Uses the existing compatibility extraction path.
- Does not contact OpenMed.

## 9. Supported local text files

The current OpenMed path analyzes files that already contain UTF-8 text:

- TXT
- Markdown
- CSV and TSV
- JSON
- XML
- HTML source text

PDF and image uploads remain valid source documents in MediBrief, but page-aware PDF extraction and local OCR are not part of Slice 2.

## 10. Privacy and provenance boundary

With OpenMed-only mode and a loopback service, decoded source text travels only from the MediBrief browser to the locally running OpenMed service.

Auto mode may use Gemini only when the explicit compatibility-fallback setting allows it. OpenMed NER, OpenMed context, and Gemini results retain separate engines, versions, identifiers, tags, and audit-visible provenance.

Every extracted clinical statement remains a candidate requiring human review.

## 11. Run bridge tests locally

Install test dependencies:

```bash
python -m pip install pytest "openmed[service]==2.0.0"
```

Run:

```bash
python -m pytest -q openmed_bridge/tests
```

The repository CI runs these Python tests before the TypeScript suite and production build.

## 12. Troubleshooting

### Base service unavailable

Confirm:

```bash
curl http://127.0.0.1:8080/health
```

Also verify that MediBrief's endpoint matches the service port.

### NER works but context remains unknown

Confirm:

```bash
curl http://127.0.0.1:8080/medibrief/context/health
```

If it returns `404`, the standard `openmed.service.app:app` was probably started. Restart using:

```bash
uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080
```

### Browser reports CORS failure

Set `OPENMED_SERVICE_CORS_ORIGINS` to the exact MediBrief origin, including scheme and port, then restart the bridge.

### Invalid host error

Keep the default loopback trusted hosts or include the exact host header in `OPENMED_SERVICE_TRUSTED_HOSTS`.

### First request is slow

The model may be downloading and loading for the first time. Use optional model preload or the keep-alive setting.

### Arabic or other non-Latin text has unknown context

That is intentional in Slice 2. MediBrief does not apply the English context layer to those documents until language-specific evaluation exists.

### PDF or image produces no OpenMed candidates

That is expected in the current text-only path. The file has not yet been converted into page-aware text or OCR output. Use the explicit Gemini compatibility route only when desired, or wait for the later local document-text/OCR slice.
