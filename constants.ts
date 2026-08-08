import { ChatMode } from './types';

export const WELCOME_CONTENT = {
    title: 'MediBrief',
    subtitle: 'Local Personal Health Record Assistant',
    introduction: 'Organize medical documents and review AI-assisted candidate information before it enters your confirmed record.',
    features: [
        { icon: '📁', text: 'Documents: Keep reports and images linked to their source records' },
        { icon: '✅', text: 'Human Review: Confirm, edit, or reject extracted candidate facts' },
        { icon: '📈', text: 'Trends: View confirmed, dated observations without inventing missing dates' },
        { icon: '📝', text: 'Notes: Save reviewed SOAP notes as durable local records' },
        { icon: '💊', text: 'Medication Information: Retrieve limited label and source information without claiming regimen safety' },
        { icon: '🎙️', text: 'Voice and Scribe: Draft local records that remain subject to user review' },
    ],
    getStarted: {
        title: 'Suggested workflow:',
        steps: [
            'Upload a medical document or enter information manually',
            'Review extracted candidates against the original source',
            'Confirm only the facts you want in the structured patient record',
        ],
    },
    closing: 'Ready for local record review and organization.',
};

export const HELP_COMMAND_RESPONSE = `🔧 **MediBrief Command Reference**

**Core functions:**
- \`/brief\` - Create a reviewable summary from the available record context.
- \`/patient [ID]\` - Summarize the selected patient context.
- \`/drugs [names]\` - Retrieve an evidence-linked interaction summary. This is not a regimen-safety verdict.
- \`/export\` - Export the current briefing to PDF.
- \`/help\` - Show this reference.

**Important boundaries:**
- Extracted facts are candidates until a person confirms them.
- Missing dates stay unknown.
- Web sources are references, not automatic proof that a claim applies to a patient.
- Appointment tools save local proposals only; they do not contact or book with a clinic.
- Automated deterministic clinical conclusions are currently disabled pending protocol validation.

**Modes:**
- **Normal:** General document and record assistance.
- **Deep Analysis:** More detailed reasoning with the selected model.
- **Live:** Disabled because browser-only OpenRouter BYOK has no real-time audio transport.
- **Ambient Scribe:** Manual SOAP editing remains available; live transcription is disabled.`;

export const MODEL_CONFIGS = {
    [ChatMode.Standard]: {
        description: 'General record and document assistance.',
        contextLimit: 30,
    },
    [ChatMode.Deep]: {
        description: 'Detailed reasoning with the explicitly selected model.',
        contextLimit: 10,
    },
    [ChatMode.Live]: {
        description: 'Live audio is unavailable with browser-only OpenRouter BYOK.',
        contextLimit: 6,
    },
    [ChatMode.Scribe]: {
        description: 'Manual SOAP-note editing remains available; live transcription is disabled.',
        contextLimit: 0,
    },
};

export const SYSTEM_INSTRUCTION = `You are the MediBrief local personal health-record assistant.

**ROLE AND BOUNDARIES**
- Help organize, extract, summarize, and explain medical information.
- Do not present yourself as a clinician, hospital order-entry system, autonomous decision maker, or source of confirmed diagnosis.
- A statement from an uploaded file or AI extraction is a candidate fact until the user reviews it.
- Preserve uncertainty, negation, historical context, family-history context, original values, and unknown dates.
- Never invent a missing date, result, diagnosis, allergy, dose, source, or completed action.

**SOURCES**
- Use web search for current guidelines, medication information, interactions, and claims that need external support.
- Prefer official regulators, public-health authorities, peer-reviewed literature, and recognized clinical organizations.
- Describe sources accurately. A preferred domain does not prove that a claim applies to this patient.
- Never fabricate citations.

**MEDICATIONS**
- Do not declare a medication or regimen safe based on a drug name and one extracted amount.
- Explain missing context such as frequency, route, indication, formulation, total daily dose, age, weight, kidney/liver function, allergies, pregnancy, and interacting medicines.
- FDA/openFDA label lookup is limited label information, not patient-specific validation.
- Do not instruct the user to start, stop, or change prescription treatment. Present evidence and questions to discuss with an appropriate clinician.

**MEDICAL IMAGES**
- Describe visible observations and image quality limitations.
- Label interpretations as AI-assisted observations, not a radiology report or diagnosis.
- Do not claim that absence of a visible finding proves normality.

**TOOLS AND ACTIONS**
- The scheduleAppointment tool only saves a local appointment proposal. Always say that it is proposed and not booked or confirmed by a clinic.
- Never say that an order, treatment, referral, appointment, or task was executed unless the application has a durable record proving the exact completed action.
- Follow-up task creation is a reminder/proposal, not a clinical order.

**URGENT CONCERNS**
- When the supplied information suggests a potentially urgent issue, clearly recommend timely evaluation by an appropriate healthcare professional or emergency service without claiming a definitive diagnosis.

**FORMAT**
- Be precise and readable.
- Separate source facts, AI interpretation, uncertainty, and suggested follow-up.
- When a feature requires JSON, return valid JSON matching the requested schema.`;

export const SCRIBE_SYSTEM_INSTRUCTION = `
You are an ambient medical scribe that drafts editable SOAP fields.

1. Remain silent; do not speak to the patient or clinician.
2. Use the updateSoapNote function to update the visible draft.
3. Capture statements accurately and preserve uncertainty and attribution.
4. Do not add diagnoses, findings, treatments, or plans that were not spoken.
5. The draft is not a final clinical note until the user reviews and saves it.
6. Capture values, units, routes, frequencies, and dates exactly as stated; leave missing information missing.
`;

/**
 * Automated CDSS generation is intentionally disabled until validated protocol
 * packages and regression evidence exist. Keeping this export prevents older
 * call sites from producing free-form rules.
 */
export const CDSS_CHECK_PROMPT = `
Automated clinical rule generation is disabled pending protocol validation.
Return exactly this JSON object and no other text:
{"alerts":[]}
`;

export const FILE_ANALYSIS_PROMPT = (filename: string) => `Analyze the attached file named "${filename}" as a source document for user review.

**GENERAL RULES**
- Extract what is visible; do not invent missing values or dates.
- Preserve negation, uncertainty, historical context, and family attribution.
- Treat clinical claims as candidates for review, not confirmed patient facts.
- Separate source text from AI interpretation.

**IF TYPE IS "Medical Image":**
Return valid JSON:
\`\`\`json
{
  "reportType": "medical-image",
  "imageType": "[modality if visible or inferable, otherwise Unknown]",
  "patient": "[name/ID if visible, otherwise Not Visible]",
  "date": "[date if visible, otherwise Not Visible]",
  "visualObservations": "[visible observations and image-quality limitations]",
  "certaintyScore": "[High | Medium | Low]",
  "potentialAbnormalities": "[possible visible findings, clearly labelled as AI suggestions]",
  "differentialDiagnosisSuggestions": "[optional possibilities; not a diagnosis]",
  "extractedInformation": "[visible text]",
  "note": "AI-assisted observations for human review; not a radiology report.",
  "nextSteps": "[reasonable questions or professional follow-up, without claiming an order was placed]"
}
\`\`\`

**IF TYPE IS "Lab Report" OR a clinical note containing lab/vital values:**
Return valid JSON. Keep the report date as "Not Visible" when absent.
\`\`\`json
{
  "reportType": "lab-report",
  "patient": "[name/ID if visible, otherwise Not Visible]",
  "date": "[source date if visible, otherwise Not Visible]",
  "labs": [
    {
      "testName": "[source label]",
      "loinc": "[only when confidently available]",
      "value": "[original visible value]",
      "units": "[original visible unit or empty string]",
      "refRange": "[original visible range or empty string]",
      "flag": "[Normal | High | Low | Critical | Abnormal | Unknown]"
    }
  ],
  "interpretation": "[brief AI-assisted summary with uncertainty and no automatic treatment conclusion]"
}
\`\`\`

**IF TYPE IS "Medication List":**
Use Markdown and provide:
- the medications exactly as visible;
- missing regimen fields;
- source-linked label or interaction information only when available;
- a clear statement that the review does not determine patient-specific regimen safety.

**OTHER DOCUMENTS:**
Use Markdown with the document type, extracted candidate facts, unknown fields, and source-linked observations. End with: "Candidates prepared for human review."`;

export const FILE_TEXT_ANALYSIS_PROMPT = (
    filename: string,
    text: string,
) => `The following text was extracted from "${filename}".

--- BEGIN DOCUMENT TEXT ---
${text}
--- END DOCUMENT TEXT ---

Extract candidate allergies, conditions, medications, dates, measurements, and plans while preserving negation, uncertainty, history, and attribution. Do not convert family history or ruled-out conditions into active patient facts. Do not claim that any treatment or order was completed. Clearly separate source statements from AI interpretation and conclude with: "Candidates prepared for human review."`;

export const BRIEFING_TRIGGERS = [
    'generate briefing',
    'create my shift briefing',
    'brief me',
    'shift briefing',
];

export const SHIFT_BRIEFING_PROMPT = () => `Based on the available MediBrief context, create a reviewable record briefing.

Return ONLY valid JSON. If the context is empty or trivial, return:
\`\`\`json
{"briefingTitle":"NO DATA","sections":[]}
\`\`\`

Use this schema:
\`\`\`json
{
  "briefingTitle": "RECORD BRIEFING // [Date and Time]",
  "sections": [
    {"title":"CONFIRMED RECORD","items":["Confirmed, source-linked facts only"]},
    {"title":"PENDING REVIEW","items":["Unconfirmed candidates and missing information"]},
    {"title":"RECENT RESULTS","items":["Dated results with original values and units"]},
    {"title":"MEDICATIONS","items":["Confirmed medication records and missing regimen details"]},
    {"title":"FOLLOW-UP","items":["Appointments, tasks, and questions; distinguish proposed from booked/completed"]},
    {"title":"SOURCE NOTES","items":["Important provenance and uncertainty"]}
  ]
}
\`\`\`

Do not place unconfirmed candidates in the confirmed section. Do not imply that proposed tasks or appointments are completed. Do not include Markdown inside JSON strings.`;

export const DRUG_ANALYSIS_PROMPT = (query: string) => `Prepare an evidence-linked medication interaction summary for:
"${query}"

Use current authoritative sources through web search. Do not produce a binary safe/unsafe verdict and do not instruct the user to start, stop, or change prescription treatment. Explicitly identify missing patient and regimen context.

Return ONLY valid JSON:
\`\`\`json
{
  "reportType": "interaction-check",
  "drugs": ["Drug A", "Drug B"],
  "interactions": [
    {
      "drug1": "Drug A",
      "drug2": "Drug B",
      "severity": "High",
      "mechanism": "Evidence-linked description with uncertainty",
      "management": "Questions, monitoring considerations, or clinician follow-up described without claiming an order was placed"
    }
  ],
  "summary": "Evidence summary, source limitations, and missing patient/regimen context"
}
\`\`\``;

export const ENTITY_EXTRACTION_PROMPT = `
Extract candidate clinical entities from the supplied document.

Return ONLY valid JSON:
\`\`\`json
{
  "allergies": ["candidate allergy text exactly as supported by the source"],
  "codeStatus": "candidate code-status text or null",
  "diagnosis": ["candidate condition or diagnosis text"]
}
\`\`\`

Do not infer an allergy, code status, or diagnosis that is not explicitly supported. Exclude clearly negated statements, family-history-only statements, and hypothetical/rule-out statements when the limited output schema cannot preserve that context. These results will remain candidates until a person reviews them.
`;
