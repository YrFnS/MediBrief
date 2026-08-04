import {
    createTimelineEntry,
    getObservationDisplayValue,
    selectActiveConfirmedConditions,
    selectCandidateResources,
    selectConfirmedAllergies,
    selectConfirmedMedications,
    selectConfirmedPatientSummary,
    selectConfirmedResources,
} from '../clinical-record';
import type {
    AllergyIntoleranceRecord,
    AppointmentRecord,
    ClinicalDate,
    ClinicalRecordResource,
    ClinicalTaskRecord,
    ConfirmedVital,
    MedicationRecord,
    PatientClinicalRecord,
    PatientClinicalResource,
} from '../clinical-record';
import type {
    EmergencySummaryViewModel,
    EmergencyVital,
    FollowUpItem,
    PatientOverviewViewModel,
    TimelineDisplayItem,
    TimelineResourceFilter,
    TimelineResourceType,
    TimelineViewModel,
} from './types';

export const RESOURCE_TYPE_LABELS: Record<TimelineResourceType, string> = {
    Encounter: 'Encounter',
    Condition: 'Condition',
    AllergyIntolerance: 'Allergy',
    Medication: 'Medication',
    Observation: 'Observation',
    DiagnosticReport: 'Diagnostic report',
    Specimen: 'Specimen',
    Procedure: 'Procedure',
    Immunization: 'Immunization',
    Appointment: 'Appointment',
    ClinicalTask: 'Task',
    CarePlan: 'Care plan',
    DocumentReference: 'Document',
    ClinicalNote: 'Clinical note',
};

const SOURCE_LABELS: Record<ClinicalRecordResource['provenance']['source']['kind'], string> = {
    manual: 'Manual entry',
    'document-extraction': 'Document extraction',
    import: 'Imported record',
    'legacy-migration': 'Legacy migration',
    device: 'Device',
    'ai-suggestion': 'AI-assisted entry',
};

const normalizeText = (value?: string): string =>
    (value || '').trim().replace(/\s+/g, ' ');

export const humanizeToken = (value?: string): string => {
    const normalized = normalizeText(value).replace(/[-_]+/g, ' ');
    if (!normalized) return 'Unknown';
    return normalized.replace(/\b\w/g, character => character.toUpperCase());
};

const safeDate = (value: string): Date | null => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateTime = (value?: string): string => {
    if (!value) return 'Unknown';
    const parsed = safeDate(value);
    if (!parsed) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(parsed);
};

export const formatClinicalDate = (date?: ClinicalDate): string => {
    if (!date?.value || date.precision === 'unknown') {
        return date?.sourceText
            ? `Unknown (${date.sourceText})`
            : 'Unknown';
    }

    if (date.precision === 'year') return date.value;

    const dateValue = date.precision === 'month'
        ? `${date.value}-01T00:00:00.000Z`
        : `${date.value}T00:00:00.000Z`;
    const parsed = safeDate(dateValue);
    if (!parsed) return date.sourceText || date.value;

    return new Intl.DateTimeFormat('en-US', date.precision === 'month'
        ? {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }
        : {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(parsed);
};

export const calculateAge = (
    dateOfBirth: ClinicalDate | undefined,
    referenceDate = new Date(),
): number | undefined => {
    if (
        !dateOfBirth?.value
        || dateOfBirth.precision !== 'day'
    ) {
        return undefined;
    }

    const birthDate = safeDate(`${dateOfBirth.value}T00:00:00.000Z`);
    if (!birthDate || birthDate.getTime() > referenceDate.getTime()) {
        return undefined;
    }

    let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDifference = referenceDate.getUTCMonth() - birthDate.getUTCMonth();
    if (
        monthDifference < 0
        || (
            monthDifference === 0
            && referenceDate.getUTCDate() < birthDate.getUTCDate()
        )
    ) {
        age -= 1;
    }
    return age >= 0 ? age : undefined;
};

const truncate = (value: string, limit = 150): string => {
    const normalized = normalizeText(value);
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 1)}…`;
};

const resourceLabel = (resource: PatientClinicalResource): string => {
    switch (resource.resourceType) {
        case 'Encounter':
            return resource.type?.text
                || humanizeToken(resource.encounterClass);
        case 'Condition':
            return resource.code.text;
        case 'AllergyIntolerance':
            return resource.substance.text;
        case 'Medication':
            return resource.medication.text;
        case 'Observation':
            return resource.code.text;
        case 'DiagnosticReport':
            return resource.code.text;
        case 'Specimen':
            return resource.type?.text || 'Specimen';
        case 'Procedure':
            return resource.code.text;
        case 'Immunization':
            return resource.vaccineCode.text;
        case 'Appointment':
            return resource.title || 'Appointment request';
        case 'ClinicalTask':
            return resource.title;
        case 'CarePlan':
            return resource.title;
        case 'DocumentReference':
            return resource.title || resource.fileName;
        case 'ClinicalNote':
            return resource.title;
    }
};

const resourceStatus = (resource: PatientClinicalResource): string | undefined => {
    switch (resource.resourceType) {
        case 'Encounter':
        case 'Medication':
        case 'Observation':
        case 'DiagnosticReport':
        case 'Specimen':
        case 'Procedure':
        case 'Immunization':
        case 'Appointment':
        case 'ClinicalTask':
        case 'CarePlan':
        case 'DocumentReference':
        case 'ClinicalNote':
            return humanizeToken(resource.status);
        case 'Condition':
        case 'AllergyIntolerance':
            return humanizeToken(resource.clinicalStatus);
    }
};

const joinConcepts = (
    concepts: Array<{ text: string }> | undefined,
): string => (concepts || [])
    .map(concept => normalizeText(concept.text))
    .filter(Boolean)
    .join(', ');

const allergyReactionText = (
    allergy: AllergyIntoleranceRecord,
): string[] => allergy.reactions.flatMap(reaction => {
    const manifestations = joinConcepts(reaction.manifestation);
    const description = normalizeText(reaction.description);
    const severity = reaction.severity
        ? humanizeToken(reaction.severity)
        : '';
    const result = [manifestations || description, severity]
        .filter(Boolean)
        .join(' — ');
    return result ? [result] : [];
});

const medicationDosageText = (
    medication: MedicationRecord,
): string | undefined => {
    const text = medication.dosageInstructions
        .map(dosage => normalizeText(dosage.text))
        .filter(Boolean)
        .join('; ');
    return text || undefined;
};

const resourceDetail = (resource: PatientClinicalResource): string | undefined => {
    switch (resource.resourceType) {
        case 'Encounter': {
            const reason = joinConcepts(resource.reason);
            return truncate([
                reason,
                normalizeText(resource.location),
                normalizeText(resource.serviceProvider),
            ].filter(Boolean).join(' · ')) || undefined;
        }
        case 'Condition':
            return truncate([
                resource.severity?.text,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'AllergyIntolerance': {
            const reactions = allergyReactionText(resource).join('; ');
            return truncate([
                humanizeToken(resource.criticality),
                reactions,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        }
        case 'Medication':
            return truncate([
                medicationDosageText(resource),
                joinConcepts(resource.reason),
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'Observation': {
            const display = getObservationDisplayValue(resource);
            const result = display
                ? `${display.value}${display.unit ? ` ${display.unit}` : ''}`
                : '';
            return truncate([
                result,
                joinConcepts(resource.interpretation),
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        }
        case 'DiagnosticReport':
            return truncate(resource.conclusion || joinConcepts(
                resource.conclusionCodes,
            )) || undefined;
        case 'Specimen':
            return truncate([
                resource.bodySite?.text,
                resource.collectionMethod?.text,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'Procedure':
            return truncate([
                resource.outcome?.text,
                joinConcepts(resource.complications),
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'Immunization':
            return truncate([
                resource.manufacturer,
                resource.lotNumber,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'Appointment':
            return truncate([
                resource.description,
                resource.location,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'ClinicalTask':
            return truncate([
                humanizeToken(resource.intent),
                humanizeToken(resource.priority),
                resource.description,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'CarePlan':
            return truncate([
                humanizeToken(resource.intent),
                resource.description,
                resource.note,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'DocumentReference':
            return truncate([
                resource.documentType?.text,
                resource.description,
                resource.mimeType,
            ].filter(Boolean).join(' · ')) || undefined;
        case 'ClinicalNote': {
            const firstSection = resource.sections[0];
            return truncate([
                humanizeToken(resource.noteType),
                resource.author,
                firstSection?.text,
            ].filter(Boolean).join(' · ')) || undefined;
        }
    }
};

const sourceLabel = (resource: ClinicalRecordResource): string => {
    const source = resource.provenance.source;
    const base = SOURCE_LABELS[source.kind];
    const sourceName = source.document?.fileName
        || source.externalSystem
        || source.description;
    return sourceName ? `${base}: ${truncate(sourceName, 80)}` : base;
};

const dateGroup = (
    clinicalDate: ClinicalDate | null,
    sortTimestamp: number,
): { key: string; label: string } => {
    if (clinicalDate?.value && clinicalDate.precision === 'year') {
        return { key: clinicalDate.value, label: clinicalDate.value };
    }
    if (clinicalDate?.value && clinicalDate.precision === 'month') {
        return {
            key: clinicalDate.value,
            label: formatClinicalDate(clinicalDate),
        };
    }

    const parsed = new Date(sortTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return { key: 'dated', label: 'Dated events' };
    }
    return {
        key: `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(parsed),
    };
};

const buildTimelineDisplayItem = (
    resource: PatientClinicalResource,
): TimelineDisplayItem => {
    const entry = createTimelineEntry(resource);
    const knownClinicalDate = !entry.usesRecordedAtFallback;
    const group = knownClinicalDate
        ? dateGroup(entry.clinicalDate, entry.sortTimestamp)
        : { key: 'undated', label: 'Clinical date unknown' };
    const dateLabel = knownClinicalDate
        ? entry.clinicalDate
            ? formatClinicalDate(entry.clinicalDate)
            : formatDateTime(entry.dateTime)
        : 'Clinical date unknown';

    return {
        resourceId: resource.id,
        resourceType: resource.resourceType,
        resourceTypeLabel: RESOURCE_TYPE_LABELS[resource.resourceType],
        label: resourceLabel(resource),
        ...(resourceDetail(resource)
            ? { detail: resourceDetail(resource) }
            : {}),
        ...(resourceStatus(resource)
            ? { status: resourceStatus(resource) }
            : {}),
        dateLabel,
        dateGroupKey: group.key,
        dateGroupLabel: group.label,
        knownClinicalDate,
        sortTimestamp: entry.sortTimestamp,
        recordedLabel: `Stored ${formatDateTime(resource.recordedAt)}`,
        sourceLabel: sourceLabel(resource),
        ...(resource.provenance.source.document
            ? { sourceDocument: resource.provenance.source.document }
            : {}),
        tags: resource.tags || [],
    };
};

export const buildTimelineViewModel = (
    record: PatientClinicalRecord,
    options: {
        resourceType?: TimelineResourceFilter;
        search?: string;
    } = {},
): TimelineViewModel => {
    const resourceType = options.resourceType || 'all';
    const search = normalizeText(options.search).toLowerCase();

    const items = selectConfirmedResources(record)
        .map(buildTimelineDisplayItem)
        .filter(item => resourceType === 'all'
            || item.resourceType === resourceType)
        .filter(item => {
            if (!search) return true;
            return [
                item.resourceTypeLabel,
                item.label,
                item.detail,
                item.status,
                item.sourceLabel,
                ...item.tags,
            ].filter(Boolean).join(' ').toLowerCase().includes(search);
        });

    const dated = items
        .filter(item => item.knownClinicalDate)
        .sort((left, right) => {
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.resourceId.localeCompare(right.resourceId);
        });
    const undated = items
        .filter(item => !item.knownClinicalDate)
        .sort((left, right) => {
            const recordedComparison = right.recordedLabel.localeCompare(
                left.recordedLabel,
            );
            if (recordedComparison !== 0) return recordedComparison;
            return left.resourceId.localeCompare(right.resourceId);
        });

    return {
        dated,
        undated,
        total: dated.length + undated.length,
    };
};

const primaryIdentifier = (
    record: PatientClinicalRecord,
): string | undefined => {
    const identifier = record.profile.identifiers.find(item =>
        item.type?.toLowerCase() === 'mrn'
        || item.use === 'official',
    ) || record.profile.identifiers[0];
    if (!identifier) return undefined;
    return `${identifier.type || 'ID'}: ${identifier.value}`;
};

const followUpItems = (
    record: PatientClinicalRecord,
): FollowUpItem[] => {
    const resources = selectConfirmedResources(record);
    const appointments = resources.filter(
        (resource): resource is AppointmentRecord =>
            resource.resourceType === 'Appointment'
            && ['proposed', 'pending', 'booked', 'arrived'].includes(
                resource.status,
            ),
    );
    const tasks = resources.filter(
        (resource): resource is ClinicalTaskRecord =>
            resource.resourceType === 'ClinicalTask'
            && ![
                'completed',
                'cancelled',
                'failed',
                'entered-in-error',
            ].includes(resource.status),
    );

    return [...appointments, ...tasks]
        .map(resource => {
            const timeline = buildTimelineDisplayItem(resource);
            return {
                item: {
                    id: resource.id,
                    kind: resource.resourceType === 'Appointment'
                        ? 'appointment' as const
                        : 'task' as const,
                    title: resourceLabel(resource),
                    status: resourceStatus(resource) || 'Unknown',
                    ...(resourceDetail(resource)
                        ? { detail: resourceDetail(resource) }
                        : {}),
                    dateLabel: timeline.dateLabel,
                    knownDate: timeline.knownClinicalDate,
                },
                sortTimestamp: timeline.sortTimestamp,
            };
        })
        .sort((left, right) => {
            if (left.item.knownDate !== right.item.knownDate) {
                return left.item.knownDate ? -1 : 1;
            }
            return left.sortTimestamp - right.sortTimestamp;
        })
        .map(result => result.item);
};

export const buildPatientOverviewViewModel = (
    record: PatientClinicalRecord,
    referenceDate = new Date(),
): PatientOverviewViewModel => {
    const summary = selectConfirmedPatientSummary(record);
    const conditions = selectActiveConfirmedConditions(record);
    const allergies = selectConfirmedAllergies(record);
    const medications = selectConfirmedMedications(record);
    const confirmed = selectConfirmedResources(record);
    const pendingFollowUp = followUpItems(record);
    const timeline = buildTimelineViewModel(record);
    const recentTimeline = [
        ...timeline.dated.slice(0, 6),
        ...timeline.undated.slice(0, Math.max(0, 6 - timeline.dated.length)),
    ];
    const age = calculateAge(record.profile.dateOfBirth, referenceDate);
    const firstContact = record.profile.contacts[0];

    const dataGaps: string[] = [];
    if (!record.profile.dateOfBirth) {
        dataGaps.push('Date of birth is not recorded.');
    }
    if (!record.profile.bloodType) {
        dataGaps.push('Blood type is not recorded.');
    }
    if (record.profile.contacts.length === 0) {
        dataGaps.push('No contact details are recorded.');
    }
    if (allergies.length === 0) {
        dataGaps.push('Allergy status has not been confirmed.');
    }
    if (medications.length === 0) {
        dataGaps.push('No active medications are confirmed.');
    }
    if (conditions.length === 0) {
        dataGaps.push('No active conditions are confirmed.');
    }
    if (!summary.codeStatus) {
        dataGaps.push('Code status is not confirmed.');
    }
    if (summary.candidateCount > 0) {
        dataGaps.push(
            `${summary.candidateCount} candidate record${summary.candidateCount === 1 ? '' : 's'} await review.`,
        );
    }

    return {
        patientName: record.profile.displayName,
        ...(primaryIdentifier(record)
            ? { primaryIdentifier: primaryIdentifier(record) }
            : {}),
        dateOfBirthLabel: record.profile.dateOfBirth
            ? formatClinicalDate(record.profile.dateOfBirth)
            : 'Not recorded',
        ...(age !== undefined ? { ageLabel: `${age} years` } : {}),
        administrativeSexLabel: humanizeToken(
            record.profile.administrativeSex,
        ),
        bloodTypeLabel: record.profile.bloodType || 'Not recorded',
        preferredLanguageLabel: record.profile.preferredLanguage
            || 'Not recorded',
        contactLabel: firstContact
            ? `${humanizeToken(firstContact.use)} ${humanizeToken(firstContact.system)}: ${firstContact.value}`
            : 'Not recorded',
        activeConditions: conditions.map(condition => ({
            id: condition.id,
            name: condition.code.text,
            status: humanizeToken(condition.clinicalStatus),
            ...(condition.severity?.text
                ? { detail: condition.severity.text }
                : condition.note
                    ? { detail: truncate(condition.note) }
                    : {}),
        })),
        activeAllergies: allergies.map(allergy => ({
            id: allergy.id,
            name: allergy.substance.text,
            criticality: humanizeToken(allergy.criticality),
            reactions: allergyReactionText(allergy),
        })),
        activeMedications: medications.map(medication => ({
            id: medication.id,
            name: medication.medication.text,
            status: humanizeToken(medication.status),
            ...(medicationDosageText(medication)
                ? { dosage: medicationDosageText(medication) }
                : {}),
        })),
        metrics: [
            {
                key: 'conditions',
                label: 'Active conditions',
                value: conditions.length,
                helper: 'confirmed',
            },
            {
                key: 'medications',
                label: 'Active medications',
                value: medications.length,
                helper: 'confirmed',
            },
            {
                key: 'results',
                label: 'Results',
                value: confirmed.filter(resource =>
                    resource.resourceType === 'Observation'
                    || resource.resourceType === 'DiagnosticReport',
                ).length,
                helper: 'observations and reports',
            },
            {
                key: 'documents',
                label: 'Documents',
                value: confirmed.filter(resource =>
                    resource.resourceType === 'DocumentReference',
                ).length,
                helper: 'stored references',
            },
            {
                key: 'notes',
                label: 'Notes',
                value: confirmed.filter(resource =>
                    resource.resourceType === 'ClinicalNote',
                ).length,
                helper: 'reviewed records',
            },
            {
                key: 'follow-up',
                label: 'Follow-up',
                value: pendingFollowUp.length,
                helper: 'open tasks and appointments',
            },
        ],
        pendingCandidates: selectCandidateResources(record).length,
        pendingFollowUp,
        recentTimeline,
        dataGaps,
        updatedLabel: formatDateTime(record.updatedAt),
    };
};

const vitalView = (
    key: string,
    label: string,
    vital: ConfirmedVital | null,
): EmergencyVital | null => {
    if (!vital) return null;
    return {
        key,
        label,
        value: `${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`,
        observedAt: formatDateTime(vital.observedAt.toISOString()),
        stale: vital.isStale,
    };
};

export const buildEmergencySummaryViewModel = (
    record: PatientClinicalRecord,
    referenceDate = new Date(),
): EmergencySummaryViewModel => {
    const summary = selectConfirmedPatientSummary(record);
    const conditions = selectActiveConfirmedConditions(record);
    const allergies = selectConfirmedAllergies(record);
    const medications = selectConfirmedMedications(record);
    const age = calculateAge(record.profile.dateOfBirth, referenceDate);
    const vitals = [
        vitalView('heart-rate', 'Heart rate', summary.vitals.heartRate),
        vitalView(
            'blood-pressure',
            'Systolic blood pressure',
            summary.vitals.bloodPressure,
        ),
        vitalView(
            'oxygen-saturation',
            'Oxygen saturation',
            summary.vitals.oxygenSaturation,
        ),
        vitalView('temperature', 'Temperature', summary.vitals.temperature),
    ].filter((item): item is EmergencyVital => item !== null);

    const limitations = [
        'This summary contains locally confirmed structured records only and may be incomplete.',
    ];
    if (allergies.length === 0) {
        limitations.push(
            'Allergy status is unknown because no active allergy record is confirmed.',
        );
    }
    if (medications.length === 0) {
        limitations.push('No active medications are confirmed.');
    }
    if (conditions.length === 0) {
        limitations.push('No active conditions are confirmed.');
    }
    if (!summary.codeStatus) {
        limitations.push('Code status is not confirmed.');
    }
    if (summary.candidateCount > 0) {
        limitations.push(
            `${summary.candidateCount} candidate record${summary.candidateCount === 1 ? '' : 's'} remain outside this summary until reviewed.`,
        );
    }

    return {
        patientName: record.profile.displayName,
        identifiers: record.profile.identifiers.map(identifier => ({
            label: identifier.type || identifier.system || 'Identifier',
            value: identifier.value,
        })),
        dateOfBirthLabel: record.profile.dateOfBirth
            ? formatClinicalDate(record.profile.dateOfBirth)
            : 'Unknown',
        ...(age !== undefined ? { ageLabel: `${age} years` } : {}),
        administrativeSexLabel: humanizeToken(
            record.profile.administrativeSex,
        ),
        bloodTypeLabel: record.profile.bloodType || 'Unknown',
        preferredLanguageLabel: record.profile.preferredLanguage || 'Unknown',
        contacts: record.profile.contacts.map(contact =>
            `${humanizeToken(contact.use)} ${humanizeToken(contact.system)}: ${contact.value}`,
        ),
        codeStatus: summary.codeStatus,
        allergies: allergies.map(allergy => ({
            id: allergy.id,
            name: allergy.substance.text,
            criticality: humanizeToken(allergy.criticality),
            reactions: allergyReactionText(allergy),
        })),
        medications: medications.map(medication => ({
            id: medication.id,
            name: medication.medication.text,
            ...(medicationDosageText(medication)
                ? { dosage: medicationDosageText(medication) }
                : {}),
            status: humanizeToken(medication.status),
        })),
        conditions: conditions.map(condition => ({
            id: condition.id,
            name: condition.code.text,
            status: humanizeToken(condition.clinicalStatus),
            ...(condition.severity?.text
                ? { severity: condition.severity.text }
                : {}),
        })),
        vitals,
        limitations,
        generatedLabel: formatDateTime(referenceDate.toISOString()),
        recordUpdatedLabel: formatDateTime(record.updatedAt),
    };
};
