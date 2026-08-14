# MediBrief Clinical Change Control

## Purpose

This process applies to any change that can affect patient-specific content, clinical interpretation, record truth, data disclosure, workflow status, or medical product claims.

## Changes requiring a clinical change package

A package is mandatory when a change adds or modifies:

- extraction of conditions, allergies, medications, measurements, dates, negation, uncertainty, temporality, or experiencer;
- patient-specific prompting or cloud data transmission;
- model IDs, providers, routing, privacy settings, prompts, tools, or output schemas;
- clinical rules, thresholds, alerts, recommendations, severity, prioritization, or action labels;
- medication matching, dose calculations, interactions, contraindications, or adjustments;
- summaries, emergency views, exports, timelines, trends, or terminology mappings;
- FHIR, IPS, SMART, DICOM, PACS, EHR, regulatory, privacy, security, or clinical-validation claims;
- order, prescription, appointment, referral, task, or completed-care workflows;
- encryption, migration, backup, audit, consent, or retention behavior.

## Required package contents

1. **Change identifier and owner**
   - engineering owner;
   - named clinical reviewer when patient-specific interpretation is involved;
   - privacy/security owner for new data flows.

2. **Intended use**
   - exact user;
   - exact task;
   - intended population;
   - care setting, if any;
   - whether output is informational, workflow, data quality, or clinical.

3. **Inputs and exclusions**
   - required structured fields and source types;
   - missing-data behavior;
   - explicit exclusions and unsupported populations;
   - language, unit, terminology, and date assumptions.

4. **Output contract**
   - schema and allowed severity;
   - prohibited wording and prohibited actions;
   - source/evidence display;
   - uncertainty and limitation text;
   - whether a human decision is required before persistence or action.

5. **Evidence and versioning**
   - exact source title, publisher, version/date, and locator;
   - exact model ID, provider-routing profile, prompt version, and output schema when AI is involved;
   - retained implementation-guide and terminology versions for interoperability.

6. **Hazard analysis**
   - affected existing hazards;
   - new hazardous situations;
   - control hierarchy;
   - residual risk and acceptance owner.

7. **Verification package**
   - positive, negative, missing-data, contradictory, boundary, multilingual, and adversarial cases;
   - expected outputs and prohibited outputs;
   - false-positive, false-negative, omission, and unsupported-addition thresholds;
   - deterministic regression fixtures where applicable;
   - browser/E2E evidence for consent, persistence, accessibility, and action semantics.

8. **Release and monitoring plan**
   - staged enablement or feature flag;
   - kill switch and rollback;
   - logging that excludes unnecessary sensitive content;
   - incident criteria;
   - review cadence and retirement conditions.

## Approval gates

A change must not be described as active or clinically suitable until:

- engineering validation passes;
- the hazard register is updated;
- required reviewers approve the retained package;
- product copy and the capability matrix match the code;
- no disabled path remains reachable through another mode or fallback;
- rollback has been demonstrated.

## Model/provider changes

Changing only a model alias, “latest” pointer, provider fallback, quantization, routing order, or prompt still counts as a clinical change when patient-specific data is involved. Exact immutable model IDs are preferred. A general model benchmark is not a substitute for task-specific MediBrief evaluation.

## Emergency suspension

Any owner may disable a function immediately when there is evidence of unsupported patient claims, source loss, privacy-policy drift, unsafe action semantics, material extraction regression, or inability to reproduce the reviewed configuration. Re-enablement requires a new or amended package.
