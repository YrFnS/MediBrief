
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

## 🔐 Authentication Options

MediBrief supports two authentication methods - choose what works best for you:

### Option 1: Google Subscription (OAuth) - Recommended

**Benefits:**
- ✨ No API key management
- 🚀 60 requests/min, 1000 requests/day  
- 🔄 Automatic model updates
- 🆓 Free tier

**Setup:**

1. **Set up Google Cloud OAuth:**
   ```bash
   # Go to Google Cloud Console
   https://console.cloud.google.com/apis/credentials
   
   # Enable "Google Generative Language API"
   # Create OAuth 2.0 Client ID (Web application type)
   # Add redirect URI: http://localhost:3001/auth/google/callback
   # Download client credentials
   ```

2. **Configure Backend Server:**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env and add your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   npm install
   ```

3. **Configure Frontend:**
   ```bash
   # Edit .env in project root
   VITE_USE_BACKEND=true
   VITE_BACKEND_URL=http://localhost:3001
   ```

4. **Start Both Services:**
   ```bash
   # Install dependencies if needed
   npm install
   
   # Run frontend + backend together
   npm run dev:all
   ```

5. **Login:**
   - Open app at `http://localhost:3000`
   - Go to Settings → "Google Subscription" tab
   - Click "Login with Google"
   - Grant permissions in popup

### Option 2: API Key - Quick Start

**Best for:** Testing, specific model control, no backend needed

**Setup:**

1. Get your API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Edit `.env`:
   ```bash
   VITE_GEMINI_API_KEY=your_key_here
   VITE_USE_BACKEND=false
   ```
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open app → Settings → "API Key" tab → Enter key

**Security Note:** Never commit API keys to source control. The `.env` file is already in `.gitignore`.

## 🚀 Quick Start

Choose your authentication method above, then:

1. **Ingest**: Drag & Drop patient files (PDF, Images, Text)
2. **Consult**:
   - **Text**: Type `/brief` for handoff or `/drugs [name]` for checks
   - **Voice**: Tap the waveform icon to start a Live Session
3. **Commands**:
   - `/brief` → Generate Shift Briefing PDF
   - `/patient [ID]` → Summarize specific case
   - `/drugs [name]` → Check interactions/dosage


## 🛠️ Under The Hood

-   **Frontend**: React 19, Tailwind CSS
-   **AI Core**: Google Gemini API (`@google/genai`)
-   **Audio**: Web Audio API + PCM Streaming (Singleton Context Pattern)
-   **PDF**: Direct Binary Transfer (No client-side text extraction)

---
*Disclaimer: MediBrief is a clinical support tool. It does not replace professional medical judgment. Always verify outputs with hospital protocols.*
