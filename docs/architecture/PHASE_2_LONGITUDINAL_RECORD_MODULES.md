# Phase 2 Longitudinal Record Modules

## Purpose

This document describes Phase 2 Slice 3: first-class interfaces for visits and encounters, clinical notes, procedures and device-related evidence, immunizations, and source documents.

These modules extend the **Health Data** workspace introduced in Slice 2. The top-level patient navigation remains compact while the internal Health Data navigation now supports nine domains:

1. Conditions
2. Allergies
3. Medications
4. Labs & Reports
5. Visits
6. Clinical Notes
7. Procedures
8. Immunizations
9. Documents

## Shared confirmed-record boundary

Every Slice 3 list is derived from the patient-scoped structured clinical record and uses the existing confirmed-patient-fact policy.

The default views exclude:

- pending candidates;
- rejected assertions;
- entered-in-error resources;
- negated findings;
- hypothetical findings;
- family-history statements presented as the patient’s own history.

Each module exposes its relevant pending-candidate count and routes the user back to the existing patient review queue. Slice 3 does not create a second confirmation system.

Every detailed record retains:

- source kind and source label;
- storage and update timestamps;
- amendment count;
- extraction confidence when available;
- tags;
- original local source-document preview when provenance provides a document reference.

## Visits and encounters

The Visits module separates encounter records into:

- **Current** — planned, in-progress, or unknown status;
- **History** — finished or cancelled encounters;
- **All** — both groups.

The module supports search and filters for status and encounter class.

Encounter details include:

- visit type and encounter class;
- status;
- known start and end dates;
- explicit unknown clinical dates;
- reasons;
- participants and roles;
- location;
- service provider;
- linked clinical notes;
- linked procedures;
- linked diagnostic reports;
- directly related documents;
- provenance and source review.

A storage timestamp never becomes the encounter date. A missing or explicitly unknown period displays **Clinical date unknown**.

An empty local encounter list does not prove that the patient has never received care elsewhere.

## Clinical notes

The Clinical Notes module presents durable `ClinicalNoteRecord` resources. It does not use chat messages as the note of record.

It supports filters for:

- note status;
- note type;
- full-text search across title, author, sections, encounter links, source-document IDs, and provenance.

Detailed note records include:

- title;
- final, draft, or amended status;
- note type;
- authored date and time;
- author;
- linked encounter;
- every stored section with preserved whitespace;
- source-document IDs;
- transcript document ID;
- amended-note relationship;
- provenance and original-source access.

The module preserves full reviewed SOAP sections rather than collapsing them into a summary card.

## Procedures

The Procedures module separates:

- **Current** — preparation, in-progress, on-hold, or unknown status;
- **History** — completed, not-done, or stopped procedures;
- **All** — both groups.

It supports search, status filtering, and a device-related-only filter.

Procedure details include:

- procedure name;
- status;
- performed date or period;
- body sites;
- reasons;
- outcome;
- complications;
- performers;
- linked encounter;
- linked diagnostic reports;
- directly related documents;
- notes;
- provenance and source review.

### Device information boundary

The Phase 1 schema does not yet contain a standalone `Device` resource. Slice 3 therefore does not invent a structured implant inventory.

Instead, the Procedures module exposes a **device-related confirmed evidence** section. It searches confirmed procedure and document content for deterministic device terms such as:

- implant;
- pacemaker;
- defibrillator;
- stent;
- prosthesis;
- catheter;
- port;
- graft;
- mesh;
- plate;
- screw;
- clip;
- pump;
- sensor;
- monitor;
- IUD;
- cochlear device.

Every match is labelled as procedure or document evidence. A keyword match is not represented as proof that a device is currently implanted, active, correctly identified, or still present.

A dedicated versioned Device resource remains a future schema extension. Until that exists, MediBrief keeps this boundary explicit rather than storing device guesses in the problem list or procedure status.

## Immunizations

The Immunizations module supports search and status filtering.

It preserves:

- vaccine name;
- completed, not-done, or unknown status;
- occurrence date;
- manufacturer;
- lot number;
- original dose;
- normalized dose when available;
- administration route;
- administration site;
- reason;
- performer;
- notes;
- provenance and original source.

An explicitly unknown occurrence date remains **Clinical date unknown**.

An empty immunization list does not prove that the patient is unvaccinated, is not due for a vaccine, or lacks records elsewhere.

## Documents

The Documents module is the patient’s local source library.

It supports filters for:

- current or superseded status;
- file family;
- document type;
- full-text search across title, filename, description, MIME type, hash, related records, and source metadata.

Document details include:

- title and filename;
- status;
- document type;
- authored date;
- upload date;
- MIME type and file family;
- page count;
- hash when recorded;
- description;
- related structured records;
- local source preview.

### Authored date versus upload date

The authored date is the document’s clinical or source date when known. The upload date is when the file entered the browser’s local vault.

Upload time never replaces an unknown authored date. A document uploaded today may still be an old report with an unknown source date.

Related-resource references are resolved against the structured record. Missing references are displayed explicitly rather than silently omitted.

The preview uses the stable document or storage identifier. If the binary asset is missing, the existing preview workflow reports that the metadata remains but the local file is unavailable.

## Validation scope

Slice 3 regression coverage verifies:

- encounter links to notes, procedures, reports, and documents;
- explicit unknown encounter dates;
- full clinical-note section preservation;
- durable note-to-encounter and transcript relationships;
- device-related procedure and document evidence without a false device inventory;
- immunization lot, dose, route, and unknown-date preservation;
- document authored-date versus upload-time separation;
- related-resource resolution and explicit missing references;
- source preview and provenance across every Slice 3 module;
- clinically honest empty states.

The repository workflow continues to run TypeScript validation, all Phase 1 and Phase 2 tests, and the production Vite build.
