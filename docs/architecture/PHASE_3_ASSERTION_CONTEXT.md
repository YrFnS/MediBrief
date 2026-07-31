# Phase 3 OpenMed Assertion Context and Medication Evidence

## Purpose

This document describes Phase 3 Slice 2: advisory assertion context and richer medication evidence layered onto the local OpenMed named-entity-recognition foundation.

Slice 2 adds:

- scoped negation;
- certainty and hypothetical language;
- historical/current temporality;
- patient, family, and other experiencer evidence;
- clinical section priors;
- medication dose, route, frequency, PRN condition, and duration parsing;
- separate context-engine provenance;
- a dedicated context-evidence review surface;
- a PHI-free synthetic English evaluation gate.

It does not automatically confirm a condition or medication. It also does not add broad allergy or code-status extraction, because the verified OpenMed interfaces used here do not provide a dedicated validated relationship path for those domains.

## Verified upstream boundary

OpenMed 2.0 exposes named-entity recognition through the standard REST `/analyze` endpoint.

Its clinical context capabilities are provided by Python helpers including:

- `scan_context_cues()`;
- `assert_context_axes()`;
- `resolve_experiencer()`;
- `detect_sections()`;
- `parse_sig()`.

The generic REST response does not contain those assertion axes. MediBrief therefore does not pretend that `/analyze` already resolved negation, certainty, temporality, experiencer, or medication instructions.

## Local bridge architecture

The repository includes:

```text
openmed_bridge/
├── __init__.py
├── app.py
├── context_service.py
├── evaluate_context.py
└── tests/
```

`openmed_bridge.app` imports the upstream OpenMed FastAPI application. That preserves:

```text
GET  /health
POST /analyze
```

and adds:

```text
GET  /medibrief/context/health
POST /medibrief/context
```

The browser therefore uses one loopback origin and one CORS policy.

## Request contract

The context request contains the exact source text and only spans already accepted by the NER response validator:

```json
{
  "text": "No evidence of pneumonia.",
  "language": "en",
  "spans": [
    {
      "id": "condition:15:24:0",
      "kind": "condition",
      "label": "DISEASE",
      "text": "pneumonia",
      "start": 15,
      "end": 24
    }
  ]
}
```

The bridge rejects:

- blank source text;
- missing IDs;
- unsupported span kinds;
- non-integer or invalid offsets;
- spans outside the source text;
- supplied entity text that does not exactly match its offsets.

## Response contract

Each result preserves:

- stable request span ID;
- kind;
- exact source text;
- original start and end offsets;
- assertion axes;
- scoped cue text, category, direction, and offsets;
- detected section and offsets;
- experiencer evidence source and cue offsets;
- optional parsed medication sig;
- OpenMed version;
- bridge version;
- language;
- evaluation timestamp.

The TypeScript client validates all of those boundaries again. Changed spans, duplicate IDs, missing results, invalid cue offsets, source mismatches, and malformed payloads fail closed.

## Assertion mapping

OpenMed axis values map into MediBrief candidate assertion fields as follows:

| OpenMed | MediBrief |
|---|---|
| `affirmed` | `affirmed` |
| `negated` | `negated` |
| `certain` | `certain` |
| `uncertain` | `uncertain` |
| `recent` | `current` |
| `historical` | `historical` |
| `hypothetical` | `hypothetical` |
| `patient` | `patient` |
| `family` | `family` |
| `other` | `other` |

When the bridge is unavailable or language routing skips the context layer, all four MediBrief axes remain `unknown`.

A current affirmed patient condition can receive a suggested `active` candidate status. Historical patient conditions can receive a suggested `inactive` candidate status. Negated, hypothetical, family, other, or unresolved assertions keep an unknown condition status.

These are candidate suggestions, not confirmed medical facts.

## Separate provenance

NER provenance remains in:

```text
resource.provenance.extraction
```

with the engine `OpenMed local REST NER`.

Context evidence is stored in the initial candidate amendment under:

```text
amendment.previousValues.openMedContextEvidence
```

This preserves:

- context engine and version;
- bridge version;
- evaluation time;
- assertion output;
- cue and section offsets;
- experiencer evidence;
- parsed medication sig.

The separation prevents context output from being attributed to the NER model and uses the existing versioned persistence, backup, export, and amendment schemas without a silent record-format change.

## Medication evidence

The bridge parses a clause-bounded window around each medication span. It also prevents a medication's window from crossing into the next detected medication span.

Recognized values may include:

- dose amount and unit;
- dose form;
- route;
- frequency per day;
- frequency period;
- as-needed status;
- PRN condition;
- duration.

Only recognized values are copied into a candidate `MedicationDosage`. The original source window remains the dosage text. Missing fields stay explicitly unresolved.

Medication sig parsing does not validate:

- whether the medication is actually being taken;
- whether the regimen is correct;
- interactions;
- allergies;
- indication;
- kidney or liver suitability;
- pregnancy;
- patient-specific safety.

## Review workflow

The Overview screen now has two related but distinct controls:

1. **OpenMed context review** — inspect cues, sections, experiencer attribution, medication sig, and correct the four assertion axes.
2. **Clinical candidate review** — edit the clinical fact and perform the existing confirm or reject action.

The context panel intentionally contains no `confirmCandidate` or `rejectCandidate` action. It cannot create a second confirmation system.

Saving a context correction:

- amends the candidate;
- requires no hard deletion;
- preserves previous assertion values;
- records a reason and audit event;
- leaves `verificationStatus: candidate` unchanged.

## Failure behavior

If NER succeeds but the context bridge is missing, stopped, timed out, cancelled, or malformed:

- NER candidates remain available;
- assertion axes remain unknown;
- no Gemini fallback is triggered solely because context failed;
- a diagnostic warning explains the limitation;
- no placeholder context is created.

A missing context endpoint is different from an unavailable NER service.

## Language boundary

Slice 2 context application is limited to English text in MediBrief.

A conservative script gate skips the context call for non-Latin clinical text. Those candidates retain unknown assertion axes.

This avoids applying an English context model to Arabic clinical text and keeps Arabic clinical-NER claims separate from Arabic PII support.

The final Phase 3 language slice will replace this conservative gate with measured routing evidence.

## Synthetic evaluation

`openmed_bridge.evaluate_context` uses PHI-free English cases for:

- explicit negation;
- uncertainty;
- historical temporality;
- hypothetical language;
- family experiencer;
- pseudo-negation;
- medication dose, route, frequency, and duration.

CI requires:

- axis accuracy: 1.0;
- exact assertion-case accuracy: 1.0;
- medication-sig field accuracy: 1.0.

This gate protects deterministic regressions. It does not estimate performance on real clinical notes and is not clinical validation.

## Intentionally deferred domains

### Allergies

A drug mention plus a reaction word is not sufficient to establish a confirmed allergy. The current verified integration surface does not expose a dedicated allergy relationship endpoint with measured evidence. OpenMed allergy candidates are therefore not created in Slice 2.

### Code status

Code status requires an authoritative advance-directive or resuscitation-status source. Generic NER and cue context are insufficient. Slice 2 does not create OpenMed code-status candidates.

Both domains remain explicit Phase 3 work rather than being implemented through brittle keyword rules.

## Validation scope

Repository validation now includes:

- Python bridge unit tests;
- bridge route smoke tests;
- synthetic English context evaluation;
- TypeScript context-client schema tests;
- source-span and cue-offset mismatch tests;
- NER-plus-context orchestration tests;
- context-unavailable degradation tests;
- non-Latin skip tests;
- candidate-only mapping tests;
- context provenance persistence tests;
- context-review source-level regression tests;
- all prior Phase 1, Phase 2, and Phase 3 Slice 1 tests;
- production TypeScript build.
