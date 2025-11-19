
import { ChatMode } from './types';
import { Type, Modality } from '@google/genai';

export const WELCOME_CONTENT = {
    title: "Welcome to MediBrief",
    subtitle: "Your AI Shift Assistant",
    introduction: "I help healthcare workers stay organized by:",
    features: [
        { icon: "📄", text: "Processing patient notes and medical documents" },
        { icon: "🔬", text: "Analyzing lab results and medical images" },
        { icon: "📋", text: "Generating shift briefings with priorities" },
        { icon: "💊", text: "Checking drug information" },
        { icon: "❓", text: "Answering questions about patient care" }
    ],
    getStarted: {
        title: "To get started:",
        steps: [
            "Upload your patient notes, schedules, or medical documents",
            "Ask me to generate your shift briefing",
            "Or just ask me questions about your patients"
        ]
    },
    closing: "What would you like to do today?"
};


export const HELP_COMMAND_RESPONSE = `🔧 **MediBrief Help & Commands**

Here’s a quick guide to getting the most out of your AI assistant.

**Quick Commands:**
- \`/brief\` - Generates a comprehensive shift briefing from all documents and conversation history. (Uses Deep Analysis mode).
- \`/patient [ID]\` - Gets a detailed summary for a specific patient.
- \`/drugs [name]\` - Looks up medication information using up-to-date web search. (Uses Web Search mode).
- \`/export\` - Generates a comprehensive shift briefing and downloads it as a PDF file.
- \`/help\` - Displays this help message.

**Chat Modes:**
You can switch modes using the selector at the top right:
- **Auto:** Smart mode. Automatically uses Google Search to verify medical facts, check drugs, and resolve uncertainty.
- **Standard:** Balanced mode for general questions and file analysis.
- **Quick Query:** Fastest responses for simple questions.
- **Deep Analysis:** Maximum reasoning power for complex tasks like generating briefings.
- **Web Search:** Forces Google Search for every query.
- **Live**: Engages in a real-time voice conversation.

**File Handling:**
- You can upload **PDFs, images (JPG, PNG), and text files**.
- The app automatically **extracts text** from digital PDFs for fast analysis.
- For **scanned documents or images**, it uses advanced OCR to read the content.
- Upload multiple files before running \`/brief\` to get a consolidated report.

**Natural Language Examples:**
- "What's the plan for today?"
- "Check for interactions between aspirin and warfarin"
- "Create a handoff email for the next shift"

Remember, you can always ask questions naturally. I'm here to help!`;

const scheduleAppointmentFunctionDeclaration = {
  name: 'scheduleAppointment',
  parameters: {
    type: Type.OBJECT,
    description: 'Schedules a patient appointment for a follow-up.',
    properties: {
      patientId: {
        type: Type.STRING,
        description: 'The unique identifier for the patient.',
      },
      date: {
        type: Type.STRING,
        description: 'The date of the appointment, e.g., "2024-08-15".',
      },
      time: {
        type: Type.STRING,
        description: 'The time of the appointment in 24-hour format, e.g., "14:30".',
      },
       notes: {
        type: Type.STRING,
        description: 'Optional notes for the appointment, such as reason for visit.',
      },
    },
    required: ['patientId', 'date', 'time'],
  },
};


export const MODEL_CONFIGS = {
  [ChatMode.Auto]: {
    model: 'gemini-2.5-flash',
    config: {
      // Smart Auto Mode: We enable Google Search by default.
      // The model will decide when to use it based on the System Instruction.
      tools: [{ googleSearch: {} }],
    },
    description: "Smart AI: Automatically searches the web to verify facts and drugs."
  },
  [ChatMode.Standard]: {
    model: 'gemini-2.5-flash',
    config: {},
    description: "Balanced performance for general tasks and image analysis."
  },
  [ChatMode.Quick]: {
    model: 'gemini-2.5-flash-lite',
    config: {},
    description: "Optimized for speed and low-latency responses."
  },
  [ChatMode.Deep]: {
    model: 'gemini-3-pro-preview',
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
    },
    description: "Maximum reasoning power for your most complex queries."
  },
  [ChatMode.Web]: {
    model: 'gemini-2.5-flash',
    config: {
      tools: [{ googleSearch: {} }],
    },
    description: "Accesses up-to-date information from Google Search."
  },
  [ChatMode.Live]: {
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
      },
      tools: [{ functionDeclarations: [scheduleAppointmentFunctionDeclaration] }],
    },
    description: "Real-time voice conversation with the AI assistant."
  },
};

export const SYSTEM_INSTRUCTION = `You are MediBrief, a medical-grade AI assistant designed to help healthcare professionals.

**🚨 PRIMARY DIRECTIVE: PATIENT SAFETY PROTOCOL 🚨**
Before answering ANY clinical question or summarizing ANY document, you must execute the following Safety Checks. You are not just a summarizer; you are a safety layer.

1.  **ALLERGY & CONTRAINDICATION CHECK (High Priority):**
    *   Actively scan all context (uploaded files, history) for Patient Allergies and Medical History.
    *   If a user asks about a drug (e.g., "Dose for X"), you MUST cross-reference it against the patient's specific allergies and conditions.
    *   **IF A CONFLICT EXISTS:** STOP. Do not provide the dose first. Issue a **RED ALERT** immediately.

2.  **INTERACTION CHECK:**
    *   If discussing multiple drugs, check for drug-drug interactions.

**⚠️ CRITICAL WARNING FORMAT:**
If you detect a safety threat (Allergy, Contraindication, Severe Interaction), you MUST use a Markdown Blockquote starting with a Stop Sign emoji to trigger the Red Alert UI.

Example of a Safety Alert:
> 🛑 **CRITICAL SAFETY WARNING**
> **Patient has a documented ALLERGY to PENICILLIN.**
> Amoxicillin is contraindicated.
> Please verify with the prescribing physician immediately.

---

**TONE & STYLE:**
- Professional, precise, and concise.
- Use medical terminology correctly.
- **Visuals:** Use bullet points and bold text for readability. Use emojis sparingly to categorize information.

**SMART AGENT PROTOCOLS (TOOL USE & AUTO MODE):**

You are equipped with Google Search tools.
**YOU MUST USE GOOGLE SEARCH IN THE FOLLOWING SCENARIOS:**

1.  **Uncertainty & Fact-Checking**: If you are unsure about an answer, protocol, or drug, **do not guess**. Search.
2.  **Drug Information**: For ANY question involving medications, dosages, brand names, or interactions, you **MUST** use Google Search to verify the latest data.
3.  **Broad Applicability**: If a user asks "What is the dose for X?" or "Check interactions", use the search tool automatically.

**QUESTION ANSWERING PROTOCOL:**

1.  **PATIENT-SPECIFIC QUESTIONS:**
    *   Format: Status, Chief Complaint, Vitals, Labs, Plan.
    *   *Always check for safety conflicts before generating the plan.*

2.  **DRUG INFORMATION QUERIES:**
    *   Action: USE GOOGLE SEARCH.
    *   Response: Class, Indications, Dosing, Side Effects, **Contraindications**.
    *   *Disclaimer:* "⚠️ Verify with hospital formulary."

3.  **DRUG INTERACTION CHECKS:**
    *   Action: USE GOOGLE SEARCH.
    *   Response: State severity clearly. If severe, use the **CRITICAL WARNING FORMAT**.

**PROACTIVE FEATURES:**

After processing documents, proactively check for safety issues:
- **Duplicate medications**
- **Conflicting orders**
- **Missing information**

If found, alert the user: "⚠️ **Potential Issue Detected:** [Description]"

**SAFETY RULES:**
- Never diagnose or prescribe.
- Always recommend consulting with supervising physicians.
- Maintain patient confidentiality.`;

export const FILE_ANALYSIS_PROMPT = (filename: string) => `Analyze the attached file named "${filename}". Follow these instructions precisely.

**STEP 1: IDENTIFY DOCUMENT TYPE**
Is it a Medical Image, Medication List, or Patient Note?

**STEP 2: SAFETY SCAN (CRITICAL)**
Before summarizing, scan the document for:
1.  **ALLERGIES:** Explicitly list any allergies found.
2.  **MEDICAL HISTORY:** List chronic conditions (e.g., CKD, Liver Failure) that impact drug safety.
3.  **CONTRAINDICATIONS:** Check listed drugs against these allergies/conditions.

**STEP 3: PERFORM SPECIALIZED ANALYSIS**

---

**IF TYPE IS "Medical Image":**
Respond with a VALID JSON object:
\`\`\`json
{
  "reportType": "medical-image",
  "imageType": "[Type]",
  "patient": "[Name/ID]",
  "date": "[Date]",
  "visualObservations": "[Detailed visual description]",
  "potentialAbnormalities": "[List abnormalities]",
  "extractedInformation": "[OCR of any visible text]",
  "note": "Automated analysis. Verify clinically.",
  "nextSteps": "[Clinical recommendations]"
}
\`\`\`

---

**IF TYPE IS "Medication List":**
Format as Text/Markdown:

"💊 **Medication Review**

**Total Medications:** [Count]

> 🛑 **SAFETY ALERTS**
> [If ANY allergies, contraindications, or severe interactions are found, list them here using this blockquote format. If none, state 'No immediate contraindications detected based on available data'.]

**Time-Sensitive:**
- [List items]

**Medication List & Recommendations:**
[List medications with clinical notes]"

---

**IF TYPE IS "Other medical document":**
Format as Text/Markdown:

"**✅ Processed:** ${filename}

**📋 Document Type:** [Type]

**🚨 Patient Safety Context:**
*   **Allergies:** [Extract Allergies or 'Not Listed']
*   **Code Status:** [Extract if available]

**🔍 Key Findings:**
- [Finding 1]
- [Finding 2]

**⚠️ Alerts:**
[List critical values or urgent items]"

---

After providing your analysis, add: "This information has been added to your shift knowledge base."`;


export const FILE_TEXT_ANALYSIS_PROMPT = (filename: string, text: string) => `The following text has been extracted from a document named "${filename}". Perform a strict medical safety analysis.

--- BEGIN DOCUMENT TEXT ---
${text}
--- END DOCUMENT TEXT ---

**Analysis Instructions:**

1.  **SAFETY FIRST - EXTRACT CONTEXT:**
    *   **Allergies:** Identify all listed allergies.
    *   **Conditions:** Identify major comorbidities (Renal/Hepatic failure, etc.).
    *   **Medications:** List all current drugs.

2.  **CROSS-REFERENCE (The "Allergy Blindspot" Check):**
    *   Do any of the listed medications conflict with the patient's allergies?
    *   Do any medications conflict with the patient's conditions?
    *   Are there drug-drug interactions?

3.  **SUMMARIZE:**
    *   Chief Complaint, Vitals, Plan.

**Response Format:**

"**✅ Processed Text from:** ${filename}

**📋 Document Type:** [Identified type]

> 🛑 **CRITICAL SAFETY ALERTS**
> [If you found an Allergy-Drug conflict (e.g., Penicillin Allergy + Amoxicillin Prescription), YOU MUST LIST IT HERE in this blockquote. If clear, remove this block.]

**🚨 Patient Context:**
*   **Allergies:** [List found allergies]
*   **History:** [Key conditions]

**🔍 Key Findings:**
- [Summary of clinical content]

**⚠️ Action Items:** [Urgent tasks]"

Conclude with: "This information has been added to your shift knowledge base."`;


export const BRIEFING_TRIGGERS = [
    'generate briefing',
    'create my shift briefing',
    'brief me',
    'shift briefing',
];

export const SHIFT_BRIEFING_PROMPT = () => `Based on all the documents and conversation history so far, generate a comprehensive shift briefing. Use the current conversation as the source of truth.

**IMPORTANT**: You MUST respond with ONLY a valid JSON object that adheres to the following schema. Do not include any other text or markdown formatting outside of the JSON.

**JSON Schema:**
\`\`\`json
{
  "briefingTitle": "SHIFT BRIEFING - [Date and Time]",
  "sections": [
    {
      "title": "PRIORITY CASES",
      "items": [
        "Patient [ID]: [Issue] - Action: [What needs to be done]",
        "... more items"
      ]
    },
    {
      "title": "CRITICAL ALERTS",
      "items": [
        "Abnormal lab values: [List with patient IDs]",
        "Medication due: [List time-sensitive medications]",
        "Pending procedures: [List with times]"
      ]
    },
    {
      "title": "PATIENT OVERVIEW",
      "items": [
        "Patient [ID]: [Condition] | [Current status] | [Next action]",
        "... more items"
      ]
    },
    {
      "title": "MEDICATIONS & TREATMENTS",
      "items": [
        "[Time]: [Patient] - [Medication/Treatment]",
        "... more items"
      ]
    },
    {
      "title": "FOLLOW-UP REQUIRED",
      "items": [
        "[List of patients needing follow-up]",
        "[Pending test results to check]"
      ]
    },
    {
      "title": "HANDOFF NOTES",
      "items": [
        "[Key information for next shift]"
      ]
    },
    {
      "title": "SHIFT TIMELINE",
      "items": [
        "[Hour-by-hour breakdown if applicable, otherwise state 'No specific timeline provided.']"
      ]
    }
  ]
}
\`\`\`

**Instructions for Populating JSON:**
- The \`briefingTitle\` should include the current date and time.
- Each section's \`items\` array should contain strings with the relevant information.
- If a section has no items, you can either omit it or provide an empty \`items\` array.
- Do NOT include markdown (like \`**\`) inside the JSON string values. The frontend will handle formatting.`;
