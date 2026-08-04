# Phase 2 Search, Export, Accessibility, and Responsive Contracts

## Purpose

This document describes Phase 2 Slice 6, the final Phase 2 implementation slice.

Slice 6 adds:

- patient-wide structured-record search;
- deterministic complete patient-summary export;
- keyboard navigation contracts;
- screen-reader-oriented landmarks and announcements;
- browser zoom and reduced-motion support;
- responsive-layout regression contracts;
- final Phase 2 acceptance evidence.

The implementation remains local and record-first. Search and export do not call Gemini, OpenRouter, OpenMed, or another AI service.

## Search and Export destination

A new top-level **Search & Export** destination is available beside Overview, Health Data, Timeline, Emergency Summary, and Assistant.

The destination is patient-scoped and operates on the active `PatientClinicalRecord` only.

## Record-wide search

### Indexed content

The search index covers every structured resource in the active record, including the patient profile and retained review history.

Search text includes:

- resource type;
- display label;
- resource status;
- verification state;
- known or unknown clinical-date label;
- provenance and source description;
- tags;
- structured primitive values;
- note-section text;
- report conclusions;
- medication and dosage text;
- result values and units;
- relationship identifiers;
- amendment reasons and retained prior values.

No uploaded binary file is read or reprocessed merely to build the search index. Search uses the structured record and its stored provenance.

### Default verification boundary

Search defaults to **confirmed only**.

The user must explicitly select another verification filter to view:

- candidates;
- rejected history;
- entered-in-error history;
- all verification states together.

When a non-confirmed scope is selected, the interface states that those resources are retained for traceability and are not current confirmed patient facts.

### Query semantics

Search is deterministic:

- whitespace and case are normalized;
- every entered term must match the indexed resource;
- exact and prefix label matches rank above general structured-text matches;
- known clinical dates sort before unknown dates when scores are equal;
- unknown dates remain labelled **Clinical date unknown**;
- storage time may break search-result ties but is never displayed as the clinical event date.

### Filters

The search workspace supports:

- resource type;
- verification state;
- known or unknown clinical date;
- free-text query.

Results expose:

- resource type and ID;
- verification state;
- clinical status;
- clinical date or explicit unknown date;
- source;
- storage timestamp;
- amendment count;
- structured-detail preview;
- provenance;
- original source-document preview when available.

## Complete patient-summary export

### Export scope

The complete summary contains:

- the patient profile;
- every confirmed, patient-applicable structured resource;
- full resource data;
- source and provenance;
- original values and units;
- clinical dates, including explicit unknown dates;
- amendment counts;
- tags;
- per-domain counts;
- explicit limitations.

The export excludes from its clinical summary:

- candidates;
- rejected assertions;
- entered-in-error resources;
- negated assertions;
- hypothetical assertions;
- family-attributed assertions presented as the patient’s own fact.

Excluded history remains preserved in the local clinical record, backup v2, and record-management history.

### JSON format

The JSON export uses:

```text
format: medibrief-complete-patient-summary
version: 1
```

It contains:

- generation timestamp;
- patient and record identifiers;
- record update timestamp;
- explicit scope flags;
- patient profile;
- confirmed-resource count;
- excluded-history counts;
- section counts;
- limitations;
- sections containing complete structured resources.

The JSON is intended for durable local review and future interoperability work. It is not a FHIR Bundle claim and does not pretend to satisfy an external implementation guide.

### HTML format

The HTML export is self-contained and print-ready.

It contains the same confirmed resources as the JSON export, with:

- a readable patient header;
- scope and limitation statements;
- per-domain sections;
- resource status, clinical date, source, and amendment metadata;
- escaped structured JSON for every included resource;
- mobile and print styles.

HTML content is escaped before insertion so stored text cannot become executable markup in the exported file.

### Local export boundary

Both formats are generated through browser `Blob` downloads.

The export workflow:

- does not upload the patient record;
- does not call AI;
- does not contact an external service;
- records a local `PATIENT_SUMMARY_EXPORTED` audit event.

## Unknown-date policy

Slice 6 retains the Phase 1 and earlier Phase 2 date contract:

- an explicitly unknown clinical date remains unknown;
- storage, review, import, issue, or upload time never replaces it;
- date filtering can isolate known or unknown clinical dates;
- exports preserve unknown-date objects and labels.

## Keyboard navigation

### Primary patient-record navigation

The top-level navigation is implemented as a labelled horizontal tab list.

It supports:

- `ArrowRight` and `ArrowDown` — next destination;
- `ArrowLeft` and `ArrowUp` — previous destination;
- `Home` — first destination;
- `End` — last destination;
- roving `tabIndex`;
- `aria-selected`;
- a labelled `tabpanel` relationship.

### Health Data navigation

The thirteen Health Data destinations use the same keyboard contract:

1. Conditions
2. Allergies
3. Medications
4. Labs & Reports
5. Visits
6. Clinical Notes
7. Procedures
8. Immunizations
9. Documents
10. Appointments
11. Tasks & Reminders
12. Care Plans
13. Manage Records

### Shared scope controls

Reusable scope tabs now expose tab semantics and arrow, Home, and End navigation.

## Screen-reader-oriented structure

Slice 6 adds or strengthens:

- a visible-on-focus **Skip to patient record content** link;
- a labelled patient-record content panel;
- accessible names for search inputs and selects;
- accessible source-preview button labels;
- `aria-live` result and export feedback;
- offline status announcements;
- explicit labels for non-confirmed search history;
- minimum touch-target heights for shared controls.

These changes improve semantic navigation and automated accessibility coverage. They do not claim third-party WCAG certification or replace testing with real assistive technologies.

## Browser zoom and motion

The viewport no longer disables user scaling.

The application now:

- permits browser and mobile zoom;
- applies a strong global `:focus-visible` outline;
- honors `prefers-reduced-motion` by minimizing animations and transitions.

## Responsive contracts

The final responsive contract includes:

- horizontally scrollable primary and Health Data tab lists;
- minimum tab widths so destinations remain reachable;
- shrinkable `min-w-0` and `min-h-0` record panels inside the fixed shell;
- export actions that stack on narrow displays;
- filters that stack before expanding into a wide grid;
- break-safe IDs, source labels, and structured details;
- mobile styles in the self-contained HTML export.

Automated tests guard these source-level layout contracts. The repository does not yet include Playwright screenshot baselines or a third-party device laboratory.

## Validation evidence

The final Slice 6 implementation pipeline passed:

- TypeScript: `tsc --noEmit` passed;
- test files: **26 of 26 passed**;
- tests: **111 of 111 passed**;
- production build: `vite build` passed;
- production modules transformed: **1021**.

Slice 6 tests verify:

- confirmed-only search defaults;
- explicit non-confirmed filters;
- deep structured note-text search;
- multi-term matching;
- known-versus-unknown date filtering;
- complete confirmed-resource export;
- candidate exclusion;
- original result-value preservation;
- deterministic JSON;
- escaped HTML;
- accessibility landmarks and keyboard contracts;
- browser zoom and reduced-motion support;
- responsive navigation, filter, export, and record-panel contracts.

The build continues to report the existing non-blocking bundle-size, mixed static/dynamic import, and runtime `/index.css` warnings. Those are recorded separately as frontend-performance work and do not invalidate Phase 2 record correctness.
