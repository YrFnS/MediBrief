import { normalizeValue } from '../fhir/unitService';
import type { LabReport } from '../chat/schemas';
import type {
    ClinicalDate,
    ClinicalQuantityValue,
    SourceDocumentReference,
} from '../clinical-record';
import type {
    DiagnosticReferenceRangeDraft,
    DiagnosticReportDraft,
    DiagnosticResultComparator,
    DiagnosticResultValueDraft,
} from './types';

export interface PendingLabSource {
    documentId: string;
    fileName: string;
    storageId?: string;
    mimeType?: string;
}

export interface ReviewedLabRow extends LabReport['labs'][number] {
    pageNumber?: number;
    effectiveDate?: string;
    sourceExcerpt?: string;
}

export interface ReviewedLabReport {
    reportTitle: string;
    reportDate?: string;
    issuedAt?: string;
    performer?: string;
    specimenType?: string;
    collectionDate?: string;
    rows: ReviewedLabRow[];
    interpretation?: string;
}

export interface BuildReviewedLabDraftInput {
    patientId: string;
    source: PendingLabSource;
    review: ReviewedLabReport;
    extractedReport?: LabReport;
    extractedAt?: string;
    extractionEngine?: string;
    extractionModel?: string;
}

const normalizedIdentity = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    || 'report';

export const parseReviewedReportDate = (
    input?: string,
): ClinicalDate => {
    const sourceText = input?.trim();
    if (!sourceText) {
        return {
            value: null,
            precision: 'unknown',
            sourceText: 'No date was provided during report review.',
        };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(sourceText)) {
        return { value: sourceText, precision: 'day', sourceText };
    }
    if (/^\d{4}-\d{2}$/.test(sourceText)) {
        return { value: sourceText, precision: 'month', sourceText };
    }
    if (/^\d{4}$/.test(sourceText)) {
        return { value: sourceText, precision: 'year', sourceText };
    }
    return {
        value: null,
        precision: 'unknown',
        sourceText,
    };
};

const numericValue = (
    rawText: string,
): {
    value: number;
    comparator?: DiagnosticResultComparator;
} | undefined => {
    const match = rawText.trim().replace(/,/g, '').match(
        /^(<=|>=|<|>)?\s*(-?(?:\d+(?:\.\d+)?|\.\d+))$/,
    );
    if (!match) return undefined;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) return undefined;
    return {
        value,
        ...(match[1]
            ? { comparator: match[1] as DiagnosticResultComparator }
            : {}),
    };
};

const normalizedQuantity = (
    value: number,
    unit: string,
    testName: string,
    loinc?: string,
): {
    normalized?: ClinicalQuantityValue;
    warning?: string;
} => {
    const normalized = normalizeValue(value, unit, testName, loinc);
    if (!unit.trim() || !normalized.unit) {
        return normalized.warning ? { warning: normalized.warning } : {};
    }
    return {
        normalized: {
            value: normalized.value,
            unit: normalized.unit,
            system: 'http://unitsofmeasure.org',
            code: normalized.unit,
        },
        ...(normalized.warning ? { warning: normalized.warning } : {}),
    };
};

export const reviewedLabValue = (
    row: ReviewedLabRow,
): DiagnosticResultValueDraft => {
    const rawText = String(row.value).trim();
    const numeric = numericValue(rawText);
    if (!numeric) {
        return {
            type: 'string',
            text: rawText || 'Value not recorded',
        };
    }
    const unit = String(row.units || '').trim();
    const normalized = normalizedQuantity(
        numeric.value,
        unit,
        row.testName,
        row.loinc,
    );
    return {
        type: 'quantity',
        rawText,
        value: numeric.value,
        ...(unit ? { unit } : {}),
        ...(numeric.comparator ? { comparator: numeric.comparator } : {}),
        ...(normalized.normalized
            ? { normalized: normalized.normalized }
            : {}),
        ...(normalized.warning
            ? { normalizationWarning: normalized.warning }
            : {}),
    };
};

const rangeBound = (
    value: string,
    unit: string,
    comparator?: DiagnosticResultComparator,
): ClinicalQuantityValue | undefined => {
    const parsed = Number(value.replace(/,/g, ''));
    if (!Number.isFinite(parsed)) return undefined;
    return {
        value: parsed,
        ...(unit ? { unit } : {}),
        ...(comparator ? { comparator } : {}),
    };
};

export const reviewedReferenceRange = (
    row: ReviewedLabRow,
): DiagnosticReferenceRangeDraft[] => {
    const sourceText = String(row.refRange || '').trim();
    if (!sourceText) return [];
    const unit = String(row.units || '').trim();
    const bounded = sourceText.match(
        /^\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*[-–—]\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(.*)$/,
    );
    if (bounded) {
        const rangeUnit = bounded[3].trim() || unit;
        const low = rangeBound(bounded[1], rangeUnit);
        const high = rangeBound(bounded[2], rangeUnit);
        return [{
            ...(low ? { low } : {}),
            ...(high ? { high } : {}),
            text: sourceText,
            sourceText,
        }];
    }
    const comparator = sourceText.match(
        /^\s*(<=|>=|<|>)\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(.*)$/,
    );
    if (comparator) {
        const token = comparator[1] as DiagnosticResultComparator;
        const rangeUnit = comparator[3].trim() || unit;
        const bound = rangeBound(comparator[2], rangeUnit, token);
        return [{
            ...(token === '<' || token === '<='
                ? { high: bound }
                : { low: bound }),
            text: sourceText,
            sourceText,
        }];
    }
    return [{ text: sourceText, sourceText }];
};

const sourceForRow = (
    source: PendingLabSource,
    row: ReviewedLabRow,
): SourceDocumentReference => ({
    documentId: source.documentId,
    fileName: source.fileName,
    ...(row.pageNumber && row.pageNumber > 0
        ? { pageNumber: row.pageNumber }
        : {}),
    excerpt: row.sourceExcerpt?.trim()
        || `${row.testName}: ${row.value}${row.units ? ` ${row.units}` : ''}`,
});

export const buildDiagnosticReportDraftFromReviewedLabs = ({
    patientId,
    source,
    review,
    extractedReport,
    extractedAt = new Date().toISOString(),
    extractionEngine = 'Google Gemini lab-report extraction',
    extractionModel,
}: BuildReviewedLabDraftInput): DiagnosticReportDraft => {
    const reportDate = parseReviewedReportDate(review.reportDate);
    const collectionDate = parseReviewedReportDate(review.collectionDate);
    const specimenEnabled = Boolean(
        review.specimenType?.trim()
        || review.collectionDate?.trim(),
    );
    const draftId = [
        'lab-report',
        normalizedIdentity(review.reportTitle),
        normalizedIdentity(review.reportDate || 'unknown-date'),
    ].join(':');

    return {
        schemaVersion: 1,
        draftId,
        patientId,
        documentId: source.documentId,
        fileName: source.fileName,
        status: 'final',
        code: { text: review.reportTitle.trim() || 'Laboratory report' },
        category: [{ text: 'Laboratory' }],
        effectivePeriod: {
            start: reportDate,
            end: reportDate,
        },
        ...(review.issuedAt?.trim()
            ? { issuedAt: review.issuedAt.trim() }
            : {}),
        ...(review.interpretation?.trim()
            ? { conclusion: review.interpretation.trim() }
            : extractedReport?.interpretation?.trim()
                ? { conclusion: extractedReport.interpretation.trim() }
                : {}),
        ...(review.performer?.trim()
            ? { performer: [review.performer.trim()] }
            : {}),
        reportSource: {
            documentId: source.documentId,
            fileName: source.fileName,
        },
        specimens: specimenEnabled
            ? [{
                localId: 'specimen-1',
                status: 'available',
                ...(review.specimenType?.trim()
                    ? { type: { text: review.specimenType.trim() } }
                    : {}),
                collectedAt: collectionDate,
                source: {
                    documentId: source.documentId,
                    fileName: source.fileName,
                    excerpt: [
                        review.specimenType?.trim(),
                        review.collectionDate?.trim(),
                    ].filter(Boolean).join(' · ') || 'Specimen details reviewed by user',
                },
            }]
            : [],
        results: review.rows.map((row, index) => ({
            localId: `result-${index + 1}-${normalizedIdentity(row.loinc || row.testName)}`,
            status: 'final',
            code: {
                text: row.testName.trim(),
                ...(row.loinc?.trim()
                    ? {
                        coding: [{
                            system: 'http://loinc.org',
                            code: row.loinc.trim(),
                        }],
                    }
                    : {}),
            },
            category: [{ text: 'Laboratory' }],
            value: reviewedLabValue(row),
            ...(row.flag && row.flag !== 'Normal'
                ? { interpretation: [{ text: row.flag }] }
                : {}),
            referenceRanges: reviewedReferenceRange(row),
            ...(specimenEnabled ? { specimenLocalId: 'specimen-1' } : {}),
            effective: row.effectiveDate?.trim()
                ? parseReviewedReportDate(row.effectiveDate)
                : reportDate,
            ...(review.performer?.trim()
                ? { performer: [review.performer.trim()] }
                : {}),
            source: sourceForRow(source, row),
        })),
        extraction: {
            engine: extractionEngine,
            ...(extractionModel ? { model: extractionModel } : {}),
            extractedAt,
        },
    };
};
