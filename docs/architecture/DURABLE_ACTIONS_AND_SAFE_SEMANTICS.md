# Durable Actions and Safe Clinical Semantics

## Purpose

This note records the Phase 1.5 changes that separate local records, proposals, reminders, acknowledgements, external bookings, clinical orders, and completed care.

The governing rule is:

> MediBrief must describe only the state it actually persisted. A local proposal is not a booking, a task is not an order, an acknowledgement is not treatment, label lookup is not regimen validation, and an image filter is not a PACS workstation.

## Action-state model

| User-visible event | Durable representation | What it means | What it does not mean |
|---|---|---|---|
| Appointment request | `AppointmentRecord`, `status: proposed` | A requested date/time was saved locally | A clinic accepted, reserved, or booked the appointment |
| Follow-up reminder | `ClinicalTaskRecord`, `intent: proposal`, `status: requested` | The user saved a task to revisit an advisory | A test, drug, referral, or treatment was ordered |
| Advisory acknowledgement | Audit event plus legacy advisory dismissal | The user saw and acknowledged the advisory | The underlying issue was resolved or treated |
| Reviewed scribe save | Confirmed `ClinicalNoteRecord`, `status: final` | The visible SOAP fields were explicitly saved | Every statement is independently verified clinical truth |
| Reviewed lab row | Confirmed `ObservationRecord` | The user accepted the extracted numeric row | An automated diagnosis or treatment recommendation was generated |

## Appointment proposals

The existing live tool keeps its historical function name for API compatibility, but its contract now says that it saves a local proposal only.

The durable record:

- uses `Appointment.status = proposed`;
- preserves the requested date text;
- keeps invalid or absent dates explicitly unknown;
- records a normalized start timestamp only when both date and time are valid;
- uses `not-booked` and `appointment-request` tags;
- includes confirmation provenance for the user's request to save the proposal;
- tells the user that no clinic was contacted.

## Reviewed SOAP notes

The ambient-scribe interface no longer treats chat output as the note of record.

When the user selects **Save Reviewed Note**, MediBrief:

1. requires at least one non-empty SOAP field;
2. creates a confirmed `ClinicalNoteRecord`;
3. stores the visible SOAP sections and available source transcript;
4. records AI-assisted provenance and the user's explicit save action;
5. adds a chat notification containing the durable record ID;
6. writes a `CLINICAL_NOTE_SAVED` audit event.

The note is durable even if chat history is later cleared.

## Advisory handling

The previous deterministic rules are disabled because isolated values were being labelled as diagnoses or protocol states without required baseline and patient context.

`evaluateClinicalSafety()` remains as a compatibility entry point but returns no alerts. The UI also displays only advisories carrying `validationStatus: validated`, so persisted legacy alerts cannot produce blocking overlays or treatment-style buttons.

For future validated advisories:

- `acknowledge` records acknowledgement and dismisses the notification;
- `create-task` creates a durable proposal task;
- legacy `order` actions are interpreted as **create task**, never as an order;
- `dismiss` removes the transient advisory while retaining its audit history.

## Medication label review

Medication handling is split into two distinct concepts:

### Implemented

- user-reviewed medication-name extraction;
- limited openFDA label lookup;
- boxed-warning and general-warning text display;
- explicit missing-label and service-error reporting.

### Not implemented or claimed

- dose validation;
- total daily dose calculation;
- frequency, route, duration, formulation, or indication validation;
- drug-drug or drug-allergy assessment;
- pregnancy, kidney, liver, age, or weight adjustment;
- a binary safe/unsafe result.

The old `criticalLimits.json` table was removed. `dosageVerifier.ts` remains only as a deprecated compatibility wrapper around `medicationLabelReviewService.ts`.

## Medical image viewer

The simple HTML image viewer is now labelled **Medical Image Viewer**.

It supports basic zoom, pan, CSS contrast, and color inversion. The UI explicitly states that it is not a DICOM/PACS workstation, and color inversion is no longer described as a bone window.

## AI prompt semantics

The main AI instructions now describe MediBrief as a local personal-record assistant rather than an autonomous safety or order-entry layer.

The prompts require the model to:

- treat extracted clinical claims as candidates;
- preserve missing and uncertain information;
- avoid claiming completed external actions;
- describe appointment records as proposed and not booked;
- describe medication lookup as limited label information;
- describe image output as AI-assisted observations rather than a radiology report;
- return no automated CDSS alerts while protocol validation is incomplete.

## Unknown dates

Operational timestamps such as upload, save, and review time remain known timestamps. They must not be substituted for an unknown clinical event date.

Appointment proposals and reviewed lab observations therefore preserve unknown clinical dates explicitly while still recording when the local record itself was created.

## Compatibility boundary

The legacy observation/advisory store remains during Phase 1 migration, but:

- unvalidated legacy advisories are hidden;
- the old rule-engine entry point returns no alerts;
- reviewed observations still dual-write temporarily for older views;
- the structured clinical record is the durable source for new notes, tasks, appointments, and confirmed patient-facing facts.

Repository-integrated tests and final compatibility cleanup remain Phase 1.6 work.
