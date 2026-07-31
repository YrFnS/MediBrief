import { z } from 'zod';
import type { ReviewedDiagnosticReportDraft } from './types';

const optionalTrimmed = z.string().trim().min(1).optional();
const nullableTrimmed = z.string().trim().min(1).nullable().optional();

// `undefined` means that a result may inherit report-level context. Explicit
// `null` means the reviewer identified the field as unknown, so it must survive
// parsing as an explicit unknown marker rather than falling through `??` to a
// report date or issue timestamp.
const nullableDateText = z.string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform(value => value === null ? 'unknown' : value);

const IdentifierSchema = z.object({
    value: z.string().trim().min(1),
    system: optionalTrimmed,
    type: optionalTrimmed,
}).strict();

const SourceObjectSchema = z.object({
    documentId: z.string().trim().min(1),
    fileName: optionalTrimmed,
    pageNumber: z.number().int().positive().optional(),
    section: optionalTrimmed,
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    excerpt: optionalTrimmed,
}).strict();

const validateSourceOffsets = (
    source: {
        startOffset?: number;
        endOffset?: number;
    },
    context: z.RefinementCtx,
): void => {
    if (
        source.startOffset !== undefined
        && source.endOffset !== undefined
        && source.endOffset < source.startOffset
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endOffset'],
            message: 'endOffset must be greater than or equal to startOffset',
        });
    }
};

const SourceSchema = SourceObjectSchema.superRefine(validateSourceOffsets);

const PartialSourceSchema = SourceObjectSchema
    .omit({ documentId: true })
    .partial()
    .superRefine(validateSourceOffsets);

const SpecimenDraftSchema = z.object({
    localId: z.string().trim().min(1),
    status: z.enum([
        'available',
        'unavailable',
        'unsatisfactory',
        'entered-in-error',
        'unknown',
    ]).optional(),
    typeText: optionalTrimmed,
    collectedDate: nullableDateText,
    receivedDate: nullableDateText,
    bodySiteText: optionalTrimmed,
    collectionMethodText: optionalTrimmed,
    collector: optionalTrimmed,
    identifiers: z.array(IdentifierSchema).optional(),
    note: optionalTrimmed,
}).strict();

const ObservationDraftSchema = z.object({
    localId: z.string().trim().min(1),
    testName: z.string().trim().min(1),
    loincCode: optionalTrimmed,
    status: z.enum([
        'registered',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ]).optional(),
    categoryTexts: z.array(z.string().trim().min(1)).optional(),
    valueText: nullableTrimmed,
    unitText: nullableTrimmed,
    referenceRangeText: nullableTrimmed,
    interpretationText: nullableTrimmed,
    absentReasonText: nullableTrimmed,
    clinicalDate: nullableDateText,
    issuedAt: nullableDateText,
    performer: z.array(z.string().trim().min(1)).optional(),
    specimenLocalId: optionalTrimmed,
    methodText: optionalTrimmed,
    bodySiteText: optionalTrimmed,
    note: optionalTrimmed,
    source: PartialSourceSchema.optional(),
}).strict().superRefine((result, context) => {
    const hasValue = Boolean(result.valueText?.trim());
    const hasAbsentReason = Boolean(result.absentReasonText?.trim());
    if (!hasValue && !hasAbsentReason) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['valueText'],
            message: 'A result requires valueText or absentReasonText',
        });
    }
});

export const ReviewedDiagnosticReportDraftSchema = z.object({
    patientId: z.string().trim().min(1),
    reportTitle: z.string().trim().min(1),
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
    ]).optional(),
    categoryTexts: z.array(z.string().trim().min(1)).optional(),
    effectiveDate: nullableDateText,
    issuedAt: nullableDateText,
    performer: z.array(z.string().trim().min(1)).optional(),
    conclusion: optionalTrimmed,
    identifiers: z.array(IdentifierSchema).optional(),
    accessionIdentifier: IdentifierSchema.optional(),
    specimens: z.array(SpecimenDraftSchema).optional(),
    results: z.array(ObservationDraftSchema).min(1),
    source: SourceSchema,
    verificationStatus: z.enum(['candidate', 'confirmed']).optional(),
    reviewedAt: optionalTrimmed,
    reviewedBy: optionalTrimmed,
}).strict().superRefine((draft, context) => {
    const specimenIds = (draft.specimens || []).map(specimen => specimen.localId);
    if (new Set(specimenIds).size !== specimenIds.length) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['specimens'],
            message: 'Specimen localId values must be unique',
        });
    }

    const resultIds = draft.results.map(result => result.localId);
    if (new Set(resultIds).size !== resultIds.length) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['results'],
            message: 'Result localId values must be unique',
        });
    }

    const knownSpecimens = new Set(specimenIds);
    draft.results.forEach((result, index) => {
        if (
            result.specimenLocalId
            && !knownSpecimens.has(result.specimenLocalId)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['results', index, 'specimenLocalId'],
                message: `Unknown specimenLocalId: ${result.specimenLocalId}`,
            });
        }
    });
});

export const parseReviewedDiagnosticReportDraft = (
    input: unknown,
): ReviewedDiagnosticReportDraft =>
    ReviewedDiagnosticReportDraftSchema.parse(input) as ReviewedDiagnosticReportDraft;
