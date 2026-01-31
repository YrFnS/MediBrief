
# 🛡️ MediBrief Remediation Plan (v5.0 Hardening)

This document outlines the step-by-step execution plan to address the 8 critical issues identified in the architectural audit.

**CORE RULES:**
1.  **500-Line Limit:** Strict enforcement. Split components/hooks if they grow too large.
2.  **Feature-Based Structure:** All new logic resides in `features/` folders, not generic top-level folders.
3.  **Single Responsibility:** One file, one purpose.

---

## 🚨 Phase 1: Critical Safety Layer (Highest Priority)
**Goal:** Prevent clinical errors due to API failures and malformed AI data.

### Task 1.1: OpenFDA "Tri-State" Safety
*   **Issue:** `features/safety/openFdaService.ts` silently catches errors and returns `{ found: false }`.
*   **Fix:**
    *   ✅ Update `DrugSafetyInfo` type to include a status: `'verified' | 'not_found' | 'service_error'`.
    *   ✅ Update `verifyMedicationSafetyAsync` in `dosageVerifier.ts` to handle the `service_error` state explicitly.
    *   **UI:** ✅ Display a yellow "Network Error" badge in `Message.tsx` instead of a generic safe/unsafe state.

### Task 1.2: Zod Schema Validation
*   **Issue:** `useChatOrchestrator.ts` uses `JSON.parse()` on LLM output without validation.
*   **Fix:**
    *   ✅ Install `zod`.
    *   ✅ Create `features/chat/schemas.ts` to define strict schemas for `Briefing`, `LabReport`, and `InteractionMatrix`.
    *   ✅ Replace unsafe `JSON.parse` with `Schema.safeParse()`.
    *   ✅ Implement an "Auto-Repair" or "Discard" strategy for malformed JSON.

---

## 🏗️ Phase 2: Infrastructure & Security
**Goal:** Prevent browser crashes and comply with hospital security policies.

### Task 2.1: Storage Migration (The 5MB Wall)
*   **Issue:** `useChatStore` and `usePatientStore` use `sessionStorage` (Limit: ~5MB).
*   **Fix:**
    *   ✅ Install `idb-keyval` (lightweight IndexedDB wrapper).
    *   ✅ Create a custom Zustand storage engine `indexedDBStorage` in `utils/storage.ts`.
    *   ✅ Migrate `useChatStore` and `useClinicalStore` to use this async storage.
    *   *Note:* `usePatientStore` (Metadata) can remain in `localStorage` for fast sync access.

### Task 2.2: AudioWorklet CSP Compliance
*   **Issue:** `hooks/useLiveSession.ts` and `features/scribe/useScribeSession.ts` use `URL.createObjectURL` with inline strings. This violates strict CSPs.
*   **Fix:**
    *   ✅ Extract the PCM processor code into a static file: `public/workers/pcm-processor.js`.
    *   ✅ Update hooks to load the worklet via path `await ctx.audioWorklet.addModule('/workers/pcm-processor.js')`.
    *   ✅ Add a fallback for environments where external script loading is blocked.

---

## ⚡ Phase 3: Stability & Concurrency
**Goal:** Eliminate race conditions and memory leaks.

### Task 3.1: Async Cancellation Pattern
*   **Issue:** `useEntityExtractor` and `dosageVerifier` do not cancel pending promises if the patient context changes.
*   **Fix:**
    *   ✅ Refactor `verifyMedicationSafetyAsync` to accept an `AbortSignal`.
    *   ✅ In `Message.tsx`, use `useEffect` cleanup to abort the signal when the component unmounts.
    *   ✅ In `useChatOrchestrator` (via `useEntityExtractor`), ensure the `AbortController` is triggered on patient switch.

---

## 🎨 Phase 4: Clinical UX Refinement
**Goal:** Reduce cognitive load and prevent alert fatigue.

### Task 4.1: Dosage "Human-in-the-Loop"
*   **Issue:** Safety checks happen automatically without user confirmation of the extracted values.
*   **Fix:**
    *   ✅ Update `Message.tsx` to show an "Extracted Data" card *before* running the safety check.
    *   ✅ Add "Confirm" / "Edit" buttons to the medication list.
    *   ✅ Only run `verifyMedicationSafetyAsync` after user confirmation.

### Task 4.2: CDSS Alert Grouping
*   **Issue:** `CDSSContainer` renders a stack of individual toasts, potentially obscuring the chat.
*   **Fix:**
    *   ✅ Create a `CDSSAggregator` component.
    *   ✅ If >1 alert exists, render a single summary card: *"3 Clinical Alerts (Sepsis, Renal)"*.
    *   ✅ On click, expand to show the individual `InterventionCard`s in a modal or drawer.

### Task 4.3: Mobile Scribe Layout
*   **Issue:** `ScribeInterface` splits 50/50 on desktop but stacks poorly on mobile.
*   **Fix:**
    *   ✅ Refactor `ScribeInterface.tsx`.
    *   ✅ **Mobile:** Sticky top header for the Audio Visualizer. The Transcript should be a collapsible drawer.
    *   ✅ **Desktop:** Maintain the split view but enforce min-heights.

---

## 📝 Phase 5: Documentation & Handover
**Goal:** Prepare for v5.0 release.

### Task 5.1: Architecture Diagram & README
*   ✅ Update `README.md` with the new IndexedDB architecture.
*   ✅ Document the Zod schemas and OpenFDA error states.
