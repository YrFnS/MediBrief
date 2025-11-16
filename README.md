# 🩺 MediBrief - AI Shift Briefing for Healthcare Workers

MediBrief is a powerful AI assistant designed to help doctors, nurses, and healthcare workers stay organized and efficient during their shifts. It processes medical documents, patient notes, lab results, and medical images to generate clear, actionable briefings, freeing up valuable time for patient care.

## ✨ Key Features

-   **📄 Multi-Document Analysis**: Upload and analyze PDFs, images (JPG, PNG), and text files.
-   **👁️ Advanced OCR**: Extracts text from scanned documents and handwritten notes using Optical Character Recognition.
-   **🔬 Specialized Medical Image Analysis**: Provides detailed reports for medical images like X-rays, CT scans, and prescriptions, including visual observations and extracted text.
-   **🤖 Multiple Chat Modes**:
    -   **Auto**: AI intelligently selects the best model for your query.
    -   **Standard**: Balanced performance for general tasks.
    -   **Quick Query**: Optimized for speed and simple questions.
    -   **Deep Analysis**: Maximum reasoning for complex tasks like generating comprehensive briefings.
    -   **Web Search**: Accesses Google Search for up-to-date information, perfect for drug lookups.
-   **🎤 Voice Input**: Use the microphone for hands-free interaction, ideal for busy clinical environments.
-   **⚡ Quick Commands**: Use slash commands for fast access to common actions like generating briefings or looking up patient info.
-   **💾 Persistent Chat History**: Your conversation is saved locally, so you can pick up right where you left off, even after a page refresh.
-   **📤 Export to PDF**: Generate and download professional, print-ready shift briefings with a single click.
-   **📱 Responsive Design**: A clean, intuitive interface that works seamlessly on desktop and mobile devices.

## 🚀 Getting Started

1.  **Upload Files**: Click the paperclip icon to upload patient notes, schedules, lab results, or medical images. You can upload multiple files.
2.  **Ask Questions**: Type your questions in the input bar or use the microphone to speak your query.
3.  **Generate a Briefing**: Type `/brief` to get a consolidated shift briefing based on all uploaded documents and conversation history.
4.  **Switch Modes**: Use the mode selector at the top right to tailor the AI's performance to your specific needs.
5.  **Clear Chat**: Click the trash icon in the header to start a new session.

## ⌨️ Quick Commands

Use these commands in the input bar for faster workflows:

| Command           | Description                                       |
| ----------------- | ------------------------------------------------- |
| `/brief`          | Generates a comprehensive shift briefing.         |
| `/patient [ID]`   | Gets a detailed summary for a specific patient.   |
| `/drugs [name]`   | Looks up medication information via web search.   |
| `/export`         | Provides the briefing in a copy-paste text format.|
| `/help`           | Displays a detailed help message with all commands.|

## 🛠️ Technology Stack

-   **Frontend**: React, TypeScript
-   **AI**: Google Gemini API (`@google/genai`)
-   **Styling**: Tailwind CSS
-   **PDF Processing**: `pdf.js` (for client-side text extraction)
-   **Voice Input**: Web Speech API
