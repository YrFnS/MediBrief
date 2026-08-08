
# 🩺 MediBrief - Clinical Intelligence Layer (v5.1)

**MediBrief** is a medical-grade intelligence layer designed to act as a proactive safety partner for healthcare professionals. Unlike standard chatbots, it functions as a **Clinical Decision Support System (CDSS)**, synthesizing raw patient data into structured, actionable artifacts while enforcing strict safety protocols.

It uses **browser-local OpenRouter BYOK** for optional AI requests: the user enters a key into the encrypted local vault, explicitly selects a model from OpenRouter's live public catalog (or enters an ID manually), and the browser sends requests directly to OpenRouter. MediBrief and Vercel hold no AI key or default model. Real-time voice and ambient transcription are disabled in this deployment.

---

## 🏗️ System Architecture

MediBrief v5.1 utilizes a **Feature-Based Architecture** with segregated state management for high performance and safety.

```mermaid
graph TD
    subgraph "Presentation Layer (React)"
        UI[Main Layout] --> Gate[Security Gate]
        Gate --> Roster[Sidebar Roster]
        Gate --> HUD[Safety HUD]
        Gate --> Workspace{Active Workspace}
        Workspace --> Chat[Chat Interface]
        Workspace --> Scribe[Ambient Scribe]
        Workspace --> CDSS[CDSS Overlay]
    end

    subgraph "Secure State Management (Zustand + Encryption)"
        Crypto[Encryption Service (AES-GCM)]
        PS[Patient Store] -->|Encrypted| IDB[(IndexedDB)]
        CS[Chat Store] -->|Encrypted| IDB
        ClinS[Clinical Store] -->|Encrypted| IDB
        AS[Audit Store] -->|Encrypted| IDB
    end

    subgraph "Intelligence Layer"
        Orchestrator[Chat Orchestrator] --> OpenRouter[OpenRouter API via browser BYOK]
        Orchestrator --> Safety[Safety Service]
        Safety --> OpenFDA[openFDA API]
        Safety --> Rules[Rules Engine]
        Rules --> CDSS
    end

    subgraph "Ingestion Pipeline"
        Upload[File Upload] --> Extractor[Entity Extractor]
        Extractor --> ClinS
        Scribe -->|Manual Review| Chat
    end

    Gate -.-> Crypto
    Chat --> Orchestrator
    Chat --> AS
```

---

## 🛡️ The "Zero-Trust" Safety Layer

MediBrief enforces a strict **"Truth Above All"** protocol using a multi-stage verification pipeline:

1.  **Ingestion Scanning**:
    *   Files are scanned by `useEntityExtractor` upon upload.
    *   **Allergies**, **Code Status**, and **Diagnoses** are extracted and pinned to the **Heads-Up Display (HUD)**.

2.  **Pharmacology Guardrails**:
    *   **Human-in-the-Loop**: When medications are detected in text, the user must *verify* the extraction before safety checks run.
    *   **Dual Verification**:
        1.  **Deterministic**: Checks against hard-coded critical limits (e.g., Acetaminophen > 4000mg).
        2.  **External (openFDA)**: Queries the FDA database for **Boxed Warnings** and label contradictions.

3.  **Strict Source Filtering**:
    *   **Allowed Domains**: System instructions strictly limit external verification to `nih.gov`, `cdc.gov`, `pubmed.ncbi.nlm.nih.gov`, and other official medical authorities.
    *   **Epistemic Humility**: The model is explicitly trained to admit ignorance rather than hallucinate.

4.  **Schema Validation (Zod)**:
    *   All AI outputs (Briefings, Lab Reports) are validated against strict `zod` schemas. Malformed JSON or out-of-bound values are rejected.

---

## 🚀 Key Features

### 1. Zero-Knowledge Security (New in v5.1)
*   **Client-Side Encryption**: Data is encrypted using **AES-GCM** before ever touching IndexedDB.
*   **Session PIN**: A 4-digit PIN derives the encryption key via **PBKDF2**. The raw key never leaves memory and is not persisted.
*   **Auto-Lock**: The interface blurs after 2 minutes of inactivity and locks completely after 15 minutes.

### 2. Accountability & Audit Trails (New in v5.1)
*   **Immutable Logs**: Every "AI Action" (Alert Generation, Briefing Creation) and "User Action" (Dosage Check, Alert Dismissal) is logged to an encrypted Audit Store.
*   **Traceability**: Ensure clinical decisions can be traced back to the specific information available at the time.

### 3. Clinical Decision Support (CDSS)
*   **Logic Engine**: A dedicated rules engine (`rulesEngine.ts`) monitors the **FHIR Data Store**.
*   **RAG Retrieval**: Retrieves relevant hospital protocols (e.g., Sepsis-3, KDIGO AKI) based on patient data tokens.
*   **Intervention Cards**: High-visibility alerts (Critical/Warning/Info) that overlay the interface when protocols are violated.

### 4. SOAP Note Workspace
*   **Manual Review**: SOAP sections remain editable and can be explicitly saved to the local structured record.
*   **Deployment Boundary**: Ambient transcription is disabled because browser-only OpenRouter chat completions do not provide the required real-time audio transport.

### 5. Native Multimodal Ingestion
*   **PACS Viewer**: Specialized image viewer with **Zoom**, **Contrast**, and **Invert (Bone Window)** controls for X-Rays/CTs.
*   **Lab Parsing**: Converts PDF lab reports into structured **FHIR Observations**, enabling automatic trend graphing.

---

## 📂 Project Structure

The codebase follows a strict **Feature-Based** directory structure:

```
src/
├── features/
│   ├── analytics/       # TrendGraph and data visualization
│   ├── audit/           # Audit logging and storage types
│   ├── cdss/            # Rules engine, Alerts, Protocols
│   ├── chat/            # Message components, Orchestrator hooks
│   ├── clinical/        # FHIR types, Store definition
│   ├── fhir/            # TypeScript definitions for FHIR R4
│   ├── hud/             # Heads-Up Display components
│   ├── layout/          # Main application shell & biometric bg
│   ├── patient/         # Patient metadata store & Roster UI
│   ├── safety/          # Dosage verifier, OpenFDA service
│   ├── scribe/          # Live Scribe interface & session logic
│   ├── security/        # EncryptionService, SecurityGate, Auto-Lock
│   └── ui/              # Global UI state (loading, modes)
├── components/          # Shared atomic components (Icons, Toast)
├── services/            # OpenRouter BYOK, BlobStorage, and Encryption wrappers
├── hooks/               # Utility hooks (Audio, DragAndDrop)
└── workers/             # Audio processing workers (PCM)
```

---

## 🛠️ Technical Stack

*   **Frontend**: React 18, Tailwind CSS (Medical Theme).
*   **State**: `zustand` (Split into 5 specialized stores).
*   **Storage**: `idb-keyval` (IndexedDB wrapper).
*   **Security**: Web Crypto API (PBKDF2 + AES-GCM).
*   **Validation**: `zod`.
*   **AI**: OpenRouter public model catalog and chat-completions HTTP APIs (browser BYOK).
*   **Audio**: Web Audio API + AudioWorklet (Low latency PCM).
*   **Data Standard**: FHIR R4 (Partial implementation).

---

## 🚀 Getting Started

1.  **Prerequisites**: Node.js 18+.
2.  **Install**: `npm install` (no AI environment variables are used).
3.  **Run**: `npm run dev`.
4.  **Initialize**: On first launch, set a 4-digit PIN to initialize the encrypted local vault.
5.  **Optional AI**: Open Settings, enter your own OpenRouter key, refresh/search the live catalog, and explicitly select a model. The key is stored only in the encrypted browser vault and sent directly to OpenRouter as a Bearer header.

**Disclaimer:** *MediBrief is a demonstration of Clinical AI architecture. It is not a certified medical device. All outputs must be verified by a licensed healthcare professional.*
