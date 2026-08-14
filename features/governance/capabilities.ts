export type CapabilityStatus =
    | 'available'
    | 'experimental'
    | 'disabled'
    | 'planned';

export interface CapabilityDefinition {
    id: string;
    name: string;
    status: CapabilityStatus;
    description: string;
    boundary: string;
}

export const CAPABILITY_STATUS_LABELS: Record<CapabilityStatus, string> = {
    available: 'Available',
    experimental: 'Experimental',
    disabled: 'Disabled',
    planned: 'Planned',
};

export const MEDIBRIEF_CAPABILITIES: CapabilityDefinition[] = [
    {
        id: 'local-record',
        name: 'Local personal health record',
        status: 'available',
        description: 'Stores structured patient-entered and reviewed records in the local encrypted browser vault.',
        boundary: 'The record may be incomplete and is not a replacement for records held by clinicians, laboratories, pharmacies, or hospitals.',
    },
    {
        id: 'evidence-review',
        name: 'Source and candidate review',
        status: 'available',
        description: 'Separates extracted candidates from confirmed facts and preserves source, uncertainty, and correction history.',
        boundary: 'Confirmation means a local user reviewed the item; it does not independently verify the source or clinical truth.',
    },
    {
        id: 'deterministic-summary',
        name: 'Deterministic record summaries',
        status: 'available',
        description: 'Builds summaries from confirmed, patient-applicable local records without a cloud-model call.',
        boundary: 'Missing local information remains missing and must not be interpreted as clinical absence.',
    },
    {
        id: 'emergency-summary',
        name: 'Emergency summary view',
        status: 'available',
        description: 'Produces a printable view of confirmed allergies, medications, conditions, demographics, and dated vitals.',
        boundary: 'It is a record summary only and does not perform emergency triage or confirm that the record is complete or current.',
    },
    {
        id: 'medication-reconciliation',
        name: 'Medication-record reconciliation',
        status: 'available',
        description: 'Flags possible duplicate records, conflicting statuses or directions, and missing medication documentation.',
        boundary: 'It does not validate whether a medication, dose, route, frequency, duration, or combination is safe for a patient.',
    },
    {
        id: 'openmed-extraction',
        name: 'OpenMed document extraction',
        status: 'experimental',
        description: 'Can propose structured candidates from supported local OpenMed extraction services.',
        boundary: 'Every extracted item requires human review; OCR and entity extraction can omit, misread, or misclassify clinical content.',
    },
    {
        id: 'cloud-assistant',
        name: 'Cloud educational assistant',
        status: 'experimental',
        description: 'Can use a user-supplied OpenRouter key after explicit session consent and privacy-restricted routing.',
        boundary: 'Outputs are probabilistic. Patient-specific and document requests remain blocked until their exact model/provider profile is reviewed and registered.',
    },
    {
        id: 'image-preview',
        name: 'Basic medical image preview',
        status: 'experimental',
        description: 'Offers ordinary image zoom, contrast, inversion, and download controls.',
        boundary: 'It is not a diagnostic viewer, DICOM workstation, PACS, or calibrated medical display.',
    },
    {
        id: 'clinical-diagnosis',
        name: 'Automated diagnosis, treatment, or triage',
        status: 'disabled',
        description: 'No autonomous diagnostic, treatment, emergency-triage, or protocol-state conclusions are enabled.',
        boundary: 'These functions require a defined intended population, clinical ownership, evidence, validation, and monitored deployment.',
    },
    {
        id: 'medication-safety',
        name: 'Patient-specific medication safety',
        status: 'disabled',
        description: 'Dose checking, interactions, renal/hepatic adjustment, pregnancy checks, and patient-specific contraindication decisions are disabled.',
        boundary: 'FDA label lookup is informational and must not be presented as a safety verdict.',
    },
    {
        id: 'autonomous-actions',
        name: 'Autonomous orders or completed-care actions',
        status: 'disabled',
        description: 'MediBrief does not place orders, transmit prescriptions, book external appointments, or record proposed work as completed care.',
        boundary: 'Local follow-up tasks are reminders or proposals only.',
    },
    {
        id: 'ambient-audio',
        name: 'Ambient clinical audio',
        status: 'disabled',
        description: 'Live ambient transcription and encounter listening are disabled in this browser deployment.',
        boundary: 'No microphone permission is requested by the production application.',
    },
    {
        id: 'fhir-ips',
        name: 'FHIR R4 / International Patient Summary exchange',
        status: 'experimental',
        description: 'Exports confirmed local records as an IPS 2.0.1 document Bundle and imports supported IPS resources as review candidates.',
        boundary: 'Validation establishes structure for the tested document; it does not prove patient identity, clinical truth, complete terminology equivalence, source authenticity, or acceptance by every receiving system.',
    },
    {
        id: 'dicomweb',
        name: 'DICOMweb imaging integration',
        status: 'planned',
        description: 'QIDO-RS, WADO-RS, STOW-RS, and a real diagnostic imaging workflow are not yet implemented.',
        boundary: 'The current image preview must not be used for diagnosis.',
    },
    {
        id: 'clinical-validation',
        name: 'Prospective clinical validation and governance',
        status: 'planned',
        description: 'Representative multilingual datasets, clinician review, failure thresholds, and post-release monitoring are planned.',
        boundary: 'Automated tests and synthetic fixtures are engineering evidence, not clinical certification.',
    },
];
