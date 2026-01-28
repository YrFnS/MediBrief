# 🗺️ MediBrief v4.2 - Clinical Operating System Roadmap

**Current Status:** v4.2 (Feature Complete)
**Target Status:** v5.0 (Production Hardening)

This roadmap outlines the transformation of MediBrief from a linear chat interface into a stateful, multi-patient management system.

---

## 📜 CODING STANDARDS & ARCHITECTURE RULES
**ALL UPDATES MUST ADHERE TO THE FOLLOWING STRICT PROTOCOLS:**

### 1. Code Quality
*   **500-Line Limit:** No file may exceed 500 lines.
    *   *Mitigation:* Split logic into custom hooks, utility modules, or sub-components immediately upon approaching 400 lines.
*   **Strict Typing:** `any` is prohibited unless interacting with untyped external libraries.

### 2. Feature-Based Architecture
We are moving away from horizontal grouping (e.g., `components/`, `hooks/`) to vertical feature grouping.
*   ✅ `features/patient-management/` (Store, Context, Logic)
*   ✅ `features/layout/` (Main shell)
*   ✅ `features/patient-roster/` (Sidebar UI)
*   ✅ `features/hud/` (Active Safety Monitor)
*   ✅ `features/fhir/` (Standardized Data)
*   ✅ `features/analytics/` (Trending)
*   ✅ `features/scribe/` (Ambient Listening)
*   ✅ `features/cdss/` (Rules Engine & Alerts)

---

## 📅 PHASE 1: Architectural Refactor (The Foundation)
**Goal:** Restructure the flat codebase to support complex state management without bloat.
- [x] **1.1 Directory Restructure**: Created `features/` structure.
- [x] **1.2 Global State Refactor**: Implemented `usePatientStore` to handle dictionary of patient contexts.
- [x] **1.3 Layout Extraction**: Moved monolithic `App.tsx` into `features/layout/MainLayout.tsx`.

---

## 📅 PHASE 2: Multi-Patient Roster
**Goal:** Allow clinicians to manage multiple patients simultaneously without context switching errors.
- [x] **2.1 Data Model**: Defined `PatientContext` and `PatientStatus`.
- [x] **2.2 UI Components**: Built `SidebarRoster`, `PatientCard`, and `AddPatientDialog`.
- [x] **2.3 Behavior**: Integrated with `MainLayout` and connected to `usePatientStore` actions.

---

## 📅 PHASE 3: Active Monitoring HUD
**Goal:** Persistent visibility of critical safety data, regardless of scroll position.
- [x] **3.1 Extraction Logic**: Implemented `extractEntitiesFromUpload` service and `useEntityExtractor` hook to run background safety scans on files.
- [x] **3.2 UI Components**: Built `HeadsUpDisplay` with dynamic safety badges (Allergies, Code Status).
- [x] **3.3 Integration**: Connected extraction trigger to `useChatOrchestrator` and HUD to `MainLayout`.

---

## 📅 PHASE 4: FHIR Interoperability Layer
**Goal:** Structure internal data to mimic hospital standards, enabling advanced graphing and export.
- [x] **4.1 Type Definitions**: Defined `FHIRObservation` and `ClinicalDataStore`.
- [x] **4.2 Data Transformation**: Implemented auto-ingestion in `useChatOrchestrator` to convert `lab-report` outputs into stored FHIR observations.
- [x] **4.3 Trend Graphing**: Integrated `recharts` and created `TrendGraph.tsx`. Updated `LabReport.tsx` to display historical trends when available.

---

## 📅 PHASE 5: Ambient Scribe Mode
**Goal:** Passive documentation of doctor-patient encounters.
- [x] **5.1 Architecture (`features/scribe/`)**: Implemented `useScribeSession` using Gemini Live API with a dedicated tool (`updateSoapNote`) for real-time extraction.
- [x] **5.2 UI Experience**: Created `ScribeInterface` with audio visualizer and live-updating SOAP fields.
- [x] **5.3 Integration**: Added `Scribe` to `ChatMode` and updated `MainLayout` to swap interfaces based on mode.

---

## 📅 PHASE 6: Clinical Decision Support (CDSS) Cards
**Goal:** Proactive, logic-driven alerts based on data patterns.
- [x] **6.1 Logic Engine**: Implemented `rulesEngine.ts` with Sepsis, Electrolyte, and BP protocols evaluating FHIR observations.
- [x] **6.2 UI Components**: Created `InterventionCard.tsx` and `CDSSContainer.tsx` to overlay alerts on the main chat interface.
- [x] **6.3 Integration**: Connected to `MainLayout` via `useCDSS` hook.

---

## 📅 PHASE 7: Production Hardening & PWA
**Goal:** Ensure the app is robust, performant, and accessible for real-world usage.

### 7.1 Resilience
*   Implement React Error Boundaries to prevent full app crashes on render errors.
*   Add toast notifications for non-critical errors.

### 7.2 Persistence
*   Migrate from `sessionStorage` to `localStorage` (or `IndexedDB` for images) to persist patient data across browser sessions.
*   Implement data export/import for full patient contexts.

### 7.3 Accessibility (A11y)
*   Ensure full keyboard navigation support for the Roster and CDSS cards.
*   Verify screen reader compatibility for dynamic updates (Live transcripts).

### 7.4 Progressive Web App (PWA)
*   Add `manifest.json` and Service Worker for offline capability (viewing cached data).
