# Phase 3 OpenMed Local Extraction Foundation

## Purpose

This document describes Phase 3 Slice 1: a local-first OpenMed named-entity-recognition foundation for MediBrief.

The slice adds:

- a strict OpenMed REST client;
- independent extraction settings;
- local text-file decoding;
- specialized disease and medication extraction;
- candidate mapping with exact source offsets;
- explicit Auto, OpenMed-only, and Gemini-only routing;
- regression coverage for availability, malformed output, timeout, cancellation, provenance, and fallback boundaries.

It does not add full assertion-context resolution, PDF text extraction, image OCR, allergy relationship extraction, code-status extraction through OpenMed, or clinical confirmation without review.

## Why a local REST sidecar

OpenMed supports several runtimes, including Python, REST/gRPC services, mobile libraries, and browser-oriented ONNX exports. Slice 1 uses the documented local REST service because it:

- keeps model weights and inference dependencies out of MediBrief’s already-large browser bundle;
- allows CPU, GPU, and platform-specific OpenMed runtimes behind one contract;
- gives the user control over the local endpoint;
- can run on loopback without sending patient text to a cloud provider;
- can later be supervised by desktop packaging without rewriting the record integration.

The default endpoint is:

```text
http://127.0.0.1:8080
```

Browser access requires OpenMed CORS settings to include MediBrief’s exact origin.

## Service contract

### Health

MediBrief calls:

```http
GET /health
```

The response is runtime-validated and may include:

- status;
- service name;
- OpenMed version;
- service profile.

A successful health response means only that the REST service is reachable. It does not prove that:

- the configured model has been downloaded;
- the model can load on the current hardware;
- the model is suitable for the current language or document type;
- its output has been clinically validated for the patient.

### Analyze

MediBrief calls:

```http
POST /analyze
Content-Type: application/json
```

with:

```json
{
  "text": "...",
  "model_name": "disease_detection_superclinical",
  "confidence_threshold": 0.6,
  "group_entities": false,
  "aggregation_strategy": "simple",
  "keep_alive": "10m"
}
```

The medication model is called separately. Running the two model aliases independently avoids pretending that one generic model necessarily returns both clinical domains.

## Client safety boundary

The OpenMed client:

- accepts only HTTP or HTTPS base URLs;
- rejects credentials embedded in the URL;
- strips query strings, fragments, and trailing path separators;
- supports caller cancellation;
- applies a configurable timeout;
- distinguishes timeout, cancellation, service unavailability, HTTP errors, and invalid responses;
- parses the service error envelope when available;
- validates confidence as a finite value between zero and one;
- validates integer source offsets;
- requires the returned text to match the submitted text exactly;
- rejects spans that are empty, reversed, or outside the submitted text;
- derives the candidate excerpt from the submitted source text rather than trusting a conflicting entity string.

A malformed response produces no clinical record mutation.

## Supported source files

Slice 1 accepts files that already contain locally decodable UTF-8 text, including:

- TXT;
- Markdown;
- CSV and TSV;
- JSON;
- XML;
- HTML as source text.

The decoder:

- reads the existing local base64 payload;
- removes a UTF-8 byte-order mark when present;
- normalizes line endings;
- rejects empty text;
- rejects NUL-containing binary content;
- applies a per-request character limit;
- preserves the exact text passed to OpenMed for offsets.

PDFs and images remain valid MediBrief source documents, but Slice 1 does not send their binary data to the text `/analyze` endpoint. PDF text extraction and OCR belong to a later slice with page-level provenance.

## Entity mapping

OpenMed entities are mapped conservatively:

- disease, condition, diagnosis, disorder, problem, and symptom labels can become `ConditionRecord` candidates;
- drug, medication, chemical, pharmaceutical, and substance labels can become `MedicationRecord` candidates;
- unsupported labels are ignored and counted in diagnostics;
- repeated results at the same source span and clinical kind are deduplicated using the highest confidence;
- condition and medication interpretations remain separate even when they overlap.

Every mapped resource is:

```text
verificationStatus: candidate
```

and includes:

- patient ID;
- source document ID and filename;
- exact excerpt;
- start and end offsets;
- model name;
- OpenMed engine/version when returned;
- confidence;
- extraction timestamp;
- local extraction tags;
- an explicitly unknown clinical date.

## Assertion context boundary

Named-entity recognition alone does not answer whether a statement is:

- affirmed or negated;
- certain or uncertain;
- current, historical, or hypothetical;
- about the patient, a family member, or another person.

Slice 1 therefore stores all four assertion dimensions as `unknown` for OpenMed candidates. It does not infer a patient experiencer merely because the entity appears in the patient’s document.

A later evaluated context layer may enrich these fields, but it must retain its own engine and model provenance.

## Candidate review

OpenMed output reuses the existing Phase 1 candidate-review workflow.

The local extractor does not:

- update the patient’s confirmed condition list;
- update the medication list;
- create an allergy record;
- set code status;
- produce a diagnosis or treatment recommendation;
- create an order or completed action.

The user must inspect the source and confirm, edit, or reject every candidate.

## Fallback routing

MediBrief supports three explicit modes.

### Auto

- Use OpenMed for supported local text.
- If OpenMed succeeds or returns no matching entities, do not call Gemini.
- If the file is unsupported by the text-only slice or the local service is unavailable, Gemini may run only when the user enabled compatibility fallback and configured a Gemini key.

### OpenMed only

- Use local OpenMed only.
- Unsupported files and unavailable service requests produce no cloud extraction.

### Gemini only

- Use the existing Gemini compatibility extractor.
- OpenMed is not contacted.

Gemini and OpenMed outputs have different external-system IDs, extraction-engine names, and tags. The app never attributes fallback output to OpenMed.

## Document and persistence behavior

The uploaded source document is still recorded independently as a confirmed `DocumentReferenceRecord` because the user actually uploaded the file.

Clinical statements extracted from that document remain candidates.

Candidate writes use the existing clinical store, which provides:

- patient ownership validation;
- schema validation;
- conservative same-source deduplication;
- encrypted persistence;
- backup/export support;
- review and amendment history.

## Failure behavior

The record remains usable when OpenMed is unavailable.

Failures are diagnostic only and do not create placeholder facts. Examples include:

- connection refused;
- timeout;
- caller cancellation;
- CORS rejection;
- invalid health payload;
- invalid analysis payload;
- source-text mismatch;
- malformed offsets;
- unsupported labels;
- unsupported binary file;
- empty text;
- text exceeding the request limit.

## Validation scope

Slice 1 automated tests cover:

- endpoint normalization;
- health response parsing;
- documented analyze request shape;
- exact source-text matching;
- invalid span rejection;
- timeout and caller cancellation;
- supported text decoding;
- explicit PDF/OCR non-support;
- two-model extraction;
- label mapping;
- source offsets and excerpts;
- confidence/model/version provenance;
- unknown assertion context and clinical date;
- candidate-only storage;
- same-source candidate deduplication;
- service-unavailable behavior;
- settings separation;
- explicit fallback and provenance boundaries.

## Remaining Phase 3 work

Slice 1 does not complete Phase 3. The next work includes:

1. evaluated assertion context;
2. richer medication relationships;
3. validated allergy and code-status paths;
4. PDF text extraction and local OCR;
5. page and section provenance;
6. English and Arabic synthetic evaluation;
7. explicit language and fallback policy;
8. final Phase 3 acceptance evidence.
