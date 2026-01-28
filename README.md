# 🩺 MediBrief - Clinical Intelligence Layer (v3.0)

MediBrief is a medical-grade intelligence layer designed to act as a proactive safety partner for healthcare professionals. Unlike standard chatbots, it functions as a **Clinical Decision Support System (CDSS)**, synthesizing raw patient data into structured, actionable artifacts.

It utilizes the latest **Google Gemini 3.0 & 2.5** models to provide industry-leading reasoning, native multimodal analysis (X-Rays, EKGs), and real-time voice telemetry.

## 🛡️ Core Architecture: The Safety Layer

MediBrief enforces a strict "Truth Above All" protocol:

*   **Active Safety Scanning**: Every uploaded document and query is cross-referenced against the patient's known allergies and conditions.
*   **Epistemic Humility**: The system is instructed to admit ignorance. If data is missing, it requests it rather than hallucinating.
*   **Critical Intervention UI**: Dangerous drug interactions trigger a **Red Alert** UI state, blocking the flow to force acknowledgment.
*   **Source Grounding**: Medical facts are verified via **Google Search** (CDC, NIH, PubMed) and cited with clickable badges. Trusted domains (gov, edu, org) are highlighted in green.
*   **Context Preservation**: Uses "Sticky File" logic to retain medical records in the context window while pruning older conversation turns, ensuring clinical data remains available throughout the session.

## 🧠 Intelligence Modes

| Mode | Model Engine | Use Case |
| :--- | :--- | :--- |
| **Auto** | `gemini-2.5-flash` | Context-aware routing. Uses Search/Maps if needed. |
| **Standard** | `gemini-3-flash` | Balanced synthesis with active Search Verification. |
| **Quick** | `gemini-3-flash` | Optimized for speed with safety checks. |
| **Deep Analysis** | `gemini-3-pro` | Complex differential diagnosis and reasoning (High Compute/Thinking Budget). |
| **Web Search** | `gemini-2.5-flash` | Access to real-time internet data and Location Services. |
| **Live Telemetry** | `gemini-2.5-flash-audio` | Hands-free, low-latency voice consults with interruptibility. |

## ✨ Advanced Capabilities

### 1. Native Multimodal Ingestion & Analysis
*   **Radiology Analysis (PACS Viewer)**: Drag & Drop X-Rays, CTs, or MRIs. The built-in viewer offers **Zoom**, **Contrast Adjustment**, and **Bone Window (Invert)** controls. The AI generates a structured JSON report with visual findings and confidence scores.
*   **Lab Report Parsing**: Upload PDF/Image lab results. MediBrief converts them into interactive tables with **Visual Range Indicators** to spot abnormalities at a glance.
*   **Camera Capture**: Direct integration for capturing wound images or physical documents on mobile devices.

### 2. Clinical Command System
*   `/brief` **Shift Briefing**: Synthesizes the entire session context into a structured JSON handover, rendering it as a checklist.
*   `/drugs [name]` **Interaction Matrix**: Generates a color-coded grid analyzing specific drug-drug or drug-condition interactions (Red/Amber/Blue severity coding).
*   `/patient [ID]` **Timeline**: Reconstructs patient history from scattered documents.
*   `/export` **PDF Generation**: Serializes the current briefing or session into a PDF with a timestamped **Audit Footer** for EHR documentation.

### 3. Real-Time Live Session
*   **Voice-First Interface**: Activate "Live Mode" for a hands-free consult during rounds.
*   **Live Transcript**: Visualizes the audio stream and transcription in a terminal-style interface (User Input vs System Output).
*   **Safety Vocalization**: The model verbally announces "CRITICAL SAFETY WARNING" before delivering high-risk info.

## 🛠️ Technical Stack

*   **Frontend**: React 19, Tailwind CSS (Medical Slate/Blue Theme).
*   **AI SDK**: `@google/genai` (v1.29.1).
*   **Audio**: Web Audio API (Worklet-free implementation) with PCM 16kHz streaming for Live API.
*   **Rendering**: Custom Markdown parsers for specialized JSON schemas (Lab Reports, Briefings, Image Analysis).
*   **PDF Engine**: `jspdf` for client-side generation.
*   **Storage**: SessionStorage for local history persistence with image optimization.

## 🚀 Getting Started

1.  **Configuration**: Ensure `process.env.API_KEY` is set with a valid Google Cloud Project key enabled for Vertex AI/Gemini.
2.  **Permissions**: Allow Microphone and Location access when prompted (for Live Mode, Dictation, and Maps Grounding).
3.  **Ingest Data**:
    *   Drag a dummy patient chart (PDF/Text) or X-Ray (Image) onto the window.
    *   Use the Paperclip icon or Camera icon.
4.  **Execute**:
    *   Type `/brief` to test handover generation.
    *   Click "Export PDF" to download the report.

---
**Disclaimer:** *MediBrief is a demonstration of Clinical AI capabilities. It is not a certified medical device. All outputs must be verified by a licensed healthcare professional.*