# P2 Terminology and Multilingual Validation Acceptance

## Scope

P2 adds a governed terminology-review foundation and a permanent PHI-free multilingual document-evaluation gate. It does not enable diagnosis, medication safety, Arabic clinical NER, mixed-script clinical NER, or autonomous coding.

## Terminology review

- [x] Preserve original source text and quantity values.
- [x] Offer only exact reviewed LOINC aliases with explicit context.
- [x] Refuse generic specimen- or method-ambiguous observation labels.
- [x] Map reviewed unit aliases to case-sensitive UCUM codes.
- [x] Convert values only for an explicitly governed analyte/code/unit profile.
- [x] Remove the legacy hard-coded physiological plausibility verdict table.
- [x] Require a human action before applying LOINC or UCUM mappings.
- [x] Record terminology changes as amendments and audit events.
- [x] Support attachment of an RxNorm identifier supplied by a reviewed clinical source or terminology workflow.
- [x] Never search for, select, or invent an RxNorm identifier automatically.
- [x] Require a source description and explicit review acknowledgement before applying a medication identifier.
- [x] Do not bundle or search SNOMED CT content.
- [x] Require a supplied edition/version URI and licensing acknowledgement before attaching a SNOMED CT code.
- [x] State that MediBrief cannot verify SNOMED CT content, clinical appropriateness, edition, or licensing.

## Multilingual evaluation

- [x] Add a PHI-free corpus covering English, Arabic, and mixed-script cases.
- [x] Include discharge summaries, laboratory reports, medication lists, prescriptions, imaging reports, clinical notes, and degraded scan-derived text.
- [x] Score exact fact precision/recall/F1, unsupported additions, omissions, route accuracy, assertion context, dates, and quantities.
- [x] Report results overall, by language, and by document type.
- [x] Keep deterministic contract fixtures separate from measured runtime predictions.
- [x] Prevent a contract fixture from being accepted as measured evidence.
- [x] Retain the report and PHI-free inputs as CI artifacts.
- [x] Keep Arabic and mixed-script application routes blocked.

## Application behavior

- [x] Add a visible Terminology review center in the unlocked application.
- [x] Show current LOINC, UCUM, RxNorm, and externally supplied SNOMED CT coverage.
- [x] Show pending deterministic candidates and unresolved/refused items.
- [x] Explain licensing and clinical-validation boundaries in the user interface.
- [x] Make no external terminology request merely by opening the center.

## Automated validation completed before merge

- [x] Clean implementation branch reduced to one reviewed commit on top of `main` before final review.
- [x] MediBrief Clinical Validation passed on the pull-request merge reference: OpenMed bridge tests, English context evaluation, extraction metric contracts, provider-comparison contracts, TypeScript, the full automated suite, and the production Vite build.
- [x] P1 FHIR R4 / IPS 2.0.1 validation passed on the pull-request merge reference, including the official HL7 validator and PHI-free evidence upload.
- [x] P2 terminology and multilingual validation passed on the pull-request merge reference: Python evaluator tests, the PHI-free multilingual metric gate, terminology-governance Vitest tests, TypeScript, production build, and retained evidence artifacts.
- [x] Chromium acceptance passed six tests, including candidate-only IPS import and explicit-only terminology review with no request made when the terminology center opens.
- [x] The built branch shell was checked directly for disallowed remote runtime dependencies.
- [x] The deployment/header contract was unchanged, so the hardened live production contract was verified for CSP, framing, MIME sniffing, referrer policy, permissions policy, service-worker scope, and service-worker cache control.

## Hosting quota note

Automatic Netlify and Vercel preview builds were attempted for the final pull-request head but were skipped or rejected by account build-usage limits rather than an application build failure. P2 does not modify `netlify.toml`, `vercel.json`, or `public/_headers`. The browser gate therefore verifies the reviewed branch build locally and the unchanged provider header contract against the live production endpoint. The workflow still requires a fresh public preview whenever any deployment or header-contract file changes.

## Evidence boundary

Passing P2 engineering gates establishes the behavior of the reviewed subset, amendment workflow, and evaluation plumbing. It does not establish complete terminology coverage, correct coding for every source phrase, Arabic or mixed-script model accuracy, source authenticity, patient identity, clinical truth, prospective clinical validation, regulatory clearance, or medication-safety capability.
