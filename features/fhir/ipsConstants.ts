export const FHIR_R4_VERSION = '4.0.1';
export const IPS_VERSION = '2.0.1';
export const IPS_PACKAGE = `hl7.fhir.uv.ips#${IPS_VERSION}`;

export const IPS_CANONICAL_BASE = 'http://hl7.org/fhir/uv/ips';

export const IPS_PROFILES = {
    bundle: `${IPS_CANONICAL_BASE}/StructureDefinition/Bundle-uv-ips`,
    composition: `${IPS_CANONICAL_BASE}/StructureDefinition/Composition-uv-ips`,
    patient: `${IPS_CANONICAL_BASE}/StructureDefinition/Patient-uv-ips`,
    allergyIntolerance: `${IPS_CANONICAL_BASE}/StructureDefinition/AllergyIntolerance-uv-ips`,
    condition: `${IPS_CANONICAL_BASE}/StructureDefinition/Condition-uv-ips`,
    medicationStatement: `${IPS_CANONICAL_BASE}/StructureDefinition/MedicationStatement-uv-ips`,
    medicationRequest: `${IPS_CANONICAL_BASE}/StructureDefinition/MedicationRequest-uv-ips`,
    immunization: `${IPS_CANONICAL_BASE}/StructureDefinition/Immunization-uv-ips`,
    procedure: `${IPS_CANONICAL_BASE}/StructureDefinition/Procedure-uv-ips`,
    diagnosticReport: `${IPS_CANONICAL_BASE}/StructureDefinition/DiagnosticReport-uv-ips`,
    specimen: `${IPS_CANONICAL_BASE}/StructureDefinition/Specimen-uv-ips`,
    observationLaboratoryPathology: `${IPS_CANONICAL_BASE}/StructureDefinition/Observation-results-laboratory-pathology-uv-ips`,
    observationRadiology: `${IPS_CANONICAL_BASE}/StructureDefinition/Observation-results-radiology-uv-ips`,
    device: `${IPS_CANONICAL_BASE}/StructureDefinition/Device-uv-ips`,
} as const;

export const FHIR_PROFILES = {
    vitalSigns: 'http://hl7.org/fhir/StructureDefinition/vitalsigns',
} as const;

export const FHIR_SYSTEMS = {
    loinc: 'http://loinc.org',
    ucum: 'http://unitsofmeasure.org',
    conditionClinical: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
    conditionVerification: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
    allergyClinical: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
    allergyVerification: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
    listEmptyReason: 'http://terminology.hl7.org/CodeSystem/list-empty-reason',
    confidentiality: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
    observationCategory: 'http://terminology.hl7.org/CodeSystem/observation-category',
    language: 'urn:ietf:bcp:47',
} as const;

export const IPS_DOCUMENT_TYPE = {
    system: FHIR_SYSTEMS.loinc,
    code: '60591-5',
    display: 'Patient summary Document',
} as const;

export interface IpsSectionDefinition {
    id: string;
    title: string;
    code: string;
    display: string;
    required: boolean;
}

export const IPS_SECTIONS = {
    medicationSummary: {
        id: 'medications',
        title: 'Medication Summary',
        code: '10160-0',
        display: 'History of Medication use Narrative',
        required: true,
    },
    allergies: {
        id: 'allergies',
        title: 'Allergies and Intolerances',
        code: '48765-2',
        display: 'Allergies and adverse reactions Document',
        required: true,
    },
    problems: {
        id: 'problems',
        title: 'Problem List',
        code: '11450-4',
        display: 'Problem list - Reported',
        required: true,
    },
    immunizations: {
        id: 'immunizations',
        title: 'Immunizations',
        code: '11369-6',
        display: 'History of Immunization Narrative',
        required: false,
    },
    procedures: {
        id: 'procedures',
        title: 'History of Procedures',
        code: '47519-4',
        display: 'History of Procedures Document',
        required: false,
    },
    results: {
        id: 'results',
        title: 'Diagnostic Results',
        code: '30954-2',
        display: 'Relevant diagnostic tests/laboratory data Narrative',
        required: false,
    },
    vitalSigns: {
        id: 'vital-signs',
        title: 'Vital Signs',
        code: '8716-3',
        display: 'Vital signs',
        required: false,
    },
    pastProblems: {
        id: 'past-problems',
        title: 'History of Past Problems',
        code: '11348-0',
        display: 'History of Past illness Narrative',
        required: false,
    },
} satisfies Record<string, IpsSectionDefinition>;

export const REQUIRED_IPS_SECTION_CODES = [
    IPS_SECTIONS.medicationSummary.code,
    IPS_SECTIONS.allergies.code,
    IPS_SECTIONS.problems.code,
] as const;

export const MEDIBRIEF_FHIR_IDENTIFIER_BASE =
    'https://medibrief.local/fhir/identifier';

/** Stable UUID namespace used only to derive deterministic document-local IDs. */
export const MEDIBRIEF_IPS_UUID_NAMESPACE =
    'c74dbed7-23ef-5c7e-a16e-0f0d2c9984f6';

export const IPS_EXPORT_TAGS = ['fhir-r4', `ips-${IPS_VERSION}`] as const;
