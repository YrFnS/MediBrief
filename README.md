
# 🩺 MediBrief - Medical-Grade Clinical Assistant

MediBrief is a clinical decision support tool and proactive shift partner for healthcare professionals. Built on **Google Gemini 2.5**, it leverages **Native Multimodal Intelligence** to analyze raw patient charts, tables, and handwriting without relying on brittle text extractors.

## 🛡️ Medical-Grade Safety Protocol
MediBrief is not just a chatbot; it is a **Safety Layer**.
- **Contraindication Scanning**: Every query is cross-referenced against the patient's known allergies and medical history.
- **Active Alerts**: Critical interactions trigger high-visibility **Red Alert UI** blocks (Text) or spoken **"Critical Safety Warning"** preambles (Audio).

## 🎙️ Real-Time Clinical Voice (Live API)
Features **Gemini Live** for low-latency, hands-free interaction during rounds or scrubs.
- **Interruptible**: Supports natural back-and-forth dialogue.
- **Safety-Aware**: The audio model is instructed to vocalize safety warnings explicitly.

## ✨ Key Capabilities

-   **📄 Native Multimodal Analysis**: Upload full PDFs (charts, labs, flowsheets). Gemini reads them natively—no OCR middleware.
-   **👁️ Visual Diagnosis Support**: Drop in X-rays, EKGs, or wound photos. Receive structured JSON analysis with visual observations and abnormalities.
-   **🚀 Intelligent Modes**:
    -   **Auto**: Smart routing. Uses Google Search for up-to-date pharmacology.
    -   **Live**: Real-time voice conversation.
    -   **Deep Analysis**: Gemini Pro for complex differential diagnosis reasoning.
    -   **Web Search**: Grounded answers for hospital protocols.
-   **📤 Shift Briefing Export**: Generates a standardized `JSON` handoff report and converts it to PDF via `/export`.

## 🚀 How to Use

1.  **Auth**: Uses your secure Google Gemini API Key.
2.  **Ingest**: Drag & Drop patient files (PDF, Images, Text).
3.  **Consult**:
    - Text: Type `/brief` for handoff or `/drugs [name]` for checks.
    - Voice: Tap the waveform icon to start a Live Session.
4.  **Commands**:
    - `/brief` -> Generate Shift Briefing PDF.
    - `/patient [ID]` -> Summarize specific case.
    - `/drugs [name]` -> Check interactions/dosage.

## 🛠️ Under The Hood

-   **Frontend**: React 19, Tailwind CSS
-   **AI Core**: Google Gemini API (`@google/genai`)
-   **Audio**: Web Audio API + PCM Streaming (Singleton Context Pattern)
-   **PDF**: Direct Binary Transfer (No client-side text extraction)

---
*Disclaimer: MediBrief is a clinical support tool. It does not replace professional medical judgment. Always verify outputs with hospital protocols.*
