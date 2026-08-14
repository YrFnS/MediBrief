# P0 Safety Boundary Acceptance

## Acceptance criteria

### Product language

- [x] Primary documentation describes a local personal health record and evidence-review assistant.
- [x] The application displays an authoritative capability matrix.
- [x] Disabled and planned capabilities are visibly distinguished from active features.
- [x] The updated disclaimer is shown under a new acknowledgement version.

### Cloud boundary

- [x] Cloud processing starts disabled in every new tab.
- [x] General disclaimer acceptance does not grant cloud permission.
- [x] OpenRouter chat requests are intercepted at the browser network boundary.
- [x] Privacy routing requests ZDR and denies data collection.
- [x] Provider fallback is disabled.
- [x] Patient-record and medical document/image requests fail closed without a registry entry.
- [x] A blocked request opens the explanatory safety panel.
- [x] Unit tests cover request classification, consent, registry blocking, and routing rewrite.

### Local vault

- [x] New setup requires at least 12 characters and rejects numeric-only secrets.
- [x] New credentials use policy version 2 and a higher PBKDF2 work factor.
- [x] Existing policy-version-1 vaults retain their original work factor and remain unlockable.
- [x] Repeated failures create increasing browser-side retry delays.
- [x] Legacy status and migration limitations are visible.

### Production shell

- [x] No Tailwind CDN script remains.
- [x] No Google Fonts or external icon URL remains in the active HTML/manifest.
- [x] No runtime import map remains.
- [x] CSS is built with local Tailwind/PostCSS dependencies.
- [x] CSP permits only self-hosted scripts.
- [x] Camera and microphone permissions are disabled.
- [x] The service worker caches same-origin app-shell assets only.
- [x] Netlify preview responses expose the expected CSP and security headers.
- [x] The service-worker response exposes the expected scope and revalidation headers.

### Governance

- [x] Known limitations are documented.
- [x] Clinical hazards are registered.
- [x] Clinical change-control requirements are documented.
- [x] The reviewed model/provider registry starts empty and fail-closed.

## Validation completed before merge

- [x] TypeScript application typecheck.
- [x] Full Vitest suite.
- [x] OpenMed Python tests and synthetic evaluation contracts.
- [x] Production Vite build.
- [x] GitHub Actions clinical-validation workflow.
- [x] Playwright acceptance test typecheck.
- [x] Chromium first-run vault setup and numeric-only rejection.
- [x] Disclaimer v2 and separate cloud-consent behavior.
- [x] Safety and capability matrix with Available, Experimental, Disabled, and Planned groups.
- [x] Cloud-consent enable and revoke flow scoped to the current browser tab.
- [x] Unreviewed patient-record request blocked before any OpenRouter network request.
- [x] Legacy version-one PIN vault unlock and migration-warning copy.
- [x] Production service-worker registration and offline app-shell reload.
- [x] Public Netlify preview CSP, permissions, framing, MIME, referrer, and service-worker headers.

## Evidence boundary

These checks establish implementation and deployment behavior for the P0 safety boundary. They do not constitute clinical certification, prospective clinical validation, regulatory clearance, or approval of any cloud model for patient-specific use.
