# P4 Workspace Information Hierarchy

## Scope

P4 simplifies the personal health record workspace without changing the
clinical-record schema, confirmation rules, provenance model, FHIR behavior,
terminology rules, decision-support boundary, or cloud-safety policy.

The previous Health Data view exposed fifteen equal-weight modules in one
horizontal strip. The P4 slice replaces that flat navigation with a progressive
hierarchy:

1. a small set of task-oriented patient-record destinations;
2. six clinical areas inside the Health Record destination; and
3. area-specific sections shown only when relevant.

## P4.1 Primary patient-record destinations

- [x] Rename Overview to **Today** while retaining the internal `overview`
  route value for backward compatibility.
- [x] Rename Health Data to **Health Record** while retaining the internal
  `health-data` route value.
- [x] Keep Timeline, Search & Export, Emergency, and Assistant visible.
- [x] Keep pending-candidate badges on Today and Health Record.
- [x] Preserve roving-tab keyboard behavior with Arrow, Home, and End keys.
- [x] Preserve the patient-record content landmark and tab relationships.

The labels describe implemented behavior only. Search & Export remains local;
P4 does not claim secure messaging, receiver delivery, or remote sharing.

## P4.2 Health Record areas

- [x] Replace the fifteen-module tab strip with six areas:
  - Health Record
  - Medications
  - Results
  - Care
  - Documents
  - Manage
- [x] Group conditions, allergies, visits, procedures, immunizations, and notes
  under Health Record.
- [x] Group medication history and medication reconciliation under Medications.
- [x] Group laboratory/report review and trends/reminders under Results.
- [x] Group appointments, tasks, and care plans under Care.
- [x] Keep original documents in their own area.
- [x] Keep manual entry, corrections, and durable history in Manage.
- [x] Retain every existing module component and module identifier.

## P4.3 Progressive secondary navigation

- [x] Show only the sections belonging to the active area.
- [x] Remember the last selected section inside each area during the session.
- [x] Provide a compact native select on narrow screens.
- [x] Provide labelled section buttons on wider screens.
- [x] Keep minimum touch targets at 44 CSS pixels.
- [x] Show area-level and section-level review/follow-up badges.
- [x] Explain the active area's purpose before the detailed module.
- [x] Keep the active module content in a shrinkable full-height panel.

## P4.4 Medical and data-safety boundary

- [x] Do not change candidate, confirmed, rejected, or entered-in-error
  semantics.
- [x] Do not auto-confirm any record.
- [x] Do not change provenance, amendments, source links, or audit behavior.
- [x] Do not introduce diagnosis, prescribing, dose, treatment, or triage
  behavior.
- [x] Do not add an external request.
- [x] Do not change the encrypted vault or cloud-processing consent boundary.
- [x] Do not change FHIR/IPS import, export, receiver, or terminology behavior.

P4 is an information-architecture and accessibility change. Counts mean only
that an item requires review or explicit follow-up under existing deterministic
logic; they do not indicate severity or clinical priority.

## P4.5 Automated validation

- [x] Add source-contract tests for the six-area hierarchy.
- [x] Verify every existing clinical module remains reachable.
- [x] Verify the desktop and mobile secondary-navigation contracts.
- [x] Preserve existing Phase 2 accessibility and responsive contracts.
- [x] Add Chromium acceptance for primary destinations, all six areas, section
  discovery, and keyboard navigation.
- [x] Add a permanent P4 GitHub Actions workflow.
- [ ] Pass application type-check on the final branch head.
- [ ] Pass focused P4 and existing workspace regression tests.
- [ ] Pass the full MediBrief clinical regression.
- [ ] Pass the official FHIR R4 / IPS validation regression.
- [ ] Pass P1.3, P1.4, P1.5, P2, and P3 regressions.
- [ ] Pass Chromium acceptance on the pull-request merge reference.
- [ ] Review and merge through a pull request.
- [ ] Pass post-merge validation on `main`.

## Deliberately deferred

- Redesigning individual clinical module internals.
- Persisting navigation state between browser sessions.
- Replacing the timeline or emergency summary.
- Adding receiver delivery, secure messaging, or remote sharing.
- Completing P3 measured clinical validation without a governed study dataset,
  named runtime configurations, and clinician review.
- Promoting a production deployment while hosting-account limits prevent an
  exact-commit build.

## Evidence boundary

P4 can establish that the implemented information hierarchy is reachable,
keyboard-operable, responsive, and regression-tested. It cannot establish that
the clinical record is complete, that a candidate is true, that a follow-up is
medically urgent, that the application is a certified medical device, or that
the workspace has completed prospective clinical usability validation.
