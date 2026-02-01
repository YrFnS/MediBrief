
# 🛡️ MediBrief v5.1 - Clinical Safety & Remediation Plan

**Audit Reference:** Clinical Application Audit v5.0
**Primary Objective:** Transition from "Prototype" to "Deployment-Ready Clinical Tool" by addressing critical safety and security gaps.

---

## 🚨 Phase 1: Clinical Fidelity (The "Generic Patient" Fix)
**Risk Level:** HIGH (Safety)
**Status:** ✅ **COMPLETED**
- [x] Added `PatientDemographics` (Age, Weight, Sex).
- [x] Updated UI to capture demographics.
- [x] Updated `dosageVerifier.ts` to flag missing weight and pediatric risks.

---

## 🔐 Phase 2: Zero-Knowledge Security (Encryption)
**Risk Level:** CRITICAL (Compliance)
**Status:** ✅ **COMPLETED**
- [x] Implemented `EncryptionService` (PBKDF2 + AES-GCM).
- [x] Updated `storage.ts` to transparently encrypt/decrypt.
- [x] Implemented `SecurityGate` UI for PIN entry.
- [x] Updated Stores to `skipHydration` until unlocked.

---

## 📜 Phase 3: Accountability (Audit Trails)
**Risk Level:** MEDIUM (Liability)
**Issue:** No logs exist to prove "AI Suggestion" vs "Human Action".
**Status:** ✅ **COMPLETED**

### 3.1 Audit Store
- [x] Create `features/audit/useAuditStore.ts` with encrypted persistence.
- [x] Define `AuditEvent` schema.

### 3.2 Instrumentation
- [x] `features/chat/hooks/useChatOrchestrator.ts` -> Logs exports & briefings.
- [x] `features/cdss/CDSSContainer.tsx` -> Logs alert dismissals & actions.
- [x] `features/chat/components/Message.tsx` -> Logs dosage verification results.

---

## 🏗️ Phase 4: Architecture & Code Hygiene
**Risk Level:** LOW (Maintenance)
**Status:** ✅ **COMPLETED**
- [x] Deleted `features/patient-management/reducer.ts`.
- [x] Moved `pcm-processor.js` to `public/workers/` for CSP compliance.
- [x] Extracted Security/Idle logic to `hooks/useSecurityLock.ts`.

---

## ✅ Phase 5: Verification & Constraints
**Risk Level:** MEDIUM (Accuracy)
**Issue:** Reliance on generic web search.
**Status:** ✅ **COMPLETED**

### 5.1 Strict Source Filtering
- [x] `constants.ts`: Updated System Instructions to ban generic news/blogs.
- [x] `constants.ts`: Updated `DRUG_ANALYSIS_PROMPT` to use `site:gov OR site:org` search operators.

### 5.2 Zod Schema Hardening
- [x] `features/chat/schemas.ts`: Added `.min(1)`, `.nonnegative()`, and strict bounds for critical fields.

---

## 📅 Execution Order
1.  **Phase 1 (Clinical Fidelity)** - *Done*
2.  **Phase 4 (Hygiene)** - *Done*
3.  **Phase 2 (Encryption)** - *Done*
4.  **Phase 3 (Audit)** - *Done*
5.  **Phase 5 (Verification)** - *Done*

**System Status:** 🟢 **READY FOR DEPLOYMENT (v5.1)**
