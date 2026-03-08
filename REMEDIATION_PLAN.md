# 🏥 MediBrief Remediation Plan

**Primary Objective:** Address critical safety, security, and architectural flaws identified in the clinical audit to transition the application from a UI prototype to a robust, medical-grade Clinical Decision Support System (CDSS).

---

## 📜 Core Implementation Rules

To ensure high code quality, maintainability, and safety, all remediation work **MUST** adhere to the following strict rules:

### 1. The 500-Line Limit (Strict Enforcement)
*   **No file may exceed 500 lines.**
*   If a file approaches this limit, it must be refactored into:
    *   **Sub-components:** Break down large UIs into smaller, readable pieces.
    *   **Custom Hooks:** Move client-side state and `useEffect` logic out of the component.
    *   **Services/Utils:** Move complex data formatting or business logic into pure `.ts` files.

### 2. Single Responsibility Principle (SRP)
*   **Each file does ONE thing well.**
*   A UI component renders UI.
*   A Service function handles business logic or API calls.
*   A Store manages state.
*   *Never mix UI rendering and complex clinical logic (like dosage calculations) in the same file.*

### 3. Strict Typing & Validation (The "No Trust" Rule)
*   **Zero `any` Types:** TypeScript must be strictly enforced.
*   **Zod for Everything:** Use Zod to validate all incoming data, including LLM outputs, API payloads, and form submissions.

---

## 🚨 Phase 1: Cryptographic Hardening
**Risk Level:** CRITICAL (Security)
**Target:** `services/encryptionService.ts`, `features/security/SecurityGate.tsx`

*   [ ] **Deprecate 4-Digit PIN:** Replace the 4-digit PIN requirement with a strong passphrase policy (minimum 12 characters, alphanumeric + symbols) to expand the PBKDF2 keyspace and prevent trivial brute-forcing.
*   [ ] **Implement Key Stretching/Salting Improvements:** Ensure the salt is cryptographically secure and unique per user/device.
*   [ ] **Rate Limiting / Lockout:** Implement an exponential backoff or lockout mechanism in `SecurityGate` after consecutive failed decryption attempts to thwart automated brute-force scripts.

## 🧠 Phase 2: Robust Clinical Data Extraction
**Risk Level:** HIGH (Safety)
**Target:** `features/cdss/rulesEngine.ts`, `features/fhir/types.ts`

*   [ ] **Remove Brittle Regex/Includes:** Replace `String.includes()` matching (e.g., matching "potassium" to a pain score of 8) with strict, context-aware extraction.
*   [ ] **LLM-Assisted Structuring:** Route unstructured clinical notes through a strict Zod-schema LLM extraction pipeline to accurately map values to specific FHIR LOINC codes before feeding them into the deterministic rules engine.
*   [ ] **Unit & Context Validation:** Ensure the rules engine validates the semantic context (e.g., "Is this a lab value or a pain score?") and standardizes units before comparison.

## 💊 Phase 3: Comprehensive Pharmacology Guardrails
**Risk Level:** HIGH (Safety)
**Target:** `features/safety/dosageVerifier.ts`, `features/safety/openFdaService.ts`

*   [ ] **Expand Critical Limits Database:** Replace the hardcoded 4-drug dictionary with a comprehensive, externally maintained JSON dictionary of critical limits for high-risk medications (e.g., Opioids, Anticoagulants, Insulin).
*   [ ] **Smart openFDA Querying:** Implement a sanitization function to strip dosages, routes, and units from drug names (e.g., convert "Tylenol 500mg PO" to "Tylenol") before querying the openFDA API to prevent 404 errors on exact matches.
*   [ ] **True Pediatric Calculations:** Implement actual mg/kg dosage calculations for pediatric and low-weight patients instead of just rendering a generic warning string. Compare the calculated dose against the extracted dose.

## 📝 Phase 4: Context Substitution Reliability
**Risk Level:** MEDIUM (Accuracy)
**Target:** `services/geminiService.ts`

*   [x] **Fix `extractImageInsights` Fallback:** Remove the arbitrary 300-character slice fallback. 
*   [x] **Structured Summarization:** If JSON parsing fails, use a lightweight, dedicated LLM call to summarize the clinical findings of the previous turn, ensuring the actual medical insight is preserved for the context window.
*   [x] **Validation:** Ensure the injected context always contains actionable clinical data rather than conversational preamble.

## 🛡️ Phase 5: Programmatic Source Verification
**Risk Level:** MEDIUM (Liability)
**Target:** `features/chat/components/Message.tsx`, `services/geminiService.ts`

*   [x] **Enforce Source Allowlist:** Do not rely solely on the LLM's system prompt to filter sources. Implement a programmatic interceptor that parses the `groundingMetadata`.
*   [x] **Strict Filtering:** Automatically strip or prominently flag any grounding sources that do not match a strict regex of allowed domains (`.gov`, `.edu`, `.org`, `mayoclinic.org`, etc.).
*   [x] **UI Transparency:** Clearly indicate in the UI when a source was rejected due to low credibility.

---
**Status:** 🟢 **IMPLEMENTED (Phases 1-5)**
