import type { LabReport } from '../chat/schemas';
import type {
    ReviewedDiagnosticReportDraft,
    ReviewedObservationDraft,
} from './types';

const clean = (value?: string | null): string | undefined => {
    const normalized = (value || '').trim();
    return normalized || undefined;
};

const resultLocalId = (index: number, testName: string): string => {
    const slug = testName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return `extracted-result-${index + 1}${slug ? `-${slug}` : ''}`;
};

export interface LegacyLabReviewSource {
    documentId?: string;
    fileName?: string;
}

export interface LegacyLabReviewSeed {
    draft: ReviewedDiagnosticReportDraft;
    sourceAvailable: boolean;
    sourceWarning?: string;
}

/**
 * Convert the narrow legacy AI lab-report JSON into the Phase 4 reviewed-draft
 * boundary. No clinical fact is confirmed here. The returned report defaults
 * to unknown status, and result dates inherit only the report-level source date
 * when the reviewer leaves them omitted.
 */
export const createLegacyLabReviewSeed = ({
    report,
    patientId,
    source,
}: {
    report: LabReport;
    patientId: string;
    source: LegacyLabReviewSource;
}): LegacyLabReviewSeed => {
    const sourceAvailable = Boolean(source.documentId);
    const sourceDocumentId = source.documentId
        || 'missing-source-document';
    const results: ReviewedObservationDraft[] = report.labs.map((lab, index) => ({
        localId: resultLocalId(index, lab.testName),
        testName: lab.testName.trim(),
        ...(clean(lab.loinc) ? { loincCode: clean(lab.loinc) } : {}),
        status: 'unknown',
        categoryTexts: ['Laboratory'],
        valueText: String(lab.value),
        ...(clean(lab.units) ? { unitText: clean(lab.units) } : {}),
        ...(clean(lab.refRange)
            ? { referenceRangeText: clean(lab.refRange) }
            : {}),
        ...(lab.flag && lab.flag !== 'Normal'
            ? { interpretationText: lab.flag }
            : {}),
        source: {},
    }));

    return {
        sourceAvailable,
        ...(sourceAvailable
            ? {}
            : {
                sourceWarning:
                    'This extracted lab response is not linked to an uploaded source document. Confirming it is blocked until the original report is available.',
            }),
        draft: {
            patientId,
            reportTitle: 'Laboratory report',
            status: 'unknown',
            categoryTexts: ['Laboratory'],
            effectiveDate: report.date?.trim() || null,
            performer: [],
            ...(clean(report.interpretation)
                ? { conclusion: clean(report.interpretation) }
                : {}),
            specimens: [],
            results,
            source: {
                documentId: sourceDocumentId,
                ...(clean(source.fileName)
                    ? { fileName: clean(source.fileName) }
                    : {}),
            },
            verificationStatus: 'candidate',
        },
    };
};
