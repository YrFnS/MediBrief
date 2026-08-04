import {
    getObservationDisplayValue,
    getResourceDateBounds,
    selectCandidateResources,
    selectConfirmedResources,
} from '../clinical-record';
import type {
    AllergyIntoleranceRecord,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantity,
    ClinicalQuantityValue,
    ClinicalRecordResource,
    ConditionRecord,
    DiagnosticReportRecord,
    MedicationDosage,
    MedicationRecord,
    ObservationRecord,
    ObservationValue,
    PatientClinicalRecord,
} from '../clinical-record';
import type {
    AllergyModuleItem,
    AllergyModuleViewModel,
    ClinicalHistoryScope,
    ConditionModuleItem,
    ConditionModuleViewModel,
    DiagnosticReportModuleItem,
    MedicationDosageView,
    MedicationModuleItem,
    MedicationModuleViewModel,
    ObservationResultItem,
    ResourceProvenanceView,
    ResultsContentFilter,
    ResultsInterpretationFilter,
    ResultsModuleViewModel,
} from './coreModuleTypes';
import {
    formatClinicalDate,
    formatDateTime,
    humanizeToken,
} from './viewModels';

const UNKNOWN_CLINICAL_DATE_LABEL = 'Clinical date unknown';

const SOURCE_KIND_LABELS: Record<
    ClinicalRecordResource['provenance']['source']['kind'],
    string
> = {
    manual: 'Manual entry',
    'document-extraction': 'Document extraction',
    import: 'Imported record',
    'legacy-migration': 'Legacy migration',
    device: 'Device',
    'ai-suggestion': 'AI-assisted entry',
};

const normalizeText = (value?: string): string =>
    (value || '').trim().replace(/\s+/g, ' ');

const lower = (value?: string): string => normalizeText(value).toLowerCase();

const unique = (values: string[]): string[] => [
    ...new Set(values.map(normalizeText).filter(Boolean)),
].sort((left, right) => left.localeCompare(right));

const matchesSearch = (searchText: string, search?: string): boolean => {
    const query = lower(search);
    return !query || searchText.includes(query);
};

const parsedTimestamp = (value?: string): number | null => {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
};

const recordedTimestamp = (resource: ClinicalRecordResource): number =>
    parsedTimestamp(resource.recordedAt) ?? 0;

const isClinicalDate = (
    value: ClinicalDate | ClinicalPeriod,
): value is ClinicalDate => 'precision' in value;

/**
 * An explicitly unknown effective date is stronger than a secondary timestamp
 * such as issuedAt or recordedAt. Those timestamps remain provenance and must
 * never be promoted into the clinical event date.
 */
const hasExplicitUnknownEffectiveDate = (
    resource: ClinicalRecordResource,
): boolean => {
    const effective = resource.effective;
    if (!effective) return false;
    if (isClinicalDate(effective)) {
        return effective.precision === 'unknown' || effective.value === null;
    }

    const dates = [effective.start, effective.end].filter(Boolean) as ClinicalDate[];
    return dates.length > 0 && dates.every(date =>
        date.precision === 'unknown' || date.value === null,
    );
};

const resourceSortTimestamp = (resource: ClinicalRecordResource): number => {
    if (hasExplicitUnknownEffectiveDate(resource)) {
        return recordedTimestamp(resource);
    }
    const bounds = getResourceDateBounds(resource);
    return bounds.start ?? recordedTimestamp(resource);
};

const clinicalDateView = (resource: ClinicalRecordResource): {
    known: boolean;
    label: string;
    sortTimestamp: number;
} => {
    if (hasExplicitUnknownEffectiveDate(resource)) {
        return {
            known: false,
            label: UNKNOWN_CLINICAL_DATE_LABEL,
            sortTimestamp: recordedTimestamp(resource),
        };
    }

    const bounds = getResourceDateBounds(resource);
    const known = !bounds.usesRecordedAtFallback;
    return {
        known,
        label: known
            ? bounds.clinicalDate
                ? formatClinicalDate(bounds.clinicalDate)
                : formatDateTime(bounds.dateTime)
            : UNKNOWN_CLINICAL_DATE_LABEL,
        sortTimestamp: bounds.start ?? recordedTimestamp(resource),
    };
};

const sourceName = (resource: ClinicalRecordResource): string | undefined => {
    const source = resource.provenance.source;
    return source.document?.fileName
        || source.externalSystem
        || source.description;
};

export const buildResourceProvenanceView = (
    resource: ClinicalRecordResource,
): ResourceProvenanceView => {
    const sourceKindLabel = SOURCE_KIND_LABELS[resource.provenance.source.kind];
    const name = sourceName(resource);
    return {
        sourceKindLabel,
        sourceLabel: name ? `${sourceKindLabel}: ${name}` : sourceKindLabel,
        recordedLabel: formatDateTime(resource.recordedAt),
        updatedLabel: formatDateTime(resource.provenance.updatedAt),
        amendmentCount: resource.amendments.length,
        ...(resource.provenance.extraction?.confidence !== undefined
            ? {
                extractionConfidence:
                    resource.provenance.extraction.confidence,
            }
            : {}),
        ...(resource.provenance.source.document
            ? { sourceDocument: resource.provenance.source.document }
            : {}),
        tags: resource.tags || [],
    };
};

const conceptTexts = (values?: Array<{ text: string }>): string[] =>
    unique((values || []).map(value => value.text));

const conditionIsCurrent = (condition: ConditionRecord): boolean => [
    'active',
    'remission',
    'unknown',
].includes(condition.clinicalStatus);

const conditionItem = (condition: ConditionRecord): ConditionModuleItem => {
    const provenance = buildResourceProvenanceView(condition);
    const bodySites = conceptTexts(condition.bodySite);
    const onsetLabel = condition.onset
        ? formatClinicalDate(condition.onset)
        : 'Unknown';
    const abatementLabel = condition.abatement
        ? formatClinicalDate(condition.abatement)
        : 'Not recorded';
    const searchText = [
        condition.code.text,
        condition.clinicalStatus,
        condition.severity?.text,
        ...bodySites,
        onsetLabel,
        abatementLabel,
        condition.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: condition.id,
        name: condition.code.text,
        clinicalStatus: condition.clinicalStatus,
        clinicalStatusLabel: humanizeToken(condition.clinicalStatus),
        current: conditionIsCurrent(condition),
        ...(condition.severity?.text
            ? { severity: condition.severity.text }
            : {}),
        bodySites,
        onsetLabel,
        abatementLabel,
        ...(condition.note ? { note: condition.note } : {}),
        provenance,
        searchText,
        sortTimestamp: resourceSortTimestamp(condition),
    };
};

export const buildConditionModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: ClinicalHistoryScope;
        status?: string;
    } = {},
): ConditionModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is ConditionRecord =>
            resource.resourceType === 'Condition')
        .map(conditionItem);
    const scope = options.scope || 'current';
    const status = options.status || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.clinicalStatus === status)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.current !== right.current) return left.current ? -1 : 1;
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.name.localeCompare(right.name);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        currentCount: allItems.filter(item => item.current).length,
        historicalCount: allItems.filter(item => !item.current).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Condition').length,
        statusOptions: unique(allItems.map(item => item.clinicalStatus)),
    };
};

const allergyIsCurrent = (allergy: AllergyIntoleranceRecord): boolean => [
    'active',
    'unknown',
].includes(allergy.clinicalStatus);

const allergyItem = (
    allergy: AllergyIntoleranceRecord,
): AllergyModuleItem => {
    const provenance = buildResourceProvenanceView(allergy);
    const categories = unique(allergy.categories.map(humanizeToken));
    const reactions = allergy.reactions.map(reaction => ({
        manifestations: conceptTexts(reaction.manifestation),
        ...(reaction.description
            ? { description: reaction.description }
            : {}),
        severity: humanizeToken(reaction.severity),
        onsetLabel: reaction.onset
            ? formatClinicalDate(reaction.onset)
            : 'Unknown',
        ...(reaction.exposureRoute?.text
            ? { route: reaction.exposureRoute.text }
            : {}),
    }));
    const lastOccurrenceLabel = allergy.lastOccurrence
        ? formatClinicalDate(allergy.lastOccurrence)
        : 'Unknown';
    const searchText = [
        allergy.substance.text,
        allergy.clinicalStatus,
        allergy.criticality,
        ...categories,
        ...reactions.flatMap(reaction => [
            ...reaction.manifestations,
            reaction.description,
            reaction.severity,
            reaction.route,
        ]),
        lastOccurrenceLabel,
        allergy.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: allergy.id,
        substance: allergy.substance.text,
        clinicalStatus: allergy.clinicalStatus,
        clinicalStatusLabel: humanizeToken(allergy.clinicalStatus),
        current: allergyIsCurrent(allergy),
        criticality: allergy.criticality,
        criticalityLabel: humanizeToken(allergy.criticality),
        categories,
        reactions,
        lastOccurrenceLabel,
        ...(allergy.note ? { note: allergy.note } : {}),
        provenance,
        searchText,
        sortTimestamp: resourceSortTimestamp(allergy),
    };
};

export const buildAllergyModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: ClinicalHistoryScope;
        status?: string;
        category?: string;
    } = {},
): AllergyModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is AllergyIntoleranceRecord =>
            resource.resourceType === 'AllergyIntolerance')
        .map(allergyItem);
    const scope = options.scope || 'current';
    const status = options.status || 'all';
    const category = options.category || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.clinicalStatus === status)
        .filter(item => category === 'all'
            || item.categories.some(value => lower(value) === lower(category)))
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.current !== right.current) return left.current ? -1 : 1;
            if (left.criticality !== right.criticality) {
                if (left.criticality === 'high') return -1;
                if (right.criticality === 'high') return 1;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.substance.localeCompare(right.substance);
        });

    const currentCount = allItems.filter(item => item.current).length;
    return {
        items,
        totalConfirmed: allItems.length,
        currentCount,
        historicalCount: allItems.filter(item => !item.current).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'AllergyIntolerance').length,
        allergyStatusKnown: currentCount > 0,
        statusOptions: unique(allItems.map(item => item.clinicalStatus)),
        categoryOptions: unique(allItems.flatMap(item => item.categories)),
    };
};

const quantityValueLabel = (quantity: ClinicalQuantityValue): string =>
    `${quantity.comparator || ''}${quantity.value}${quantity.unit ? ` ${quantity.unit}` : ''}`;

const quantityView = (quantity?: ClinicalQuantity): {
    original?: string;
    normalized?: string;
} => {
    if (!quantity) return {};
    return {
        original: quantityValueLabel(quantity.original),
        ...(quantity.normalized
            ? { normalized: quantityValueLabel(quantity.normalized) }
            : {}),
    };
};

const dosageView = (dosage: MedicationDosage): MedicationDosageView => {
    const dose = quantityView(dosage.dose);
    const maximum = dosage.maximumDosePerPeriod
        ? quantityView(dosage.maximumDosePerPeriod.dose)
        : {};
    return {
        text: normalizeText(dosage.text) || 'Dosage text not recorded',
        ...(dose.original ? { dose: dose.original } : {}),
        ...(dose.normalized && dose.normalized !== dose.original
            ? { normalizedDose: dose.normalized }
            : {}),
        ...(dosage.route?.text ? { route: dosage.route.text } : {}),
        ...(dosage.frequency ? { frequency: dosage.frequency } : {}),
        ...(dosage.timingText ? { timing: dosage.timingText } : {}),
        asNeeded: !!dosage.asNeeded,
        ...(maximum.original
            ? {
                maximumDose: dosage.maximumDosePerPeriod
                    ? `${maximum.original} per ${dosage.maximumDosePerPeriod.period}`
                    : maximum.original,
            }
            : {}),
    };
};

const medicationIsCurrent = (medication: MedicationRecord): boolean => [
    'active',
    'on-hold',
    'unknown',
].includes(medication.status);

const medicationItem = (
    medication: MedicationRecord,
): MedicationModuleItem => {
    const provenance = buildResourceProvenanceView(medication);
    const dosages = medication.dosageInstructions.map(dosageView);
    const reasons = conceptTexts(medication.reason);
    const startLabel = medication.start
        ? formatClinicalDate(medication.start)
        : 'Unknown';
    const endLabel = medication.end
        ? formatClinicalDate(medication.end)
        : medicationIsCurrent(medication)
            ? 'Ongoing / not recorded'
            : 'Not recorded';
    const searchText = [
        medication.medication.text,
        medication.kind,
        medication.status,
        ...dosages.flatMap(dosage => [
            dosage.text,
            dosage.dose,
            dosage.normalizedDose,
            dosage.route,
            dosage.frequency,
            dosage.timing,
            dosage.maximumDose,
        ]),
        ...reasons,
        startLabel,
        endLabel,
        medication.prescriber,
        medication.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: medication.id,
        name: medication.medication.text,
        kind: medication.kind,
        kindLabel: humanizeToken(medication.kind),
        status: medication.status,
        statusLabel: humanizeToken(medication.status),
        current: medicationIsCurrent(medication),
        dosages,
        reasons,
        startLabel,
        endLabel,
        ...(medication.prescriber
            ? { prescriber: medication.prescriber }
            : {}),
        ...(medication.note ? { note: medication.note } : {}),
        provenance,
        searchText,
        sortTimestamp: resourceSortTimestamp(medication),
    };
};

export const buildMedicationModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: ClinicalHistoryScope;
        status?: string;
        kind?: string;
    } = {},
): MedicationModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is MedicationRecord =>
            resource.resourceType === 'Medication')
        .map(medicationItem);
    const scope = options.scope || 'current';
    const status = options.status || 'all';
    const kind = options.kind || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.status === status)
        .filter(item => kind === 'all' || item.kind === kind)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.current !== right.current) return left.current ? -1 : 1;
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.name.localeCompare(right.name);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        currentCount: allItems.filter(item => item.current).length,
        historicalCount: allItems.filter(item => !item.current).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Medication').length,
        statusOptions: unique(allItems.map(item => item.status)),
        kindOptions: unique(allItems.map(item => item.kind)),
    };
};

const observationValueLabel = (value?: ObservationValue): string => {
    if (!value) return 'Value not recorded';
    switch (value.type) {
        case 'quantity':
            return quantityValueLabel(value.quantity.original);
        case 'string':
            return value.text;
        case 'boolean':
            return value.value ? 'Yes' : 'No';
        case 'integer':
            return String(value.value);
        case 'codeable-concept':
            return value.concept.text;
    }
};

const observationNormalizedLabel = (
    observation: ObservationRecord,
): string | undefined => {
    if (observation.value?.type !== 'quantity') return undefined;
    const normalized = observation.value.quantity.normalized;
    return normalized ? quantityValueLabel(normalized) : undefined;
};

const observationIsLaboratory = (observation: ObservationRecord): boolean => {
    const categories = (observation.category || []).map(category =>
        lower(category.text));
    return categories.some(category =>
        category.includes('laboratory') || category === 'lab')
        || (observation.tags || []).some(tag => lower(tag).includes('lab'));
};

const interpretationIsFlagged = (labels: string[]): boolean => {
    if (labels.length === 0) return false;
    const normalTerms = [
        'normal',
        'within range',
        'negative',
        'not detected',
    ];
    return labels.some(label =>
        !normalTerms.some(term => lower(label) === term));
};

const referenceRangeText = (
    observation: ObservationRecord,
): Array<{ text: string }> => observation.referenceRanges.map(range => {
    if (range.text) return { text: range.text };
    const low = range.low ? quantityValueLabel(range.low) : '';
    const high = range.high ? quantityValueLabel(range.high) : '';
    if (low && high) return { text: `${low} – ${high}` };
    if (low) return { text: `From ${low}` };
    if (high) return { text: `Up to ${high}` };
    return { text: 'Reference range not specified' };
});

const observationItem = (
    observation: ObservationRecord,
): ObservationResultItem => {
    const provenance = buildResourceProvenanceView(observation);
    const date = clinicalDateView(observation);
    const display = getObservationDisplayValue(observation);
    const valueLabel = display
        ? `${display.value}${display.unit ? ` ${display.unit}` : ''}`
        : observationValueLabel(observation.value);
    const originalValueLabel = observationValueLabel(observation.value);
    const normalizedValueLabel = observationNormalizedLabel(observation);
    const interpretationLabels = conceptTexts(observation.interpretation);
    const categoryLabels = conceptTexts(observation.category);
    const laboratory = observationIsLaboratory(observation);
    const references = referenceRangeText(observation);
    const flagged = interpretationIsFlagged(interpretationLabels);
    const searchText = [
        observation.code.text,
        observation.status,
        ...categoryLabels,
        valueLabel,
        originalValueLabel,
        normalizedValueLabel,
        observation.value?.type === 'quantity'
            ? observation.value.quantity.normalizationWarning
            : '',
        ...interpretationLabels,
        ...references.map(range => range.text),
        observation.issuedAt,
        ...(observation.performer || []),
        observation.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: observation.id,
        name: observation.code.text,
        status: observation.status,
        statusLabel: humanizeToken(observation.status),
        categoryLabels,
        laboratory,
        valueLabel,
        originalValueLabel,
        ...(normalizedValueLabel
            ? { normalizedValueLabel }
            : {}),
        ...(observation.value?.type === 'quantity'
            && observation.value.quantity.normalizationWarning
            ? {
                normalizationWarning:
                    observation.value.quantity.normalizationWarning,
            }
            : {}),
        interpretationLabels,
        flagged,
        referenceRanges: references,
        clinicalDateLabel: date.label,
        knownClinicalDate: date.known,
        issuedLabel: observation.issuedAt
            ? formatDateTime(observation.issuedAt)
            : 'Unknown',
        performer: observation.performer || [],
        ...(observation.note ? { note: observation.note } : {}),
        ...(observation.diagnosticReportId
            ? { diagnosticReportId: observation.diagnosticReportId }
            : {}),
        ...(observation.specimenId
            ? { specimenId: observation.specimenId }
            : {}),
        provenance,
        searchText,
        sortTimestamp: date.sortTimestamp,
    };
};

const reportItem = (
    report: DiagnosticReportRecord,
    observations: ObservationResultItem[],
): DiagnosticReportModuleItem => {
    const provenance = buildResourceProvenanceView(report);
    const date = clinicalDateView(report);
    const linkedResults = observations.filter(observation =>
        report.resultIds.includes(observation.id)
        || observation.diagnosticReportId === report.id);
    const categoryLabels = conceptTexts(report.category);
    const conclusionCodes = conceptTexts(report.conclusionCodes);
    const searchText = [
        report.code.text,
        report.status,
        ...categoryLabels,
        report.conclusion,
        ...conclusionCodes,
        ...(report.performer || []),
        ...linkedResults.flatMap(result => [
            result.name,
            result.valueLabel,
            ...result.interpretationLabels,
        ]),
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: report.id,
        name: report.code.text,
        status: report.status,
        statusLabel: humanizeToken(report.status),
        categoryLabels,
        clinicalDateLabel: date.label,
        knownClinicalDate: date.known,
        issuedLabel: report.issuedAt
            ? formatDateTime(report.issuedAt)
            : 'Unknown',
        ...(report.conclusion ? { conclusion: report.conclusion } : {}),
        conclusionCodes,
        performer: report.performer || [],
        resultCount: report.resultIds.length,
        specimenCount: report.specimenIds.length,
        documentCount: report.documentIds.length,
        linkedResults: linkedResults.slice(0, 8).map(result => ({
            id: result.id,
            name: result.name,
            valueLabel: result.valueLabel,
            flagged: result.flagged,
        })),
        provenance,
        searchText,
        sortTimestamp: date.sortTimestamp,
    };
};

export const buildResultsModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        content?: ResultsContentFilter;
        interpretation?: ResultsInterpretationFilter;
        category?: string;
    } = {},
): ResultsModuleViewModel => {
    const confirmed = selectConfirmedResources(record);
    const allObservations = confirmed
        .filter((resource): resource is ObservationRecord =>
            resource.resourceType === 'Observation')
        .map(observationItem);
    const allReports = confirmed
        .filter((resource): resource is DiagnosticReportRecord =>
            resource.resourceType === 'DiagnosticReport')
        .map(report => reportItem(report, allObservations));
    const content = options.content || 'all';
    const interpretation = options.interpretation || 'all';
    const category = options.category || 'all';

    const reports = (content === 'all' || content === 'reports'
        ? allReports
        : [])
        .filter(item => category === 'all'
            || item.categoryLabels.some(value => lower(value) === lower(category)))
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.name.localeCompare(right.name);
        });

    const observations = (content === 'reports'
        ? []
        : allObservations)
        .filter(item => content === 'all'
            || (content === 'laboratory'
                ? item.laboratory
                : !item.laboratory))
        .filter(item => interpretation === 'all'
            || (interpretation === 'flagged' ? item.flagged : !item.flagged))
        .filter(item => category === 'all'
            || item.categoryLabels.some(value => lower(value) === lower(category)))
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.name.localeCompare(right.name);
        });

    return {
        reports,
        observations,
        totalConfirmed: allReports.length + allObservations.length,
        reportCount: allReports.length,
        laboratoryCount: allObservations.filter(item => item.laboratory).length,
        otherObservationCount: allObservations.filter(item =>
            !item.laboratory).length,
        flaggedCount: allObservations.filter(item => item.flagged).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Observation'
            || resource.resourceType === 'DiagnosticReport').length,
        categoryOptions: unique([
            ...allReports.flatMap(item => item.categoryLabels),
            ...allObservations.flatMap(item => item.categoryLabels),
        ]),
    };
};

export const clinicalDateOrUnknown = (date?: ClinicalDate): string =>
    date ? formatClinicalDate(date) : 'Unknown';
