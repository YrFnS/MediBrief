
# 🩺 MediBrief - Clinical Intelligence Layer (v4.2)

MediBrief is a medical-grade intelligence layer designed to act as a proactive safety partner for healthcare professionals. Unlike standard chatbots, it functions as a **Clinical Decision Support System (CDSS)**, synthesizing raw patient data into structured, actionable artifacts.

It utilizes the latest **Google Gemini 3.0 & 2.5** models to provide industry-leading reasoning, native multimodal analysis (X-Rays, EKGs), and real-time voice telemetry.

## 🛡️ Core Architecture: The Safety Layer

MediBrief enforces a strict "Truth Above All" protocol:

*   **Active Safety Scanning**: Every uploaded document and query is cross-referenced against the patient's known allergies and conditions.
*   **CDSS Intervention Cards**: A logic engine monitors vital signs and lab results in real-time. If critical thresholds are breached (e.g., Sepsis criteria, Hyperkalemia), a high-visibility **Intervention Card** overlays the chat, requiring immediate action or dismissal.
*   **FHIR Data Store**: Ingested lab reports are parsed into structured **FHIR Observations**, allowing the system to track trends over time and visualize them with interactive graphs.
*   **Epistemic Humility**: The system is instructed to admit ignorance. If data is missing, it requests it rather than hallucinating.
*   **Source Grounding**: Medical facts are verified via **Google Search** (CDC, NIH, PubMed) and cited with clickable badges.

## 🚀 Key Features

### 1. Multi-Patient Roster & Context Switching
*   **Isolated Contexts**: Manage multiple patients simultaneously (e.g., "Bed 4", "New Admission"). Each patient has their own chat history, uploaded documents, and clinical data store.
*   **Sidebar Navigation**: Quickly switch between patients without losing state.
*   **Status Tracking**: Visual indicators for patient status (Stable, Critical, Discharge Ready).

### 2. Ambient Scribe Mode
*   **Passive Documentation**: A dedicated mode that listens to doctor-patient consultations without intervening.
*   **Real-Time SOAP Generation**: As the consultation progresses, the AI automatically fills out a structured SOAP note (Subjective, Objective, Assessment, Plan).
*   **Visualizer**: Live audio waveform visualization confirms the system is listening.

### 3. Native Multimodal Ingestion
*   **Radiology Analysis (PACS Viewer)**: Drag & Drop X-Rays, CTs, or MRIs. The built-in viewer offers **Zoom**, **Contrast Adjustment**, and **Bone Window (Invert)** controls.
*   **Lab Report Parsing**: Upload PDF/Image lab results. MediBrief converts them into interactive tables and automatically **ingests valid data points** into the patient's FHIR store for trending.
*   **Trend Analytics**: Automatically generates line graphs for lab values (e.g., Potassium, Glucose) when sufficient history is available.

### 4. Clinical Command System
*   `/brief` **Shift Briefing**: Synthesizes the session into a structured JSON handover.
*   `/drugs [name]` **Interaction Matrix**: Generates a color-coded grid analyzing drug-drug interactions.
*   `/export` **PDF Generation**: Serializes the current briefing into a timestamped PDF with an audit footer.

### 5. Live Telemetry
*   **Voice-First Interface**: Hands-free, low-latency voice consults using Gemini Live.
*   **Safety Vocalization**: The model verbally announces "CRITICAL SAFETY WARNING" before delivering high-risk info.

## 🧠 Intelligence Modes

| Mode | Model Engine | Use Case |
| :--- | :--- | :--- |
| **Standard** | `gemini-3-flash` | Balanced synthesis with active Search Verification. |
| **Deep Analysis** | `gemini-3-pro` | Complex differential diagnosis and reasoning (High Compute). |
| **Live** | `gemini-2.5-flash-audio` | Hands-free, low-latency voice consults. |
| **Ambient Scribe** | `gemini-2.5-flash-audio` | Passive listening and SOAP note generation. |

## 🛠️ Technical Stack

*   **Frontend**: React 19, Tailwind CSS (Medical Slate/Blue Theme).
*   **State Management**: Custom `usePatientStore` with Context API.
*   **AI SDK**: `@google/genai` (v1.29.1).
*   **Audio**: Web Audio API (Worklet-free implementation) with PCM 16kHz streaming.
*   **Data Standard**: Partial FHIR R4 implementation for Observations.
*   **Visualization**: `recharts` for trend analysis.
*   **PDF Engine**: `jspdf` for client-side generation.

## 🚀 Getting Started

1.  **Configuration**: Ensure `process.env.API_KEY` is set with a valid Google Cloud Project key enabled for Vertex AI/Gemini.
2.  **Permissions**: Allow Microphone and Location access when prompted.
3.  **Workflow**:
    *   Create a new Patient Context in the sidebar.
    *   Drag & Drop a PDF chart or X-Ray.
    *   Watch the **HUD** update with Allergies/Code Status.
    *   Use `/brief` to generate a handover or switch to **Scribe Mode** for live notes.

---
**Disclaimer:** *MediBrief is a demonstration of Clinical AI capabilities. It is not a certified medical device. All outputs must be verified by a licensed healthcare professional.*
