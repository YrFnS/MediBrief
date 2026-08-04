# Phase 2 Core Clinical Modules

## Purpose

This document describes the first-class Conditions, Allergies, Medications, and Labs/Diagnostic Reports interfaces introduced in Phase 2 Slice 2.

The modules are grouped under one top-level **Health Data** destination. This keeps the primary record navigation scalable while giving each clinical domain its own filters, history rules, detailed records, provenance, and source-document review.

## Shared view boundary

All four modules are generated from the patient-scoped structured clinical record. Their default lists include only confirmed, patient-applicable facts.

The shared confirmed-only boundary excludes:

- pending candidates;
- rejected assertions;
- entered-in-error resources;
- negated findings;
- family-history findings presented as the patient’s own condition;
- hypothetical findings.

Candidate counts remain visible per module and route back to the existing review workflow. A candidate never becomes a current patient fact merely because it was extracted with high model confidence.

## Shared interface behavior

Each module provides:

- deterministic search over clinical content and provenance;
- domain-specific filters;
- current-versus-history separation where applicable;
- accurate sparse-record and empty states;
- amendment counts and record timestamps;
- source-kind labels;
- extraction confidence when available;
- stable tags;
- original local source-document preview when provenance links to a stored file.

Storage and update timestamps describe record provenance. They do not automatically become the clinical event date.

## Conditions

The Conditions module separates the confirmed problem list into:

- **Current** — active, remission, or unknown clinical status;
- **History** — inactive or resolved clinical status;
- **All** — both groups.

The list can be searched and filtered by clinical status. Detailed records include:

- condition name and coding text;
- clinical status;
- severity;
- onset;
- abatement or resolution date;
- body sites;
- notes;
- provenance and amendment history.

An empty current list means only that no current condition is confirmed in the structured record. It does not prove that the patient has no medical conditions.

## Allergies and intolerances

The Allergies module treats the absence of a current confirmed allergy record as **allergy status unknown**.

It never infers a no-allergy statement from an empty list. Historical or resolved allergy records do not establish the current allergy status.

Detailed allergy records include:

- substance;
- active, inactive, resolved, or unknown clinical status;
- criticality;
- allergy category;
- reaction manifestations;
- reaction description;
- reaction severity;
- reaction onset;
- exposure route;
- last occurrence;
- notes and source history.

High-criticality records receive stronger visual emphasis, but the module reproduces recorded information and does not independently determine clinical risk.

## Medications and medication history

The Medications module separates:

- **Current** — active, on-hold, or unknown status;
- **History** — completed, stopped, not-taken, and other non-current states.

Medication records can be filtered by status and record kind: statement, request, or administration.

Detailed records preserve:

- medication name;
- record kind and status;
- free-text dosage instructions;
- original and normalized dose values when available;
- route;
- frequency;
- timing;
- as-needed status;
- recorded maximum-dose text;
- indication or reason;
- start and end dates;
- prescriber;
- notes and provenance.

The module is a record browser. It does not validate dose, frequency, route, duration, interactions, allergies, kidney/liver function, pregnancy, indication, or patient-specific suitability.

An empty current list does not prove that the patient takes no medication.

## Labs and diagnostic reports

The Results module presents two related record layers:

1. **Diagnostic reports** — report-level records that may group results, specimens, documents, conclusions, categories, and performers.
2. **Observations** — individual structured measurements or qualitative results.

The interface supports:

- report-only, laboratory-result, other-observation, and combined views;
- flagged and unflagged result filters;
- category filters;
- search across tests, values, ranges, interpretations, performers, reports, and sources;
- report-to-result linkage;
- report result/specimen/document counts.

### Original and normalized values

Every observation view exposes the original source value. A normalized value may be shown separately when available.

Normalization never overwrites or hides the original source value. Normalization warnings remain visible as data-quality information.

### Interpretations and reference ranges

Recorded interpretations and reference ranges are reproduced as source data. A flag or out-of-range marker is not presented as a diagnosis or treatment recommendation.

### Unknown-date policy

An explicitly unknown effective or report date remains **Clinical date unknown**, even when the application knows when the result was issued, extracted, reviewed, or stored.

Secondary timestamps are shown separately as provenance. They are not promoted into the event date.

This rule prevents an old result with an unknown report date from appearing as though it occurred when the user imported or reviewed it.

## Candidate review integration

Each module shows the number of pending candidates for its resource types:

- Conditions: `Condition` candidates;
- Allergies: `AllergyIntolerance` candidates;
- Medications: `Medication` candidates;
- Results: `Observation` and `DiagnosticReport` candidates.

The review action returns to the existing patient-scoped candidate queue. The Health Data module does not introduce a second confirmation system.

## Validation scope

Slice 2 regression coverage verifies:

- current-versus-history condition behavior;
- candidate exclusion;
- allergy reaction and criticality preservation;
- unknown current allergy status when only history exists;
- medication dosage, route, timing, reason, and prescriber preservation;
- current-versus-history medication behavior;
- report-to-result linkage;
- original value preservation;
- flagged-result filtering;
- explicit unknown clinical dates despite known issue/storage timestamps;
- source-document propagation;
- provenance and source-preview availability across all modules;
- user-facing uncertainty and medication-safety boundaries.

The repository validation workflow continues to run the complete Phase 1 and Phase 2 test suites, TypeScript validation, and the production build.
