import type {
    DiagnosticReportRecord,
    ObservationRecord,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../clinical-record';

export type DiagnosticPanelFamily =
    | 'complete-blood-count'
    | 'renal'
    | 'liver'
    | 'thyroid'
    | 'lipid'
    | 'unclassified';

export interface DiagnosticPanelFamilySuggestion {
    family: DiagnosticPanelFamily;
    label: string;
    matchedMarkers: string[];
    evidence: 'member-set' | 'insufficient-member-evidence';
}

export interface DiagnosticPanelMember {
    observationId: string;
    name: string;
    loincCode?: string;
    valueKind: 'quantity' | 'qualitative' | 'text' | 'other' | 'missing';
    specimenId?: string;
    source?: SourceDocumentReference;
}

export interface DiagnosticPanelGroup {
    reportId: string;
    reportName: string;
    status: DiagnosticReportRecord['status'];
    groupingBasis: 'DiagnosticReport.resultIds';
    source?: SourceDocumentReference;
    familySuggestion: DiagnosticPanelFamilySuggestion;
    members: DiagnosticPanelMember[];
    missingResultIds: string[];
}

interface PanelRule {
    family: Exclude<DiagnosticPanelFamily, 'unclassified'>;
    label: string;
    minimumMarkers: number;
    markers: Record<string, string[]>;
}

const normalize = (value?: string): string => (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const PANEL_RULES: PanelRule[] = [
    {
        family: 'complete-blood-count',
        label: 'Complete blood count pattern',
        minimumMarkers: 3,
        markers: {
            hemoglobin: ['hemoglobin', 'haemoglobin', 'hgb'],
            hematocrit: ['hematocrit', 'haematocrit', 'hct'],
            leukocytes: [
                'white blood cell count',
                'white blood cells',
                'wbc',
                'leukocyte count',
                'leucocyte count',
            ],
            erythrocytes: [
                'red blood cell count',
                'red blood cells',
                'rbc',
                'erythrocyte count',
            ],
            platelets: ['platelet count', 'platelets', 'plt'],
            mcv: ['mean corpuscular volume', 'mcv'],
            mch: ['mean corpuscular hemoglobin', 'mch'],
            mchc: ['mean corpuscular hemoglobin concentration', 'mchc'],
        },
    },
    {
        family: 'renal',
        label: 'Renal function pattern',
        minimumMarkers: 2,
        markers: {
            creatinine: ['creatinine', 'serum creatinine'],
            urea: ['urea', 'blood urea nitrogen', 'bun'],
            egfr: [
                'estimated glomerular filtration rate',
                'egfr',
                'glomerular filtration rate',
            ],
            sodium: ['sodium', 'na'],
            potassium: ['potassium', 'k'],
            bicarbonate: ['bicarbonate', 'total co2', 'carbon dioxide'],
        },
    },
    {
        family: 'liver',
        label: 'Liver chemistry pattern',
        minimumMarkers: 3,
        markers: {
            alt: ['alanine aminotransferase', 'alt', 'sgpt'],
            ast: ['aspartate aminotransferase', 'ast', 'sgot'],
            alp: ['alkaline phosphatase', 'alp'],
            bilirubin: ['bilirubin', 'total bilirubin', 'direct bilirubin'],
            albumin: ['albumin'],
            protein: ['total protein', 'protein total'],
            ggt: ['gamma glutamyl transferase', 'ggt'],
        },
    },
    {
        family: 'thyroid',
        label: 'Thyroid function pattern',
        minimumMarkers: 2,
        markers: {
            tsh: ['thyroid stimulating hormone', 'tsh'],
            freeT4: ['free thyroxine', 'free t4', 'ft4'],
            freeT3: ['free triiodothyronine', 'free t3', 'ft3'],
            totalT4: ['total thyroxine', 'total t4'],
            totalT3: ['total triiodothyronine', 'total t3'],
        },
    },
    {
        family: 'lipid',
        label: 'Lipid profile pattern',
        minimumMarkers: 3,
        markers: {
            totalCholesterol: ['total cholesterol', 'cholesterol total'],
            ldl: ['ldl cholesterol', 'low density lipoprotein', 'ldl'],
            hdl: ['hdl cholesterol', 'high density lipoprotein', 'hdl'],
            triglycerides: ['triglycerides', 'triglyceride'],
            nonHdl: ['non hdl cholesterol', 'non hdl'],
        },
    },
];

const matchesAlias = (name: string, alias: string): boolean => {
    const normalizedAlias = normalize(alias);
    if (!normalizedAlias) return false;
    if (name === normalizedAlias) return true;
    if (normalizedAlias.length <= 3) {
        return name.split(' ').includes(normalizedAlias);
    }
    return name.includes(normalizedAlias);
};

const markerMatches = (
    observations: ObservationRecord[],
    rule: PanelRule,
): string[] => {
    const names = observations.map(observation => normalize(observation.code.text));
    return Object.entries(rule.markers)
        .filter(([, aliases]) => names.some(name =>
            aliases.some(alias => matchesAlias(name, alias))))
        .map(([marker]) => marker);
};

export const suggestDiagnosticPanelFamily = (
    observations: ObservationRecord[],
): DiagnosticPanelFamilySuggestion => {
    const candidates = PANEL_RULES.map(rule => ({
        rule,
        matchedMarkers: markerMatches(observations, rule),
    })).filter(candidate =>
        candidate.matchedMarkers.length >= candidate.rule.minimumMarkers)
        .sort((left, right) => {
            if (left.matchedMarkers.length !== right.matchedMarkers.length) {
                return right.matchedMarkers.length - left.matchedMarkers.length;
            }
            return right.rule.minimumMarkers - left.rule.minimumMarkers;
        });

    if (candidates.length === 0) {
        return {
            family: 'unclassified',
            label: 'Report-defined result group',
            matchedMarkers: [],
            evidence: 'insufficient-member-evidence',
        };
    }
    if (
        candidates.length > 1
        && candidates[0].matchedMarkers.length
            === candidates[1].matchedMarkers.length
    ) {
        return {
            family: 'unclassified',
            label: 'Report-defined result group',
            matchedMarkers: [],
            evidence: 'insufficient-member-evidence',
        };
    }

    const selected = candidates[0];
    return {
        family: selected.rule.family,
        label: selected.rule.label,
        matchedMarkers: selected.matchedMarkers,
        evidence: 'member-set',
    };
};

const loincCode = (observation: ObservationRecord): string | undefined =>
    observation.code.coding?.find(coding =>
        coding.system?.replace(/\/$/, '') === 'http://loinc.org')?.code;

const valueKind = (
    observation: ObservationRecord,
): DiagnosticPanelMember['valueKind'] => {
    if (!observation.value) return 'missing';
    if (observation.value.type === 'quantity') return 'quantity';
    if (observation.value.type === 'codeable-concept') return 'qualitative';
    if (observation.value.type === 'string') return 'text';
    return 'other';
};

export const buildDiagnosticPanelGroups = (
    record: PatientClinicalRecord,
): DiagnosticPanelGroup[] => {
    const observations = new Map(
        record.resources.observations
            .filter(observation => observation.verificationStatus === 'confirmed')
            .map(observation => [observation.id, observation]),
    );

    return record.resources.diagnosticReports
        .filter(report => report.verificationStatus === 'confirmed')
        .map(report => {
            const members = report.resultIds
                .map(id => observations.get(id))
                .filter((value): value is ObservationRecord => Boolean(value));
            const missingResultIds = report.resultIds.filter(id =>
                !observations.has(id));
            return {
                reportId: report.id,
                reportName: report.code.text,
                status: report.status,
                groupingBasis: 'DiagnosticReport.resultIds' as const,
                ...(report.provenance.source.document
                    ? { source: report.provenance.source.document }
                    : {}),
                familySuggestion: suggestDiagnosticPanelFamily(members),
                members: members.map(observation => ({
                    observationId: observation.id,
                    name: observation.code.text,
                    ...(loincCode(observation)
                        ? { loincCode: loincCode(observation) }
                        : {}),
                    valueKind: valueKind(observation),
                    ...(observation.specimenId
                        ? { specimenId: observation.specimenId }
                        : {}),
                    ...(observation.provenance.source.document
                        ? { source: observation.provenance.source.document }
                        : {}),
                })),
                missingResultIds,
            };
        })
        .sort((left, right) => left.reportName.localeCompare(right.reportName));
};
