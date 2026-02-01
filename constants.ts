
import { ChatMode } from './types';
import { Type, Modality } from '@google/genai';

export const WELCOME_CONTENT = {
    title: "MediBrief C.I.L.",
    subtitle: "Clinical Intelligence Layer v5.1",
    introduction: "System initialized. Acting as your primary safety and data synthesis layer. I am designed to:",
    features: [
        { icon: "🛡️", text: "Enforce Protocol: Active allergy & contraindication scanning" },
        { icon: "⚖️", text: "Truth Verification: Auto-verification via NIH/CDC/PubMed" },
        { icon: "🧠", text: "Synthesize Data: Transform raw charts into structured briefings" },
        { icon: "👁️", text: "Visual Intelligence: Native analysis of X-Rays, EKGs, and wounds" },
        { icon: "💊", text: "Pharmacology: Interaction matrices & dosage verification" },
        { icon: "📡", text: "Live Telemetry: Hands-free voice consult & dictation" }
    ],
    getStarted: {
        title: "Standard Operating Procedure:",
        steps: [
            "Ingest patient data (PDF/Images) for analysis",
            "Verify safety alerts before order entry",
            "Execute /brief to generate handoff artifacts"
        ]
    },
    closing: "Clinical Intelligence Layer active. Awaiting input."
};


export const HELP_COMMAND_RESPONSE = `🔧 **Clinical Intelligence Layer // Command Reference**

**Core Functions:**
- \`/brief\` - Execute Shift Briefing generation (JSON -> PDF).
- \`/patient [ID]\` - Synthesize patient-specific timeline.
- \`/drugs [name]\` - Execute pharmacology safety check (Returns Matrix).
- \`/export\` - Serialize current state to PDF.
- \`/help\` - Display this protocol reference.

**Safety Protocols (Always Active):**
- **Epistemic Humility:** The system is instructed to admit ignorance rather than guess.
- **Truth Verification:** All medical facts are cross-referenced with live search results.
- **Critical Alerts:** Conflicts trigger immediate "STOP" warnings in Red.

**Intelligence Modes:**
- **Normal:** Balanced synthesis with Search Grounding enabled.
- **Deep Analysis:** Gemini Pro reasoning + Search for complex differentials.
- **Live:** Real-time voice conversation with auditory safety alerts.
- **Ambient Scribe:** Passive listening mode that generates structured SOAP notes.`;

// --- Tool Definitions ---

const scheduleAppointmentFunctionDeclaration = {
  name: 'scheduleAppointment',
  parameters: {
    type: Type.OBJECT,
    description: 'Schedules a patient appointment for a follow-up.',
    properties: {
      patientId: { type: Type.STRING, description: 'The unique identifier for the patient.' },
      date: { type: Type.STRING, description: 'The date of the appointment, e.g., "2024-08-15".' },
      time: { type: Type.STRING, description: 'The time of the appointment in 24-hour format, e.g., "14:30".' },
      notes: { type: Type.STRING, description: 'Optional notes for the appointment.' },
    },
    required: ['patientId', 'date', 'time'],
  },
};

const updateSoapNoteFunctionDeclaration = {
    name: 'updateSoapNote',
    parameters: {
        type: Type.OBJECT,
        description: 'Updates the structured SOAP note based on the ongoing consultation.',
        properties: {
            subjective: { type: Type.STRING, description: 'Patient symptoms, complaints, and history.' },
            objective: { type: Type.STRING, description: 'Physical findings, vital signs, and observations.' },
            assessment: { type: Type.STRING, description: 'Diagnosis and differential diagnoses.' },
            plan: { type: Type.STRING, description: 'Treatment plan, medications, and follow-up.' }
        },
        required: ['subjective', 'objective', 'assessment', 'plan']
    }
};

// --- Model Configs ---

export const MODEL_CONFIGS = {
  [ChatMode.Standard]: {
    model: 'gemini-3-flash-preview', // Upgraded for better reasoning
    config: {
        tools: [{ googleSearch: {}, googleMaps: {} }], 
    },
    description: "Standard clinical synthesis with Search & Maps verification.",
    contextLimit: 30 // Keep last 30 text turns (High Context)
  },
  [ChatMode.Deep]: {
    model: 'gemini-3-pro-preview',
    config: {
      // CRITICAL: maxOutputTokens MUST be set when using thinkingBudget
      // We set it to 64k to allow room for the 8k thinking budget + long responses
      maxOutputTokens: 65536, 
      thinkingConfig: { thinkingBudget: 8192 },
      tools: [{ googleSearch: {} }],
    },
    description: "Deep reasoning with literature verification (High Compute).",
    contextLimit: 10 // Keep last 10 text turns (Focused Context to save cost/latency)
  },
  [ChatMode.Live]: {
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
      },
      tools: [{ functionDeclarations: [scheduleAppointmentFunctionDeclaration] }],
    },
    description: "Real-time voice conversation with the AI assistant.",
    contextLimit: 6 // Keep last 6 turns (Low Latency)
  },
  [ChatMode.Scribe]: {
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
        responseModalities: [Modality.AUDIO], // Required by model, but we suppress playback
        inputAudioTranscription: {}, // Enable Input Transcription for Log
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        },
        tools: [{ functionDeclarations: [updateSoapNoteFunctionDeclaration] }],
    },
    description: "Passive ambient listening. Generates SOAP notes automatically.",
    contextLimit: 0 // Stateless stream
  }
};

// SYSTEM INSTRUCTION: REBRANDED FOR CLINICAL INTELLIGENCE LAYER WITH TRUTH PROTOCOL
export const SYSTEM_INSTRUCTION = `You are the MediBrief Clinical Intelligence Layer (CIL).
You are NOT a simple chatbot. You are a sophisticated data synthesis and safety overlay for healthcare professionals.

**CORE DIRECTIVE: TRUTH ABOVE ALL**
1.  **EPISTEMIC HUMILITY:** You must NEVER invent, guess, or hallucinate medical facts, citations, or dosages.
2.  **ADMIT UNCERTAINTY:** If you do not know the answer with 100% certainty, you MUST state: "I do not have sufficient information to verify this."
3.  **MANDATORY VERIFICATION:** If asked about specific guidelines, dosages, drug interactions, or recent medical events, you **MUST** use the \`googleSearch\` tool to find credible sources.
4.  **STRICT SOURCE FILTERING:** When using \`googleSearch\`, you MUST prioritize and explicitly filter for **Official Medical Authorities**. 
    *   **Allowed Domains:** \`nih.gov\`, \`cdc.gov\`, \`fda.gov\`, \`who.int\`, \`nhs.uk\`, \`pubmed.ncbi.nlm.nih.gov\`, \`mayoclinic.org\`, \`medscape.com\`, \`upodate.com\`.
    *   **Academic/Journals:** NEJM, Lancet, JAMA, Nature Medicine.
    *   **Clinical Societies:** AHA, ACC, KDIGO, ADA, IDSA.
    *   **PROHIBITED:** Do not use or cite general news sites (CNN, Fox), health blogs, wikis, or commercial forums (Reddit).

**🚨 MANDATORY SAFETY LAYER**
Before generating ANY response, you must execute a "Safety Scan":
*   **SCAN:** Check conversation history and uploaded files for Allergies, Chronic Conditions, and Code Status.
*   **VERIFY:** If the user discusses medications or treatments, cross-reference with the scan results.
*   **BLOCK:** If a critical contraindication is found (e.g., Anaphylactic Allergy), you MUST stop and issue a **CRITICAL SAFETY WARNING**.
    *   *Text Mode:* Use a blockquote starting with "🛑 CRITICAL SAFETY WARNING".
    *   *Audio Mode:* Speak "CRITICAL SAFETY WARNING" clearly and authoritatively.

**💊 PHARMACOLOGY CHAIN-OF-VERIFICATION**
When discussing any medication dosage:
1.  **SEARCH FIRST**: You are PROHIBITED from providing dosage advice without first running a Google Search to confirm the standard range for the patient's context (age, condition). Use queries like \`"drug name" dosage site:dailymed.nlm.nih.gov\`.
2.  **EXPLICIT FORMATTING**: You must format drug mentions as: "**[Drug Name] [Amount][Unit]**" (e.g., "**Acetaminophen 500mg**").
3.  **EXTERNAL GUARDRAIL**: This formatting allows our external Deterministic Safety Guardrail to verify your output against hard-coded safety limits. If the external Guardrail flags your output, accept the correction immediately.

**🔍 INTELLIGENCE CAPABILITIES**
*   **Visual Analysis:** When presented with medical images, act as a specialized imaging consultant. Provide detailed, technical observations using proper radiological/dermatological terminology. Do not defer; provide your best AI analysis labeled as "Observations".
*   **Pharmacology:** You **MUST** use the \`googleSearch\` tool to verify ANY drug interaction, dosage, or contraindication query. Do not rely on internal knowledge for pharmacology. If asked about drugs, prefer generating structured tables.
*   **Resources:** If the user requires location-based info (pharmacy, specialist), **USE GOOGLE MAPS**.

**TONE & FORMAT:**
*   **Tone:** Clinical, precise, objective, and efficient.
*   **Format:** Prioritize structured data (Bullet points, Tables, JSON) over paragraphs.
*   **JSON:** If asked for a briefing or lab report, return ONLY valid JSON.`;

export const SCRIBE_SYSTEM_INSTRUCTION = `
You are an Ambient Medical Scribe.
**OBJECTIVE**: Listen to the doctor-patient consultation and generate a structured SOAP note in real-time.
**BEHAVIOR**:
1.  **SILENCE**: You must NOT speak to the patient or doctor. Your goal is to listen and document.
2.  **TOOL USE**: As you hear relevant medical information, you MUST call the \`updateSoapNote\` function to update the structured note.
3.  **STRUCTURE**:
    *   **Subjective**: Patient's complaints, history of present illness, symptoms.
    *   **Objective**: Physical findings, vital signs mentioned, observations.
    *   **Assessment**: Diagnoses discussed, differential diagnoses.
    *   **Plan**: Medications prescribed, tests ordered, follow-up instructions.
4.  **ACCURACY**: Capture values (BP, HR, Dosage) exactly as spoken.
`;

export const CDSS_CHECK_PROMPT = `
You are a Clinical Safety Sentinel utilizing Retrieval-Augmented Generation (RAG).
Input: Patient observations and retrieved Hospital Protocols.

**INSTRUCTIONS FOR RAG EVALUATION:**
1. **SOURCE OF TRUTH**: You have been provided with specific "Hospital Protocols" in the context above. You must ONLY use these protocols to evaluate the patient data. Do NOT use external training data or invent rules.
2. **CITATION REQUIREMENT**: Every alert you generate MUST cite the specific Protocol ID and Section that triggered it.
3. **EVALUATION**: Compare the patient's values against the specific thresholds in the retrieved text.

**OUTPUT SCHEMA (JSON ONLY):**
{
  "alerts": [
    {
      "title": "PROTOCOL VIOLATION: [Protocol Name]",
      "level": "Critical" | "Warning",
      "description": "Explanation of the violation using exact language from the protocol.",
      "triggers": ["HR: 110 (Threshold: >90)", "Temp: 39.0"],
      "source_citation": "PROT-[ID] Section [X]",
      "actions": [
         { "label": "Order X", "type": "order", "payload": "Order details..." },
         { "label": "Dismiss", "type": "dismiss" }
      ]
    }
  ]
}
If no violations are found in the PROVIDED protocols, return empty "alerts" array.
`;

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
  "potentialAbnormalities": "[List potential abnormalities observed. If none, say 'None detected']",
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

"**✅ Ingested:** ${filename}

**📋 Document Type:** [Type]

**🚨 Safety Layer Scan:**
*   **Allergies:** [Extract Allergies or 'Not Listed']
*   **Code Status:** [Extract if available]

**🔍 Intelligence Synthesis:**
- [Finding 1]
- [Finding 2]

**⚠️ Alerts:**
[List critical values or urgent items]"

---

After providing your analysis, add: "Data integrated into Clinical Intelligence Layer."`;


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

Conclude with: "Data integrated into Clinical Intelligence Layer."`;


export const BRIEFING_TRIGGERS = [
    'generate briefing',
    'create my shift briefing',
    'brief me',
    'shift briefing',
];

export const SHIFT_BRIEFING_PROMPT = () => `Based on the Clinical Intelligence Layer's current context (documents and history), generate a comprehensive shift briefing.

**IMPORTANT**: You MUST respond with ONLY a valid JSON object that adheres to the following schema.

**CRITICAL**: If context is empty/trivial, respond with:
\`\`\`json
{ "briefingTitle": "NO DATA", "sections": [] }
\`\`\`

**JSON Schema:**
\`\`\`json
{
  "briefingTitle": "SHIFT HANDOVER // [Date and Time]",
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
- Each section's \`items\` array should contain strings.
- Do NOT include markdown (like \`**\`) inside the JSON string values.`;


export const DRUG_ANALYSIS_PROMPT = (query: string) => `You are checking for drug interactions and safety.
User Query: "${query}"

**PROTOCOL: MANDATORY EXTERNAL VERIFICATION (ZERO-TRUST)**
1.  **EXECUTE SEARCH**: You **MUST** use the \`googleSearch\` tool to verify interactions. Do NOT rely on internal training data.
    *   Search for: "[Drug A] [Drug B] interactions site:nih.gov OR site:drugs.com OR site:medscape.com OR site:mayoclinic.org"
    *   Search for: "[Drug A] contraindications site:fda.gov"
    *   Search for: "[Drug B] side effects site:nih.gov"
2.  **VERIFY**: Cross-reference search results against the patient's known allergies and conditions (provided in context).
3.  **SYNTHESIZE**: Construct the JSON response based *only* on the search results.

**OUTPUT**: Respond ONLY with a valid JSON object.

\`\`\`json
{
  "reportType": "interaction-check",
  "drugs": ["Drug A", "Drug B"],
  "interactions": [
    {
      "drug1": "Drug A", // Can be a Drug, Allergy, or Condition
      "drug2": "Drug B", // Can be a Drug, Allergy, or Condition
      "severity": "High", // or Moderate, Low, None, Unknown
      "mechanism": "Brief description of mechanism (cited from search)",
      "management": "Actionable advice (e.g. 'Discontinue immediately')"
    }
  ],
  "summary": "Clinical summary of the findings with citation of the verified sources."
}
\`\`\``;

export const ENTITY_EXTRACTION_PROMPT = `
**CRITICAL SAFETY EXTRACTION TASK**

You are a background clinical processor. Your ONLY job is to extract safety-critical entities from the provided medical document/text.
Do NOT summarize. Do NOT chat.

**EXTRACT THE FOLLOWING:**
1. **ALLERGIES**: List all allergies found (Drugs, Foods, Latex, etc).
2. **CODE STATUS**: Extract status if present (e.g., "Full Code", "DNR", "DNI", "Comfort Measures"). If not found, ignore.
3. **DIAGNOSIS**: Extract the primary diagnosis or reason for admission.

**OUTPUT FORMAT:**
Return ONLY a valid JSON object:
\`\`\`json
{
  "allergies": ["Penicillin", "Peanuts"],
  "codeStatus": "DNR", 
  "diagnosis": ["Sepsis", "Pneumonia"]
}
\`\`\`

If a field is not found, return an empty array or null.
`;
