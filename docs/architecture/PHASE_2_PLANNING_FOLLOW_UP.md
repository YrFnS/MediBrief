# Phase 2 Planning and Follow-up Modules

## Purpose

This document describes Phase 2 Slice 4: first-class interfaces for appointments, tasks and reminders, and care plans.

The slice uses the existing versioned Phase 1 resources:

- `AppointmentRecord`
- `ClinicalTaskRecord`
- `CarePlanRecord`

No persistence, backup, or schema migration is required. The modules extend the existing **Health Data** workspace, bringing it to twelve clinical domains while keeping the top-level patient navigation compact.

## Shared confirmed-record boundary

Appointments, tasks, and care plans use the same confirmed-patient-fact policy as every other Phase 2 module.

Default lists exclude:

- pending candidates;
- rejected resources;
- entered-in-error verification states;
- negated assertions;
- hypothetical assertions;
- family-attributed assertions presented as the patient’s own record.

Each module shows its relevant candidate count and routes the user to the existing patient-scoped review queue. Slice 4 does not introduce a second confirmation system.

Every detailed record preserves:

- source kind and source label;
- storage and update timestamps;
- amendment count;
- extraction confidence when available;
- tags;
- original local source-document preview when provenance provides one.

## Appointments

The Appointments module separates:

- **Current** — proposed, pending, booked, arrived, or unknown status;
- **History** — fulfilled, cancelled, no-show, or entered-in-error status;
- **All** — both groups.

It supports search and filters for status and requested-time state.

Appointment details include:

- title;
- explicit status;
- status meaning;
- start and end date-time when recorded;
- requested periods;
- upcoming, past, or unknown requested-time state;
- reasons;
- participants, roles, and participation statuses;
- location;
- linked encounter;
- notes;
- provenance and original source.

### Booking boundary

A date or time does not establish a booking.

The module uses explicit wording:

- `proposed` → **Proposed — not booked**
- `pending` → **Pending — booking not confirmed**
- `booked` → **Recorded as booked**

MediBrief does not contact a clinic, reserve a time, or independently verify availability. Even a booked state is presented as the state recorded by its confirmed source.

### Unknown date policy

If neither a valid start date-time nor a known requested period exists, the requested time remains **Clinical date unknown**. Storage time is never substituted.

## Tasks and reminders

The Tasks and Reminders module separates:

- **Open** — draft, requested, received, accepted, or in-progress tasks;
- **History** — completed, cancelled, failed, or entered-in-error tasks;
- **All** — both groups.

It supports filters for:

- due/reminder state;
- task status;
- intent;
- priority;
- text and source content.

Task details include:

- title and optional code;
- status;
- intent;
- priority;
- description;
- due date or period;
- owner;
- related structured records;
- completion timestamp when recorded;
- notes;
- provenance and original source.

### Local reminder derivation

Reminder state is calculated deterministically from the confirmed task status and due date:

- **Overdue** — an open task whose known due period ended before today;
- **Due today** — a known due period overlapping today;
- **Upcoming** — a known due date within seven days;
- **Later** — a known future due date beyond seven days;
- **Due date unknown** — an open task without a known due date;
- **Closed** — a non-open task.

A reminder is only a local record view. It does not send a clinic notification, transmit an order, or prove that care was performed.

### Task intent boundary

Task intent is displayed exactly as recorded:

- proposal → **Proposal only — not an order**
- plan → **Planned activity — completion not confirmed**
- order-like intents → **Recorded order intent — external execution not confirmed**

The UI never converts an intent into evidence of execution.

## Care plans

The Care Plans module separates:

- **Current** — draft, active, on-hold, or unknown status;
- **History** — completed, revoked, or entered-in-error status;
- **All** — both groups.

It supports status, intent, and full-text filters.

Care-plan details include:

- title;
- status;
- intent;
- description;
- plan period;
- addressed conditions;
- activity tasks;
- linked encounter;
- notes;
- provenance and original source.

References are resolved against the patient’s structured record. Broken condition, task, or encounter references remain explicit instead of being silently omitted.

### Plan intent boundary

The module distinguishes:

- proposal — not yet an active plan;
- plan — activities may still be pending;
- order — external execution is not confirmed;
- option — not selected or executed by implication.

A care plan does not prove that every activity was accepted, ordered externally, or completed.

### Unknown period policy

An absent or explicitly unknown care-plan period remains **Clinical date unknown**. Storage and update timestamps remain provenance only.

## Validation scope

Slice 4 regression coverage verifies:

- proposed appointments remain explicitly not booked;
- booked status is represented only when recorded;
- appointment candidates remain outside confirmed lists;
- unknown requested periods remain unknown;
- overdue and unknown-date reminders are derived deterministically;
- task proposal, plan, and order-intent boundaries remain explicit;
- task related-record links resolve correctly;
- care plans link conditions, tasks, and encounters;
- broken care-plan references remain visible;
- unknown care-plan periods remain unknown;
- provenance and original-source review remain available across all three modules;
- clinically honest empty states and execution boundaries remain in user-facing copy.

The repository workflow continues to run TypeScript validation, all Phase 1 and Phase 2 tests, and the production Vite build.
