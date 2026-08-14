# MediBrief P2 — Governed Terminology and Multilingual Validation

**Branch:** `agent/p2-terminology-multilingual-validation`

**Status:** Accepted and ready to merge.

**Objective:** Improve semantic interoperability and document-evaluation discipline without converting source text into unreviewed clinical truth or enabling unevaluated multilingual routes.

## P2.1 Terminology registry

- [x] Define canonical LOINC, UCUM, RxNorm, and SNOMED CT system metadata.
- [x] Record content/version and licensing boundaries.
- [x] Bundle only a small reviewed exact-alias LOINC subset.
- [x] Refuse generic specimen- and method-ambiguous observation names.
- [x] Add reviewed English and Arabic aliases for the same precisely defined observations.

## P2.2 Unit normalization

- [x] Map reviewed source-unit aliases to case-sensitive UCUM codes.
- [x] Preserve original quantities.
- [x] Convert only when analyte code and source unit match an explicit conversion profile.
- [x] Remove legacy hard-coded physiological plausibility verdicts.
- [x] Preserve unknown units and return a non-clinical warning.

## P2.3 Medication and clinical-concept coding

- [x] Add source-provided RxNorm coding for an existing medication record.
- [x] Require a reviewed RxCUI, display, and source description.
- [x] Do not search for or choose a medication concept inside MediBrief.
- [x] Do not perform interaction, dose, or medication-safety checking.
- [x] Do not bundle or search SNOMED CT.
- [x] Accept SNOMED CT coding only from an acknowledged external licensed source with an edition/version URI.

## P2.4 Review workflow

- [x] Add an in-app terminology review center.
- [x] Display coverage and pending deterministic candidates.
- [x] Apply mappings only through explicit human review.
- [x] Preserve source text/value and amendment history.
- [x] Audit terminology mapping actions.
- [x] Display licensing and clinical-validation boundaries.

## P2.5 Multilingual document evaluation

- [x] Add a PHI-free English, Arabic, and mixed-script corpus.
- [x] Cover seven representative document types.
- [x] Measure fact precision/recall/F1, unsupported additions, omissions, language routing, assertion axes, dates, and quantities.
- [x] Group metrics by language and document type.
- [x] Separate deterministic contract fixtures from measured runtime output.
- [x] Prevent contract results from enabling Arabic or mixed-script clinical extraction.

## P2.6 Validation gates

- [x] Add terminology-governance Vitest tests.
- [x] Add Python evaluator tests.
- [x] Add a permanent P2 GitHub workflow and retained PHI-free artifacts.
- [x] Add Chromium acceptance for explicit-only terminology review.
- [x] Pass full clinical regression on the branch and pull-request merge reference.
- [x] Pass official FHIR R4 / IPS 2.0.1 validation on the pull-request merge reference.
- [x] Pass the P2 terminology and multilingual gate on the pull-request merge reference.
- [x] Pass six Chromium acceptance tests.
- [x] Verify the branch-built shell and unchanged live deployment/header contract.
- [x] Record the Netlify/Vercel account-quota exception without weakening the requirement for a fresh preview when deployment/header files change.

## Deliberately deferred

- Full LOINC distribution or authenticated production terminology service integration.
- Measured Arabic clinical NER and Arabic assertion-context model approval.
- Measured mixed-script clinical NER approval.
- Automated SNOMED CT search, mapping, or distribution.
- Terminology-server validation of externally supplied SNOMED CT codes.
- Clinician-blinded real-world document study and prospective workflow validation.
- Patient-specific medication safety, interactions, dosing, or contraindication logic.

## Safety boundary

A terminology code improves semantic representation only when it faithfully represents the source. It does not prove diagnosis, allergy status, medication appropriateness, result accuracy, patient identity, source authenticity, or record completeness. Synthetic evaluation and contract fixtures are engineering evidence, not clinical certification.
