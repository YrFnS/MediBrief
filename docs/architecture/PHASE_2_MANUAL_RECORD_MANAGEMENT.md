# Phase 2 Manual Record Management

## Purpose

This document describes Phase 2 Slice 5: guided manual entry, confirmed-record corrections, entered-in-error handling, relationship validation, and visible amendment history.

The workflow is available from **Health Data → Manage Records** and reuses the versioned Phase 1 clinical store. It does not create a parallel database, mutation API, or review system.

## Supported workflows

The workspace has three modes:

1. **Add record** — create a new, explicitly confirmed, user-entered clinical resource after validation.
2. **Correct / invalidate** — amend an existing confirmed resource or mark it entered in error.
3. **History** — inspect confirmed, candidate, rejected, and entered-in-error resources together with provenance and retained prior values.

Candidate facts continue to use the existing candidate-review queue. Rejected and entered-in-error history cannot be edited back into confirmed facts through this workspace.

## Guided manual entry

Guided forms are available for the following structured resource types:

- Encounter
- Condition
- AllergyIntolerance
- Medication
- Observation
- DiagnosticReport
- Specimen
- Procedure
- Immunization
- Appointment
- ClinicalTask
- CarePlan
- ClinicalNote

Documents remain in the existing upload workflow because document creation must preserve the local binary asset, stable storage ID, MIME type, filename, and upload provenance.

### Manual-entry verification state

A successfully saved manual resource is recorded as:

- `verificationStatus: confirmed`
- source kind `manual`
- a confirmation timestamp and actor
- tag `manual-entry`
- a user-facing audit event

This is an explicit user-entered fact, not an AI extraction candidate. The form therefore requires the user to supply and review the clinical values before saving.

### Schema validation

Before persistence, the service constructs the complete resource and passes it through the same strict Zod schema used by the clinical store.

The validation boundary covers:

- required clinical fields;
- supported status, intent, priority, kind, and category values;
- finite quantities;
- integer and boolean observation values;
- date and date-time syntax;
- appointment end time not preceding start time;
- valid resource-specific structures;
- complete patient ownership.

The store validates the resource again before committing it, providing a second fail-closed boundary.

## Unknown-date policy

Manual entry never substitutes the current date for an unknown clinical date.

Supported partial date formats are:

- `YYYY-MM-DD`
- `YYYY-MM`
- `YYYY`

A blank clinical date is converted to an explicit unknown date where the resource requires a date-bearing field. Storage, issue, review, and upload timestamps remain provenance only.

The one intentional exception is a manually authored `ClinicalNote`: when its authored timestamp is left blank, MediBrief uses the current time because the note is being created at that moment. This does not change the date of a referenced encounter or source document.

## Source-value preservation

For manual observations and medication doses, the entered value and unit are stored as the original source quantity.

The manual workflow does not invent a normalized quantity. Normalization can be added separately only when a validated conversion is available; it never replaces the original value.

## Relationship validation

Relationship fields are checked against the active patient record before persistence.

The service validates links including:

- condition, medication, observation, procedure, appointment, note, report, and care-plan encounter links;
- report-to-observation, specimen, and document links;
- procedure-to-report links;
- task related-resource references;
- care-plan condition and activity-task links;
- note source-document, transcript-document, amended-note, and encounter links.

A missing patient-scoped relationship target is rejected. Rejected or entered-in-error targets cannot be used as active relationship targets. A note cannot amend itself.

Guided select controls expose confirmed encounter and note targets. ID-based relationship fields remain explicit so imported identifiers can be reviewed rather than silently resolved to an unrelated record.

## Confirmed-record corrections

Only confirmed resources appear in the guided correction list.

A correction requires:

- a validated replacement value set;
- all relationships to remain valid;
- a non-empty correction reason;
- the correcting actor and timestamp.

The existing store `amendResource` action then:

1. rejects immutable-field changes;
2. determines the fields that actually changed;
3. captures their previous values;
4. appends a `ClinicalAmendment` entry;
5. updates provenance;
6. validates the complete patient record before persistence.

The resource ID remains stable. The current representation changes, while prior values and the reason remain attached to the resource.

### Compact correction boundaries

Some resource types contain nested, repeated structures that should not be partially overwritten by a compact form.

The Slice 5 correction UI therefore preserves these structures unless the user replaces the whole resource through an entered-in-error plus new-record workflow. Examples include:

- multiple allergy reactions;
- multiple medication dosage instructions;
- task related-resource arrays;
- clinical-note section arrays and source-document arrays.

This avoids accidental loss of clinically relevant detail.

## Entered-in-error handling

Reviewed clinical history is never hard-deleted.

Marking a resource entered in error requires:

- a non-empty reason;
- explicit user acknowledgement that the record will remain in history;
- the actor and timestamp.

The store changes the verification state to `entered-in-error`, appends an amendment containing the previous verification state, and validates the full patient record.

The resource then disappears from confirmed patient summaries and domain modules but remains visible in the history workspace, backup, export, and audit trail.

## History and provenance review

The History tab can filter by:

- verification state;
- resource type;
- text, source, status, and label.

Each resource exposes:

- resource ID and type;
- verification state;
- clinical date or explicit unknown date;
- storage timestamp;
- source label;
- amendment count;
- correction reasons;
- changed fields;
- retained previous values;
- extraction confidence and tags when available;
- original local source preview when provenance includes a document reference.

This view deliberately includes candidate, rejected, and entered-in-error history without presenting those resources as current patient facts.

## Audit events

Slice 5 adds explicit audit events for:

- `CLINICAL_RESOURCE_CREATED`
- `CLINICAL_RESOURCE_AMENDED`
- `CLINICAL_RESOURCE_MARKED_ERROR`

The events include patient ID, resource type, resource ID, actor, and the correction or invalidation reason when applicable.

## Validation evidence

The Slice 5 repository pipeline passed:

- TypeScript: `tsc --noEmit` passed.
- Test files: **24 of 24 passed**.
- Tests: **100 of 100 passed**.
- Production build: `vite build` passed.
- Production modules transformed: **1019**.

The new tests verify:

- confirmed manual entry with manual provenance;
- explicit unknown clinical dates;
- invalid quantity rejection;
- patient-scoped relationship validation;
- rejection of erroneous relationship targets;
- amendment construction and store persistence;
- correction reasons and previous-value retention;
- candidate correction protection;
- entered-in-error reason enforcement;
- history-preserving store behavior;
- source preview and audit-event wiring;
- user-facing wording for unknown dates and non-destructive invalidation.

The build continues to report the existing non-blocking bundle-size, mixed-import, and runtime stylesheet warnings. Those remain part of the separate frontend-performance workstream.
