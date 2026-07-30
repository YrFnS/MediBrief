# Phase 2 Record Home

## Purpose

This document describes the first Phase 2 personal-health-record interface built on the accepted Phase 1 clinical foundation.

The central product change is:

> MediBrief opens as a personal health record. The AI assistant is one optional workspace, not the application gate or the medical record itself.

## Workspace model

`Phase2Workspace` owns the top-level user destination:

- **Overview** — confirmed record summary and data gaps;
- **Timeline** — longitudinal confirmed clinical history;
- **Emergency Summary** — deterministic printable summary;
- **Assistant** — chat, document analysis, live voice, and ambient scribe.

Overview is the default destination. The local record remains available when no AI provider key exists or the browser is offline.

When the assistant is selected:

- an available provider key opens the existing assistant layout;
- no provider key opens a clear configuration prompt;
- the prompt explicitly states that the record remains usable without AI.

## Confirmed-only view boundary

The record home uses the Phase 1 selectors and adds deterministic Phase 2 view models in:

- `features/personal-health-record/viewModels.ts`

Overview, timeline, and emergency summary include only resources accepted by the confirmed-patient-fact policy. Candidates, rejected assertions, entered-in-error records, negated findings, family-history assertions, and hypothetical findings do not become current patient facts.

Pending candidates remain visible through the existing review queue and candidate count.

## Overview

The overview contains:

- patient identity and identifiers;
- date of birth and calculated age when a day-precision date is available;
- administrative sex, blood type, language, and contact information;
- confirmed active conditions;
- confirmed active allergies;
- confirmed active medications;
- record metrics;
- open appointment proposals and follow-up tasks;
- recent confirmed record history;
- explicit record gaps.

An empty section never creates an unsafe negative claim:

- no confirmed allergy means **allergy status unknown**;
- no confirmed condition means no active condition is confirmed, not that none exist;
- no confirmed medication means no active medication is confirmed, not that the patient takes none.

## Timeline

The timeline covers every structured resource type except the patient profile.

It supports:

- deterministic reverse-chronological sorting;
- resource-type filtering;
- text search over labels, details, status, source, and tags;
- source and verification context;
- source-document preview when provenance links to a local file;
- a separate undated section.

### Unknown-date policy

A resource with no known clinical date is never placed on the timeline using its storage timestamp as though that were the clinical event date.

Undated resources display:

- `Clinical date unknown` as the event date;
- the storage timestamp only as provenance;
- an explanation that storage time is not the event date.

## Emergency summary

The emergency summary is generated deterministically from confirmed structured records. It does not call an AI model.

It can include:

- patient name and identifiers;
- date of birth and calculated age;
- administrative sex;
- blood type;
- preferred language;
- contacts;
- code status;
- active allergies and reaction details;
- active medications and dosage text;
- active conditions and severity;
- latest confirmed dated vital observations.

The summary always includes limitations. Missing allergy, medication, condition, or code-status data remains unknown or unavailable. Pending candidates are counted but excluded until reviewed.

The print action opens a clean local print representation. It does not upload or transmit the summary.

## Header and product metadata

The primary header now identifies MediBrief as a **Local Personal Health Record**. Assistant controls are hidden in record-only views, and the browser title follows the selected patient and workspace.

The web-app manifest is renamed to **MediBrief - Personal Health Record**.

## Compatibility strategy

The existing Phase 1 functionality remains available:

- patient roster;
- confirmed-only HUD;
- candidate review;
- local source preview;
- backup and migration;
- durable notes, tasks, and appointment proposals;
- assistant, live voice, and scribe workflows;
- validated-only advisory rendering.

The first Phase 2 slice does not remove legacy compatibility stores. First-class Conditions, Allergies, Medications, and Labs modules are the next slice.

## Validation

The repository validation pipeline covers:

- default record-first startup;
- local record access without an AI key;
- confirmed-only overview output;
- candidate exclusion;
- durable appointment and task follow-up;
- timeline filtering and search;
- separate undated events;
- source-document propagation;
- emergency-summary uncertainty;
- recent dated vital selection;
- personal-record product wording.

The first complete validation run after implementation passed:

- TypeScript `tsc --noEmit`;
- 16 of 16 test files;
- 64 of 64 tests;
- Vite production build;
- 998 transformed modules.

The build continues to report the pre-existing non-blocking bundle-size and mixed-import optimization warnings. Performance optimization remains a separate workstream.
