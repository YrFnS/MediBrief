import { z } from 'zod';
import {
    ClinicalCodeableConceptSchema,
    ClinicalDateSchema,
    ClinicalPeriodSchema,
    ClinicalQuantityValueSchema,
    IsoDateTimeSchema,
    ObservationReferenceRangeSchema,
    SourceDocumentReferenceSchema,
} from '../clinical-record';
import { DIAGNOSTIC_REPORT_DRAFT_SCHEMA_VERSION } from './types';
import type {
    DiagnosticReportDraft,
    DiagnosticReportGraphIssue,
} from './types';

const nonEmptyOptional = z.string().min(1).optional();

export const DiagnosticResultValueDraftSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('quantity'),
        rawText: z.string().trim().min(1),
        value: z.number().finite(),
        unit: nonEmptyOptional,
        comparator: z.enum(['<', '<=', '>=', '>']).optional(),
        normalized: ClinicalQuantityValueSchema.optional(),
        normalizationWarning: nonEmptyOptional,
    }).strict(),
    z.object({
        type: z.literal('string'),
        text: z.string().min(1),
    }).strict(),
    z.object({
        type: z.literal('boolean'),
        value: z.boolean(),
        sourceText: nonEmptyOptional,
    }).strict(),
    z.object({
        type: z.literal('integer'),
        value: z.number().int(),
        sourceText: nonEmptyOptional,
    }).strict(),
    z.object({
        type: z.literal('codeable-concept'),
        concept: ClinicalCodeableConceptSchema,
        sourceText: nonEmptyOptional,
    }).strict(),
]);

export const DiagnosticReferenceRangeDraftSchema = ObservationReferenceRangeSchema
    .extend({
        sourceText: nonEmptyOptional,
    })
    .strict()
    .superRefine((range, ctx) => {
        if (!range.low && !range.high && !range.text && !range.sourceText) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'A reference range requires a bound or source text.',
            });
        }
        if (
            range.low
            && range.high
            && range.low.comparator === undefined
            && range.high.comparator === undefined
            && (range.low.unit || '') === (range.high.unit || '')
            && range.low.value > range.high.value
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['high', 'value'],
                message: 'Reference-range high value must not be below the low value.',
            });
        }
    });

export const DiagnosticSpecimenDraftSchema = z.object({
    localId: z.string().trim().min(1),
    status: z.enum([
        'available',
        'unavailable',
        'unsatisfactory',
        'entered-in-error',
        'unknown',
    ]),
    type: ClinicalCodeableConceptSchema.optional(),
    collectedAt: ClinicalDateSchema.optional(),
    receivedAt: ClinicalDateSchema.optional(),
    bodySite: ClinicalCodeableConceptSchema.optional(),
    collectionMethod: ClinicalCodeableConceptSchema.optional(),
    note: z.string().optional(),
    source: SourceDocumentReferenceSchema.optional(),
}).strict();

export const DiagnosticResultDraftSchema = z.object({
    localId: z.string().trim().min(1),
    status: z.enum([
        'registered',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ]),
    code: ClinicalCodeableConceptSchema,
    category: z.array(ClinicalCodeableConceptSchema).optional(),
    value: DiagnosticResultValueDraftSchema,
    interpretation: z.array(ClinicalCodeableConceptSchema).optional(),
    referenceRanges: z.array(DiagnosticReferenceRangeDraftSchema),
    specimenLocalId: nonEmptyOptional,
    effective: ClinicalDateSchema.optional(),
    issuedAt: IsoDateTimeSchema.optional(),
    performer: z.array(z.string().min(1)).optional(),
    note: z.string().optional(),
    source: SourceDocumentReferenceSchema.optional(),
}).strict();

const comparableDate = (value: unknown): string | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const date = value as { value?: unknown; precision?: unknown };
    return typeof date.value === 'string' && date.precision !== 'unknown'
        ? date.value
        : undefined;
};

export const DiagnosticReportDraftSchema = z.object({
    schemaVersion: z.literal(DIAGNOSTIC_REPORT_DRAFT_SCHEMA_VERSION),
    draftId: z.string().trim().min(1),
    patientId: z.string().trim().min(1),
    documentId: z.string().trim().min(1),
    fileName: nonEmptyOptional,
    status: z.enum([
        'registered',
        'partial',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ]),
    code: ClinicalCodeableConceptSchema,
    category: z.array(ClinicalCodeableConceptSchema).optional(),
    effectivePeriod: ClinicalPeriodSchema.optional(),
    issuedAt: IsoDateTimeSchema.optional(),
    conclusion: z.string().optional(),
    conclusionCodes: z.array(ClinicalCodeableConceptSchema).optional(),
    encounterId: nonEmptyOptional,
    performer: z.array(z.string().min(1)).optional(),
    reportSource: SourceDocumentReferenceSchema.optional(),
    specimens: z.array(DiagnosticSpecimenDraftSchema),
    results: z.array(DiagnosticResultDraftSchema).min(1),
    extraction: z.object({
        engine: z.string().min(1),
        model: nonEmptyOptional,
        engineVersion: nonEmptyOptional,
        confidence: z.number().min(0).max(1).optional(),
        extractedAt: IsoDateTimeSchema,
    }).strict().optional(),
}).strict().superRefine((draft, ctx) => {
    const specimenIds = new Set<string>();
    draft.specimens.forEach((specimen, index) => {
        if (specimenIds.has(specimen.localId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['specimens', index, 'localId'],
                message: 'Specimen local IDs must be unique within a report draft.',
            });
        }
        specimenIds.add(specimen.localId);
        if (
            specimen.source
            && specimen.source.documentId !== draft.documentId
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['specimens', index, 'source', 'documentId'],
                message: 'Specimen source must reference the report document.',
            });
        }
    });

    const resultIds = new Set<string>();
    draft.results.forEach((result, index) => {
        if (resultIds.has(result.localId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['results', index, 'localId'],
                message: 'Result local IDs must be unique within a report draft.',
            });
        }
        resultIds.add(result.localId);
        if (
            result.specimenLocalId
            && !specimenIds.has(result.specimenLocalId)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['results', index, 'specimenLocalId'],
                message: 'Result references an unknown specimen local ID.',
            });
        }
        if (result.source && result.source.documentId !== draft.documentId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['results', index, 'source', 'documentId'],
                message: 'Result source must reference the report document.',
            });
        }
    });

    if (
        draft.reportSource
        && draft.reportSource.documentId !== draft.documentId
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['reportSource', 'documentId'],
            message: 'Report source must reference documentId.',
        });
    }

    const start = comparableDate(draft.effectivePeriod?.start);
    const end = comparableDate(draft.effectivePeriod?.end);
    if (start && end && start.length === end.length && start > end) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['effectivePeriod', 'end'],
            message: 'Report period end must not precede its start.',
        });
    }
});

export const parseDiagnosticReportDraft = (
    value: unknown,
): DiagnosticReportDraft => DiagnosticReportDraftSchema.parse(value);

export const validateDiagnosticReportDraft = (
    value: unknown,
): {
    ok: boolean;
    draft?: DiagnosticReportDraft;
    issues: DiagnosticReportGraphIssue[];
} => {
    const result = DiagnosticReportDraftSchema.safeParse(value);
    if (result.success) {
        return { ok: true, draft: result.data, issues: [] };
    }
    return {
        ok: false,
        issues: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
        })),
    };
};
