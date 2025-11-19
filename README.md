
# 🩺 MediBrief - The AI Shift Partner

MediBrief isn't just a chatbot; it's a proactive AI partner for healthcare professionals. Built on Google's **Gemini 2.5 Multimodal** and **Live API** models, it turns a mountain of patient data into actionable intelligence in seconds.

## 🔥 Why This Matters
Healthcare is chaotic. You have 15 documents to read, 3 consults to call, and 2 minutes to do it. MediBrief cuts through the noise. It reads the messy handwriting, double-checks the drug interactions you might miss when tired, and briefs you like a seasoned resident.

## 🎙️ Real-Time Voice Intelligence (Live Mode)
MediBrief features **Gemini Live**, enabling a real-time, low-latency voice conversation.
- **Hands-Free**: Talk to the app while you scrub in or walk between wards.
- **Interruptible**: It handles natural interruptions and back-and-forth dialogue.
- **Tool Integrated**: It can check schedules or look up info seamlessly during the conversation.

## ✨ Key Capabilities

-   **📄 Multi-Document Synthesis**: Upload PDFs, images, and text. The app extracts text from digital files instantly and uses **Advanced OCR** for scanned docs and handwriting.
-   **👁️ Visual Intelligence**: Drop in an X-ray, EKG, or photo of a skin lesion. MediBrief provides structured analysis including visual observations, abnormalities, and next steps.
-   **🚀 Intelligent Modes**:
    -   **Auto**: Smart routing. Uses Google Search for drugs/facts, internal knowledge for summaries.
    -   **Live**: Real-time voice conversation.
    -   **Deep Analysis**: Uses Gemini Pro for complex reasoning and briefing generation.
    -   **Web Search**: Grounded answers for "What is the latest protocol for X?"
-   **💾 Local-First & Private**: Your chat history is stored in your browser's local storage. PDF processing happens client-side via `pdf.js`. We don't hoard your data.
-   **📤 One-Click Briefing Export**: Generate a beautifully formatted PDF shift briefing with one command: `/export`.

## 🚀 How to Use

1.  **Auth**: The app uses your Google Gemini API Key. It's your key, your limits.
2.  **Upload**: Drag & Drop patient notes.
3.  **Voice**: Click the **Live Icon** (Waveform) to start a real-time call.
4.  **Commands**:
    - `/brief` -> Generates the master shift briefing.
    - `/patient [ID]` -> Specific patient deep dive.
    - `/drugs [name]` -> Web-grounded pharmacology check.
    - `/export` -> Download the PDF report.

## 🛠️ Under The Hood

-   **Frontend**: React 19, Tailwind CSS
-   **AI Core**: Google Gemini API (`@google/genai`)
-   **Real-Time**: WebSocket-based Live API with PCM audio streaming.
-   **Processing**: Client-side PDF extraction & Markdown rendering.

---
*Disclaimer: MediBrief is an AI assistant for educational and organizational purposes. It does not replace professional medical judgment.*
