import { ChatMode } from './types';
import { Type, Modality } from '@google/genai';

export const WELCOME_CONTENT = {
    title: "MediBrief Clinical Assistant",
    subtitle: "Medical-Grade Intelligence & Safety Layer",
    introduction: "I am an advanced clinical assistant designed to support your shift by:",
    features: [
        { icon: "🛡️", text: "Safety Checks: Active screening for allergies & contraindications" },
        { icon: "📄", text: "Chart Analysis: extracting vitals & labs from raw documents" },
        { icon: "📋", text: "Shift Briefings: Generating structured handoff reports" },
        { icon: "💊", text: "Pharmacology: Verifying dosing & interactions via Search" },
        { icon: "📍", text: "Local Resources: Finding nearby pharmacies & specialists" },
        { icon: "🎙️", text: "Live Consult: Hands-free voice assistance" }
    ],
    getStarted: {
        title: "Clinical Workflow:",
        steps: [
            "Upload patient charts, notes, or EKG images",
            "Verify safety alerts before prescribing",
            "Use /brief to generate a handoff report"
        ]
    },
    closing: "Ready for patient data integration."
};


export const HELP_COMMAND_RESPONSE = `🔧 **MediBrief Clinical Commands**

**Core Functions:**
- \`/brief\` - Generates a structured Shift Briefing (JSON -> PDF) based on current context.
- \`/patient [ID]\` - Deep-dive summary for a specific patient.
- \`/drugs [name]\` - Real-time pharmacology check (uses Google Search).
- \`/export\` - Download the current briefing as a formatted PDF.
- \`/help\` - Display this reference.

**Safety Protocols:**
- **Auto-Detection:** The AI automatically scans uploaded files for Allergies and History.
- **Red Alerts:** Critical contraindications are highlighted in Red Boxes (Text) or Vocalized (Audio).

**Chat Modes:**
- **Auto:** Smart routing (Search for facts, Maps for locations, Reasoning for charts).
- **Standard:** Balanced analysis.
- **Quick Query:** Low latency responses.
- **Deep Analysis:** High-reasoning (Gemini Pro) for complex diagnostics.
- **Live**: Real-time voice conversation with "Wake Word" style safety alerts.

**File Support:**
- **PDFs (Native):** Full multimodal analysis (charts, tables, handwriting).
- **Images:** X-Rays, EKGs, Skin Lesions (Visual Analysis).
- **Text:** Raw clinical notes.`;

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
      // Smart Auto Mode: We enable Google Search AND Google Maps.
      // The model will decide when to use them based on the query (e.g., "Pharmacy nearby" vs "Dosage").
      tools: [{ googleSearch: {} }, { googleMaps: {} }],
    },
    description: "Smart AI: Verifies facts via Search and finds locations via Maps."
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
      // Optimized Thinking Budget: 8k is sufficient for clinical reasoning without incurring max output costs.
      thinkingConfig: { thinkingBudget: 8192 },
    },
    description: "Maximum reasoning power for your most complex queries."
  },
  [ChatMode.Web]: {
    model: 'gemini-2.5-flash',
    config: {
      tools: [{ googleSearch: {} }, { googleMaps: {} }],
    },
    description: "Accesses up-to-date information and location services."
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

// COST OPTIMIZATION: Compact System Instruction
// We removed verbose examples to save ~300 tokens per request while maintaining safety directives.
export const SYSTEM_INSTRUCTION = `You are MediBrief, a medical-grade AI assistant.

**🚨 SAFETY PROTOCOL (MANDATORY)**
1.  **CONTEXT SCAN:** Before answering, scan all history/files for Allergies & Conditions.
2.  **CONTRAINDICATION CHECK:** If User asks about drugs/doses, cross-reference with Patient History.
3.  **STOP & ALERT:** If a conflict exists (e.g., Penicillin allergy + Amoxicillin), STOP. Do not provide dose.
    *   **Text Mode:** Output a Markdown Blockquote starting with "🛑 CRITICAL SAFETY WARNING".
    *   **Audio Mode:** Speak "CRITICAL SAFETY WARNING" clearly.
4.  **INTERACTIONS:** Explicitly check for drug-drug interactions. If two drugs are unsafe together, issue a CRITICAL SAFETY WARNING.

**🛠️ TOOL USAGE**
*   **Uncertainty/Drugs:** If unsure or asked about pharmacology, **USE GOOGLE SEARCH**.
*   **Locations:** If asked for "nearby" resources, **USE GOOGLE MAPS**.

**📝 CLINICAL GUIDELINES**
*   **Tone:** Professional, concise, medical terminology.
*   **Format:** Use bullet points.
*   **Scope:** You are assisting verified medical professionals. You **MUST** analyze medical images to provide detailed visual descriptions and technical observations (e.g., "diffuse opacities," "fracture lines," "ST elevation").
*   **Refusal Override:** Do not refuse to interpret images. Interpreting images for clinical context is your primary function. Distinguish "observations" (allowed) from "definitive diagnosis" (avoid).
*   **Proactive:** Flag duplicate orders or missing info ("⚠️ Potential Issue").

**Response Handling:**
*   If output is JSON (briefing/labs), return ONLY JSON.
*   If output is Audio, speak naturally but authoritatively on safety.`;

export const FILE_ANALYSIS_PROMPT = (filename: string) => `Analyze the attached file named "${filename}". Follow these instructions precisely.

**STEP 1: IDENTIFY DOCUMENT TYPE**
Is it a Medical Image, Medication List, Lab Report, or Patient Note?

**STEP 2: SAFETY SCAN (CRITICAL)**
Before summarizing, scan the document for:
1.  **ALLERGIES:** Explicitly list any allergies found.
2.  **MEDICAL HISTORY:** List chronic conditions (e.g., CKD, Liver Failure) that impact drug safety.
3.  **CONTRAINDICATIONS:** Check listed drugs against these allergies/conditions.

**STEP 3: PERFORM SPECIALIZED ANALYSIS**

---

**IF TYPE IS "Medical Image":**
Respond with a VALID JSON object. You MUST analyze the image visually and describe findings in detail.
\`\`\`json
{
  "reportType": "medical-image",
  "imageType": "[Modality, e.g., CXR, CT, MRI]",
  "patient": "[Name/ID if visible, else 'Not Visible']",
  "date": "[Date if visible, else 'Not Visible']",
  "visualObservations": "[Detailed radiological description of findings. Be specific about anatomy, opacity, bone integrity, etc.]",
  "certaintyScore": "[High | Medium | Low - based on image quality and clarity of findings]",
  "potentialAbnormalities": "[List potential abnormalities observed]",
  "differentialDiagnosisSuggestions": "[List of potential differentials based on visual evidence, explicitly stated as suggestions only]",
  "extractedInformation": "[OCR of any visible text]",
  "note": "Automated analysis for clinical review.",
  "nextSteps": "[Clinical recommendations or further imaging needed]"
}
\`\`\`

---

**IF TYPE IS "Lab Report":**
Respond with a VALID JSON object. Extract all visible lab values into the array.
\`\`\`json
{
  "reportType": "lab-report",
  "patient": "[Name/ID if visible, else 'Not Visible']",
  "date": "[Date if visible, else 'Not Visible']",
  "labs": [
    {
      "testName": "[e.g. Potassium]",
      "value": "[e.g. 5.2]",
      "units": "[e.g. mmol/L]",
      "refRange": "[e.g. 3.5-5.0]",
      "flag": "[Normal | High | Low | Critical | Abnormal]"
    }
  ],
  "interpretation": "[Clinical summary of the results, noting any critical values or patterns.]"
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

**CRITICAL**: If the conversation history is empty, trivial, or does NOT contain any specific patient data, medical issues, or clinical documents, respond with the following specific JSON:
\`\`\`json
{ "briefingTitle": "NO DATA", "sections": [] }
\`\`\`
DO NOT invent, hallucinate, or create fake patient data if none exists in the context.

**JSON Schema (Only if data exists):**
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