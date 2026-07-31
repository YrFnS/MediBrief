# Run OpenMed Locally for MediBrief

MediBrief Phase 3 connects to OpenMed through its local REST service. The default endpoint is:

```text
http://127.0.0.1:8080
```

This guide keeps the service on loopback and allows only the exact MediBrief browser origin.

## 1. Create a Python environment

OpenMed currently requires Python 3.10 or newer.

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

```bash
python -m pip install --upgrade pip
python -m pip install --upgrade "openmed[hf,service]"
```

The first use of a model alias may download its model files. For a fully air-gapped installation, prepare the model directory beforehand and configure a local model path instead of a remote alias.

## 3. Start the local REST service

For the normal Vite development origin:

```bash
OPENMED_SERVICE_CORS_ORIGINS=http://localhost:5173 \
OPENMED_SERVICE_TRUSTED_HOSTS=127.0.0.1,localhost \
uvicorn openmed.service.app:app --host 127.0.0.1 --port 8080
```

PowerShell:

```powershell
$env:OPENMED_SERVICE_CORS_ORIGINS = "http://localhost:5173"
$env:OPENMED_SERVICE_TRUSTED_HOSTS = "127.0.0.1,localhost"
uvicorn openmed.service.app:app --host 127.0.0.1 --port 8080
```

Use the exact origin shown in the browser address bar. For example, `http://127.0.0.1:5173` and `http://localhost:5173` are different origins.

Do not bind to `0.0.0.0` for a personal local setup unless network exposure is intentional and authentication, TLS, firewall rules, and trusted hosts have been designed.

## 4. Optional model preload

Preloading reduces the delay on the first extraction request:

```bash
OPENMED_SERVICE_CORS_ORIGINS=http://localhost:5173 \
OPENMED_SERVICE_TRUSTED_HOSTS=127.0.0.1,localhost \
OPENMED_SERVICE_PRELOAD_MODELS=disease_detection_superclinical,pharma_detection_superclinical \
OPENMED_SERVICE_MAX_RESIDENT_MODELS=2 \
uvicorn openmed.service.app:app --host 127.0.0.1 --port 8080
```

Preload success means the service attempted to prepare those models. It is still important to test the configured extraction path in MediBrief.

## 5. Verify the service

```bash
curl http://127.0.0.1:8080/health
```

A healthy service should return a JSON response whose status is `ok` or `ready`.

You can also open MediBrief:

1. Open **Settings**.
2. Find **Clinical document extraction**.
3. Select **Auto** or **OpenMed only**.
4. Keep the endpoint at `http://127.0.0.1:8080`.
5. Select **Test local service**.

The health check confirms reachability only. It does not prove that every configured model is downloaded, loadable, appropriate for the document language, or clinically validated.

## 6. Model settings used by MediBrief Slice 1

Default disease model:

```text
disease_detection_superclinical
```

Default medication model:

```text
pharma_detection_superclinical
```

MediBrief calls the two models independently and maps only recognized disease/condition and medication/pharmaceutical spans.

## 7. Extraction modes

### Auto

- Uses OpenMed for supported text files.
- Does not call Gemini when OpenMed succeeds but finds no entities.
- Can use Gemini for an unsupported file or unavailable local service only when compatibility fallback is enabled and a Gemini key is configured.

### OpenMed only

- Keeps extraction on the configured local OpenMed service.
- Does not send unsupported PDF/image content to Gemini.

### Gemini only

- Uses the existing compatibility extraction path.
- Does not contact OpenMed.

## 8. Supported Slice 1 files

OpenMed Slice 1 analyzes files that already contain UTF-8 text:

- TXT
- Markdown
- CSV and TSV
- JSON
- XML
- HTML source text

PDF and image uploads remain valid source documents in MediBrief, but page-aware PDF extraction and local OCR are not part of Slice 1.

## 9. Privacy boundary

With OpenMed-only mode and a loopback service, the decoded source text is sent only from the MediBrief browser to the locally running OpenMed service.

Auto mode may use Gemini only when the explicit compatibility-fallback setting allows it. OpenMed and Gemini results retain different provenance, model metadata, source identifiers, and tags.

Every extracted clinical statement remains a candidate requiring review.

## 10. Troubleshooting

### Service unavailable

Confirm:

```bash
curl http://127.0.0.1:8080/health
```

Also verify that MediBrief’s endpoint matches the service port.

### Browser reports CORS failure

Set `OPENMED_SERVICE_CORS_ORIGINS` to the exact MediBrief origin, including scheme and port, then restart OpenMed.

### Invalid host error

Keep the default loopback trusted hosts or include the exact host header in `OPENMED_SERVICE_TRUSTED_HOSTS`.

### First request is slow

The model may be downloading and loading for the first time. Use the optional preload configuration or keep-alive setting.

### PDF or image produces no OpenMed candidates

That is expected in Slice 1. The file has not yet been converted into page-aware text or OCR output. Use the explicit Gemini compatibility route only when desired, or wait for the later local document-text/OCR slice.
