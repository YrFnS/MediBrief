# Backup v2 and Legacy Migration Architecture

## Purpose

This document describes how MediBrief moves legacy local state into the versioned clinical-record model and how the portable v2 backup protects both structured records and uploaded file assets.

The migration is designed around four rules:

1. Existing legacy stores remain intact during the transition.
2. AI-derived legacy strings and observations become reviewable candidates, not silently confirmed facts.
3. Missing dates, provenance, reactions, or measurement context remain explicitly unknown.
4. Backup validation and migration finish before live application state is replaced.

## Source state

The legacy application persists patient information across separate stores:

- patient roster metadata
- diagnosis, allergy, and code-status strings
- static age, weight, and sex fields
- chat history
- uploaded-document references
- an Observation-only clinical store
- transient CDSS alerts and dismissal history
- binary assets in the local IndexedDB asset vault

The legacy v4.2 backup combines most store data per patient, but it does not contain the binary document payloads.

## Migration output

Legacy information is converted as follows:

| Legacy field | Clinical-record destination | Verification state |
|---|---|---|
| Patient name, MRN, administrative sex | `PatientProfileRecord` | Confirmed administrative metadata with legacy provenance |
| Age | `ObservationRecord` snapshot | Candidate; date of birth is never inferred |
| Weight | `ObservationRecord` | Candidate; measurement date remains unknown |
| Diagnosis string | `ConditionRecord` | Candidate |
| Allergy string | `AllergyIntoleranceRecord` | Candidate with unknown category, reaction, severity, and criticality |
| Code-status string | `ObservationRecord` | Candidate |
| Uploaded-document metadata | `DocumentReferenceRecord` | Confirmed document-existence metadata |
| Legacy FHIR-subset observation | `ObservationRecord` | Candidate with original value/unit and limited-provenance warning |
| Chat history | Backup chat map | Preserved outside the medical record |
| Alerts and dismissal history | Legacy advisory state in backup | Preserved outside confirmed clinical facts |

## Deterministic IDs and idempotency

Migrated resources receive deterministic IDs derived from patient identity and stable legacy source identity. Running migration again does not create duplicate copies of the same legacy assertion.

The migration can also add missing deterministic resources to an existing patient clinical record without overwriting amendments, confirmations, rejections, or manually entered records.

## Provenance policy

Every migrated clinical resource records:

- `source.kind = legacy-migration`
- source-system identifier `medibrief-legacy-v4.2`
- a stable external identifier when available
- migration timestamp
- a description of what legacy information was available or missing
- `legacy-migration` tag
- `needs-review` tag for candidate facts

Legacy AI extraction confidence and review history were not persisted, so migration does not invent them.

## Date and demographic policy

Legacy age is not converted into a calculated birth year. A person who is recorded as age 40 could have one of two birth years depending on whether their birthday has occurred, and the legacy value may already be stale.

Legacy weight becomes an observation with an unknown clinical date. The migration timestamp is recorded as provenance, not used as the measurement date.

Invalid or absent observation dates become an explicit unknown `ClinicalDate` while preserving the source text when available.

## Backup v2 envelope

A v2 backup has the following top-level shape:

```text
format: medibrief-backup
version: 2
exportedAt
activePatientId
patients
chats
legacyClinical
clinicalRecords
assets
```

### `patients`

Contains the current roster metadata needed during the compatibility period.

### `chats`

Contains patient-scoped chat history. Ephemeral `blob:` object URLs are removed because they are not portable. File names, MIME types, and stable storage IDs are retained.

### `legacyClinical`

Preserves the old observation/advisory store during dual-read migration. This prevents backup restore from silently discarding data that has not yet moved to the new UI.

### `clinicalRecords`

Contains the full versioned clinical-record export, including:

- candidates
- confirmed resources
- rejected resources
- entered-in-error resources
- provenance
- assertion context
- amendments
- source-document spans
- original and normalized values

### `assets`

Contains portable base64 payloads for referenced local files. Every referenced storage ID must be either:

- embedded in `assets.files`, or
- listed in `assets.missingStorageIds`

This prevents a backup from silently pretending a referenced document payload was included.

## Legacy v4.2 import

Legacy v4.2 backups remain importable.

The importer:

1. Validates the legacy envelope and typed patient content.
2. Separates roster, chat, observation, and alert state.
3. Converts legacy clinical facts into candidate resources.
4. Produces a validated v2 envelope in memory.
5. Marks every referenced binary asset as missing because v4.2 did not embed file contents.
6. Reuses matching assets already present in the current browser when possible.
7. Reports unresolved assets instead of inventing file contents.

## Transaction boundary

Restore validation and migration happen before any live store is mutated.

Immediately before apply, the prepared backup is validated again. The importer snapshots:

- patient roster state
- active patient
- chat state
- legacy clinical/advisory state
- versioned clinical-record state
- any local asset that will be overwritten

Embedded assets are restored first. Then the four Zustand store slices are replaced. If an asset write or synchronous state replacement fails, all touched stores and assets are rolled back to their snapshots.

Assets not referenced by the imported backup are not deleted. This avoids destructive cleanup during restore and leaves orphan pruning as a separate explicit maintenance operation.

## Unlock-time migration

After the encrypted stores successfully rehydrate, MediBrief runs the deterministic legacy migration before displaying the application.

The operation builds and validates the complete next clinical-record map before writing it once. A failure prevents entry into the app and displays an error while leaving legacy source stores untouched.

## Compatibility period

During Phase 1, the application keeps both old and new stores:

- the old stores continue supporting current UI components
- the new clinical record becomes the durable target model
- backup v2 preserves both representations
- later slices move UI reads and writes one feature at a time

The legacy stores can be removed only after migration, backup compatibility, and UI integration tests demonstrate no silent loss.
