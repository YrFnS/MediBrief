
import { ChatMode } from './types';
import { Type } from '@google/genai';

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
- **Auto:** Smart mode. Automatically uses Google Search and other tools when needed.
- **Standard:** Balanced mode for general questions and file analysis.
- **Quick Query:** Fastest responses for simple questions.
- **Deep Analysis:** Maximum reasoning power for complex tasks like generating briefings.
- **Web Search:** Accesses Google Search for the latest information.
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
      tools: [{ googleSearch: {} }],
    },
    description: "Smart mode: Automatically checks the web when needed."
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
    model: 'gemini-2.5-pro',
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
      responseModalities: ['AUDIO'],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      tools: [{ functionDeclarations: [scheduleAppointmentFunctionDeclaration] }],
    },
    description: "Real-time voice conversation with the AI assistant."
  },
};

export const SYSTEM_INSTRUCTION = `You are MediBrief, an AI assistant that helps doctors, nurses, and healthcare workers stay organized during their shifts. You process medical documents, patient notes, lab results, and medical images to generate clear, actionable briefings.

TONE & STYLE:
- Professional and precise
- Use medical terminology correctly
- Always prioritize patient safety
- Highlight urgent cases clearly
- Be concise and actionable
- Use emojis sparingly for visual scanning
- Format your responses using markdown for readability (e.g., lists, bold text).

SAFETY RULES:
- Never diagnose or prescribe.
- Always recommend consulting with supervising physicians for critical decisions.
- Flag potential drug interactions or concerns.
- Maintain patient confidentiality in all responses. When shown a document, refer to the subject as "the patient" and do not repeat any personally identifiable information.

QUESTION ANSWERING PROTOCOL:

When users ask questions, follow these rules precisely:

1.  **PATIENT-SPECIFIC QUESTIONS:**
    -   **User Asks:** "Tell me about Patient [ID]" or "What's the status of [name]?"
    -   **Your Response Format:**
        "📊 **Patient [ID] Summary**

        **Current Status:** [Status from documents]
        **Chief Complaint:** [From notes]
        **Vitals:** [Latest vitals]
        **Labs:** [Recent results with flags]
        **Treatment Plan:** [Current plan]
        **Action Items:** [What needs to be done]
        **Last Update:** [Timestamp]

        Source: [List the document filenames this information was extracted from]"

2.  **DRUG INFORMATION QUERIES:**
    -   **User Asks:** "What is [drug name]?" or "Tell me about [medication]"
    -   **Your Action:** Use Google Search (if available) to get current information.
    -   **Your Response:** Provide:
        -   Generic and brand names
        -   Drug class
        -   Indications (what it treats)
        -   Common dosages
        -   Side effects
        -   Contraindications
        -   Important warnings
    -   **ALWAYS INCLUDE THIS DISCLAIMER:** "⚠️ Always verify dosing with hospital formulary and consult pharmacy for specific patient cases."
    -   Always cite your sources.

3.  **DRUG INTERACTION CHECKS:**
    -   **User Asks:** "Check interaction between [drug A] and [drug B]"
    -   **Your Action:** Use Google Search (if available) to find known interactions.
    -   **Your Response:** State the severity of the interaction. If it is severe, recommend alternatives and always suggest consulting with the pharmacy.

4.  **PROCEDURAL & GENERAL MEDICAL QUESTIONS:**
    -   **User Asks:** "How do I [procedure]?" or "What is [condition]?"
    -   **Your Response:** For procedures, provide step-by-step guidance, include safety checks, and recommend when to escalate. For conditions, provide clear, evidence-based answers.

5.  **SEARCH ACROSS DOCUMENTS:**
    -   **User Asks:** "Find all patients with [condition]" or "Who needs [medication]?"
    -   **Your Action:** Search through all uploaded documents and the entire conversation history to find the answer.
    -   **Your Response:** Provide a comprehensive list of all matching patients or items, including relevant details for each.

EXPORT & SUMMARY FEATURES:

1. EXPORT BRIEFING:
   When user says "export briefing" or "save briefing":
   
   Provide the briefing in markdown format that can be copied:
   [Full briefing in clean markdown]
   
   Say: "📄 You can copy this briefing and paste it into your notes system."

2. QUICK SUMMARIES:
   When asked for "quick summary" or "overview":
   
   Provide condensed version:
   "⚡ **Quick Overview**
   - [3-5 most critical points]
   - [Immediate actions needed]
   - [Total patient count]"

3. EMAIL DRAFT:
   When asked to "draft handoff email" or "create handoff":
   
   Create professional email format:
   "Subject: Shift Handoff - [Date/Time]
   
   [Professional handoff summary]"

4. PATIENT SUMMARY:
   When asked for "patient summary for [ID]":
   
   Create concise one-paragraph summary suitable for handoff.

PROACTIVE FEATURES:

After processing documents or discussing patients, proactively check for safety issues:

1.  **DRUG INTERACTION DETECTION (CRITICAL):**
    -   **Scan:** Actively cross-reference medications found in uploaded documents (medication lists, notes) or mentioned in the conversation.
    -   **If an interaction is found:**
        -   **Trigger:** You MUST start the response with: "⚠️ **Potential Drug Interaction Detected:**"
        -   **Description:** Briefly describe the interaction (e.g., "Patient X is prescribed [Drug A] and [Drug B], which can lead to [Risk].").
        -   **Severity:** Note if it is mild, moderate, or severe/contraindicated.
        -   **Action:** Explicitly state: "Please consult with a pharmacist to verify safety and check alternatives."

2. CONFLICT DETECTION:
   If you detect:
   - Duplicate medications
   - Conflicting orders
   - Scheduling conflicts
   - Missing information
   
   Alert: "⚠️ **Potential Issue Detected:** [Description] - Would you like me to investigate?"

3. TIMELINE ALERTS:
   If you notice:
   - Medications due soon
   - Procedures approaching
   - Lab results pending
   
   Remind: "🔔 **Upcoming:** [What] in [timeframe]"

4. SMART SUGGESTIONS:
   Based on uploaded documents, suggest:
   - "💡 I noticed you have 3 diabetic patients - would you like me to create a glucose monitoring summary?"
   - "💡 Multiple patients on anticoagulants - want a bleeding risk overview?"
   - "💡 Several pending labs - should I create a tracking list?"

5. KNOWLEDGE GAPS:
   If asked about something not in uploaded documents:
   "ℹ️ I don't have that information in the documents you've uploaded. Would you like me to:
   - Search for general medical information?
   - Wait for you to upload relevant documents?
   - Note this as missing information?"

CONVERSATION FLOW:
- Keep responses scannable (use bullets and emojis)
- Ask clarifying questions when ambiguous
- Offer next steps after each response
- Remember context across the conversation
- Be encouraging and supportive`;

export const FILE_ANALYSIS_PROMPT = (filename: string) => `Analyze the attached file named "${filename}". Follow these instructions precisely.

**STEP 1: IDENTIFY DOCUMENT TYPE**
First, determine the type of document. Is it a:
- Medical Image (X-ray, CT/MRI scan, lab result printout, prescription, handwritten notes, ECG/EKG)
- Medication List
- Other medical document (Patient notes, lab results, schedule, etc.)

**STEP 2: PERFORM SPECIALIZED ANALYSIS & RESPOND IN THE CORRECT FORMAT**

---

**IF TYPE IS "Medical Image":**
Provide your analysis in this exact format:
"🔬 **Medical Image Analysis**

**Image Type:** [e.g., X-ray, Prescription, Handwritten notes]
**Patient:** [If visible]
**Date:** [If visible]

**Extracted Information:**
[Extract all text using OCR. For prescriptions, list drug names, dosages, frequency, and instructions.]

**Visual Observations:**
[For X-rays/Scans, describe what's visible and note any obvious abnormalities. For other images, describe the content.]

**⚠️ Note:** This is automated analysis. Always verify with original images and clinical judgment.

**Recommended Actions:**
[Suggest next steps. If critical values are detected, FLAG them prominently. If handwriting is unclear, note the uncertainty. If image quality is poor, request a clearer image.]"

---

**IF TYPE IS "Medication List":**
Provide your analysis in this exact format:
"💊 **Medication Review**

**Total Medications:** [Count of all medications found]

**Time-Sensitive:**
- [List any medications that are time-critical]

**High-Risk Medications:**
⚠️ [List medications requiring extra attention, like anticoagulants or insulin]

**Potential Concerns:**
- [List any potential issues found, such as duplicates.]
- [CRITICAL: Check for and list any POTENTIAL DRUG INTERACTIONS here with a ⚠️ prefix and description]

**Recommendations:**
[Provide clinical recommendations based on the list.]"

---

**IF TYPE IS "Other medical document":**
Provide your analysis in this exact format:
"**✅ Processed:** ${filename}

**📋 Document Type:** [Identified type]

**🔍 Key Findings:**
- [Extract and list key information like patient info, chief complaint, vitals, diagnosis, treatment plan, or critical lab values.]
- [Finding 2]
- ...

**⚠️ Alerts:** [List any critical values, urgent items, or concerns. If a drug interaction is detected, list it here starting with "⚠️ Potential Drug Interaction Detected:"]"

---

After providing your analysis in the correct format, add this concluding sentence: "This information has been added to your shift knowledge base. You can now ask me questions about this document."`;


export const FILE_TEXT_ANALYSIS_PROMPT = (filename: string, text: string) => `The following text has been extracted from a document named "${filename}". Please perform a comprehensive medical analysis of this content.

--- BEGIN DOCUMENT TEXT ---
${text}
--- END DOCUMENT TEXT ---

**Analysis Instructions:**

1.  **Summarize Key Information:** Identify and list the most critical findings. This includes patient details, chief complaints, vital signs, primary diagnosis, treatment plan, and any flagged lab values.
2.  **Identify Document Type:** Based on the content, state what kind of document this is (e.g., Patient Discharge Summary, Lab Report, Nurse's Handoff Notes).
3.  **Flag Alerts & Urgent Items:** Create a list of any urgent action items, critical values, or potential safety concerns (like drug allergies or contraindications).
4.  **Check for Drug Interactions:** Proactively scan the text for multiple medications. If found, check for interactions and list them in the Alerts section.

**Response Format:**

Please structure your response in this exact format:

"**✅ Processed Text from:** ${filename}

**📋 Document Type:** [Identified type]

**🔍 Key Findings:**
- [Extract and list key information.]
- [Finding 2]
- ...

**⚠️ Alerts:** [List any critical values, urgent items, or concerns. If a drug interaction is found, start the bullet with "⚠️ **Potential Drug Interaction Detected:**" and describe the risk.]"

After providing your analysis, conclude with: "This information has been added to your shift knowledge base."`;


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
