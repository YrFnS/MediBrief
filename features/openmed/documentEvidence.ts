import type { ClinicalRecordResource } from '../clinical-record/types';
import type {
    OpenMedDocumentEntityEvidence,
    OpenMedDocumentExtractionResponse,
    OpenMedDocumentSourceSpan,
} from './documentTypes';
import type { OpenMedCandidateEntity } from './types';

const overlaps = (
    leftStart: number,
    leftEnd: number,
    rightStart: number,
    rightEnd: number,
): boolean => leftEnd > rightStart && leftStart < rightEnd;

const unionBbox = (
    spans: OpenMedDocumentSourceSpan[],
): [number, number, number, number] | undefined => {
    const boxes = spans.flatMap(span => span.bbox ? [span.bbox] : []);
    if (boxes.length === 0) return undefined;
    return [
        Math.min(...boxes.map(box => box[0])),
        Math.min(...boxes.map(box => box[1])),
        Math.max(...boxes.map(box => box[2])),
        Math.max(...boxes.map(box => box[3])),
    ];
};

export const buildOpenMedDocumentEvidence = ({
    extraction,
    start,
    end,
}: {
    extraction: OpenMedDocumentExtractionResponse;
    start: number;
    end: number;
}): OpenMedDocumentEntityEvidence => {
    const covered = extraction.sourceSpans.filter(span =>
        overlaps(span.start, span.end, start, end));
    const containingPage = extraction.pages.find(page =>
        start >= page.start && end <= page.end);
    const pageNumbers = [
        ...new Set([
            ...covered.map(span => span.pageNumber),
            ...(containingPage ? [containingPage.pageNumber] : []),
        ]),
    ].sort((left, right) => left - right);
    const singlePage = pageNumbers.length === 1 ? pageNumbers[0] : undefined;
    const samePageSpans = singlePage === undefined
        ? []
        : covered.filter(span => span.pageNumber === singlePage);
    const confidences = samePageSpans.flatMap(span =>
        span.confidence === undefined ? [] : [span.confidence]);
    const page = singlePage === undefined
        ? undefined
        : extraction.pages.find(item => item.pageNumber === singlePage);

    return {
        documentId: extraction.documentId,
        fileName: extraction.fileName,
        mimeType: extraction.mimeType,
        sourceSha256: extraction.sourceSha256,
        textSha256: extraction.textSha256,
        method: page?.method || extraction.method,
        ...(singlePage !== undefined ? { pageNumber: singlePage } : {}),
        pageNumbers,
        ...(samePageSpans.length > 0
            ? { bbox: unionBbox(samePageSpans) }
            : {}),
        ...(confidences.length > 0
            ? {
                averageOcrConfidence:
                    confidences.reduce((sum, value) => sum + value, 0)
                    / confidences.length,
            }
            : {}),
        ocrEngine: extraction.ocrEngine,
        languages: extraction.languages,
        engine: extraction.engine,
        bridgeVersion: extraction.bridgeVersion,
        extractedAt: extraction.extractedAt,
    };
};

export const attachOpenMedDocumentEvidence = ({
    entities,
    extraction,
}: {
    entities: OpenMedCandidateEntity[];
    extraction: OpenMedDocumentExtractionResponse;
}): OpenMedCandidateEntity[] => entities.map(entity => ({
    ...entity,
    documentEvidence: buildOpenMedDocumentEvidence({
        extraction,
        start: entity.start,
        end: entity.end,
    }),
}));

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isDocumentEvidence = (
    value: unknown,
): value is OpenMedDocumentEntityEvidence => {
    if (!isObject(value)) return false;
    return typeof value.documentId === 'string'
        && typeof value.fileName === 'string'
        && typeof value.mimeType === 'string'
        && typeof value.sourceSha256 === 'string'
        && typeof value.textSha256 === 'string'
        && typeof value.method === 'string'
        && Array.isArray(value.pageNumbers)
        && typeof value.ocrEngine === 'string'
        && Array.isArray(value.languages)
        && typeof value.engine === 'string'
        && typeof value.bridgeVersion === 'string'
        && typeof value.extractedAt === 'string';
};

export const getOpenMedDocumentEvidence = (
    resource: ClinicalRecordResource,
): OpenMedDocumentEntityEvidence | null => {
    for (const amendment of [...resource.amendments].reverse()) {
        const evidence = amendment.previousValues?.openMedDocumentEvidence;
        if (isDocumentEvidence(evidence)) return evidence;
    }
    return null;
};
