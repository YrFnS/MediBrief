import { z } from 'zod';
import type {
    OpenMedContextAssertion,
    OpenMedContextCue,
    OpenMedContextHealth,
    OpenMedContextRequestSpan,
    OpenMedContextResponse,
    OpenMedContextResult,
    OpenMedExperiencerEvidence,
    OpenMedMedicationSig,
    OpenMedSectionEvidence,
} from './contextTypes';

const IsoDateTimeSchema = z.string().min(1).refine(
    value => !Number.isNaN(Date.parse(value)),
    'Expected a valid date-time string',
);

const RawContextCueSchema = z.object({
    text: z.string().min(1),
    category: z.enum(['historical', 'hypothetical', 'uncertainty', 'negation']),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    direction: z.enum(['forward', 'backward']),
}).strict().refine(cue => cue.end > cue.start, {
    message: 'Context cue end must be greater than start',
});

const RawSectionSchema = z.object({
    label: z.string().min(1),
    canonical: z.string().min(1).optional(),
    header: z.string().min(1).optional(),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    header_start: z.number().int().nonnegative().optional(),
    header_end: z.number().int().positive().optional(),
    content_start: z.number().int().nonnegative().optional(),
    source: z.string().min(1).optional(),
}).strict().refine(section => section.end > section.start, {
    message: 'Section end must be greater than start',
});

const RawExperiencerEvidenceSchema = z.object({
    source: z.enum(['cue', 'section', 'default']),
    cue: z.string().min(1).optional(),
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().positive().optional(),
}).strict().superRefine((evidence, ctx) => {
    if (
        evidence.start !== undefined
        && evidence.end !== undefined
        && evidence.end <= evidence.start
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['end'],
            message: 'Experiencer cue end must be greater than start',
        });
    }
});

const RawMedicationSigSchema = z.object({
    raw: z.string().min(1),
    window_start: z.number().int().nonnegative(),
    window_end: z.number().int().positive(),
    dose: z.number().finite().nullable().optional(),
    unit: z.string().min(1).nullable().optional(),
    form: z.string().min(1).nullable().optional(),
    route: z.string().min(1).nullable().optional(),
    frequency_per_day: z.number().finite().nullable().optional(),
    frequency_period: z.union([z.number().finite(), z.string()]).nullable().optional(),
    frequency_period_unit: z.string().min(1).nullable().optional(),
    as_needed: z.boolean(),
    condition: z.string().min(1).nullable().optional(),
    duration_days: z.union([z.number().finite(), z.string()]).nullable().optional(),
    missing: z.array(z.string().min(1)),
}).strict().refine(sig => sig.window_end > sig.window_start, {
    message: 'Medication sig window end must be greater than start',
});

const RawContextResultSchema = z.object({
    id: z.string().min(1),
    kind: z.enum(['condition', 'medication']),
    text: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    assertion: z.object({
        polarity: z.enum(['affirmed', 'negated']),
        certainty: z.enum(['certain', 'uncertain']),
        temporality: z.enum(['recent', 'historical', 'hypothetical']),
        experiencer: z.enum(['patient', 'family', 'other']),
    }).strict(),
    cues: z.array(RawContextCueSchema),
    section: RawSectionSchema.optional(),
    experiencer_evidence: RawExperiencerEvidenceSchema,
    medication_sig: RawMedicationSigSchema.optional(),
}).strict().refine(result => result.end > result.start, {
    message: 'Context result end must be greater than start',
});

const RawContextResponseSchema = z.object({
    text: z.string().min(1),
    engine: z.string().min(1),
    engine_version: z.string().min(1).nullable().optional(),
    bridge_version: z.string().min(1),
    language: z.string().min(1),
    evaluated_at: IsoDateTimeSchema,
    results: z.array(RawContextResultSchema),
}).strict();

const RawContextHealthSchema = z.object({
    status: z.string().min(1),
    service: z.string().min(1),
    engine: z.string().min(1),
    openmed_version: z.string().min(1).nullable().optional(),
    bridge_version: z.string().min(1),
    features: z.array(z.string().min(1)),
    advisory: z.boolean(),
}).strict();

export const parseOpenMedContextHealthResponse = (
    input: unknown,
    endpoint: string,
): OpenMedContextHealth => {
    const parsed = RawContextHealthSchema.parse(input);
    const available = ['ok', 'ready'].includes(parsed.status.trim().toLowerCase());
    return {
        available,
        endpoint,
        status: available ? 'available' : 'invalid-response',
        message: available
            ? 'MediBrief OpenMed context bridge is reachable.'
            : `Context bridge reported status “${parsed.status}”.`,
        ...(parsed.openmed_version
            ? { openMedVersion: parsed.openmed_version }
            : {}),
        bridgeVersion: parsed.bridge_version,
        features: parsed.features,
    };
};

export const parseOpenMedContextResponse = ({
    input,
    expectedText,
    requestedSpans,
}: {
    input: unknown;
    expectedText: string;
    requestedSpans: OpenMedContextRequestSpan[];
}): OpenMedContextResponse => {
    const parsed = RawContextResponseSchema.parse(input);
    if (parsed.text !== expectedText) {
        throw new Error('OpenMed context response text does not match the request.');
    }

    const requestedById = new Map(requestedSpans.map(span => [span.id, span]));
    if (parsed.results.length !== requestedSpans.length) {
        throw new Error('OpenMed context response did not return every requested span.');
    }

    const seen = new Set<string>();
    const results: OpenMedContextResult[] = parsed.results.map(result => {
        const requested = requestedById.get(result.id);
        if (!requested || seen.has(result.id)) {
            throw new Error('OpenMed context response contains an unknown or duplicate span.');
        }
        seen.add(result.id);
        const sourceText = expectedText.slice(result.start, result.end);
        if (
            result.kind !== requested.kind
            || result.start !== requested.start
            || result.end !== requested.end
            || result.text !== requested.text
            || sourceText !== requested.text
        ) {
            throw new Error(`OpenMed context response changed source span ${result.id}.`);
        }

        const cues: OpenMedContextCue[] = result.cues.map(cue => {
            if (
                cue.end > expectedText.length
                || expectedText.slice(cue.start, cue.end) !== cue.text
            ) {
                throw new Error(`OpenMed context response contains an invalid cue for ${result.id}.`);
            }
            return {
                text: cue.text,
                category: cue.category,
                start: cue.start,
                end: cue.end,
                direction: cue.direction,
            };
        });

        const assertion: OpenMedContextAssertion = {
            polarity: result.assertion.polarity!,
            certainty: result.assertion.certainty!,
            temporality: result.assertion.temporality!,
            experiencer: result.assertion.experiencer!,
        };

        const medicationSig: OpenMedMedicationSig | undefined = result.medication_sig
            ? {
                raw: result.medication_sig.raw,
                windowStart: result.medication_sig.window_start,
                windowEnd: result.medication_sig.window_end,
                ...(result.medication_sig.dose !== null
                    && result.medication_sig.dose !== undefined
                    ? { dose: result.medication_sig.dose }
                    : {}),
                ...(result.medication_sig.unit ? { unit: result.medication_sig.unit } : {}),
                ...(result.medication_sig.form ? { form: result.medication_sig.form } : {}),
                ...(result.medication_sig.route ? { route: result.medication_sig.route } : {}),
                ...(result.medication_sig.frequency_per_day !== null
                    && result.medication_sig.frequency_per_day !== undefined
                    ? { frequencyPerDay: result.medication_sig.frequency_per_day }
                    : {}),
                ...(result.medication_sig.frequency_period !== null
                    && result.medication_sig.frequency_period !== undefined
                    ? { frequencyPeriod: result.medication_sig.frequency_period }
                    : {}),
                ...(result.medication_sig.frequency_period_unit
                    ? { frequencyPeriodUnit: result.medication_sig.frequency_period_unit }
                    : {}),
                asNeeded: result.medication_sig.as_needed,
                ...(result.medication_sig.condition
                    ? { condition: result.medication_sig.condition }
                    : {}),
                ...(result.medication_sig.duration_days !== null
                    && result.medication_sig.duration_days !== undefined
                    ? { durationDays: result.medication_sig.duration_days }
                    : {}),
                missing: result.medication_sig.missing,
            }
            : undefined;

        const section: OpenMedSectionEvidence | undefined = result.section
            ? {
                label: result.section.label,
                ...(result.section.canonical
                    ? { canonical: result.section.canonical }
                    : {}),
                ...(result.section.header
                    ? { header: result.section.header }
                    : {}),
                start: result.section.start,
                end: result.section.end,
                ...(result.section.header_start !== undefined
                    ? { headerStart: result.section.header_start }
                    : {}),
                ...(result.section.header_end !== undefined
                    ? { headerEnd: result.section.header_end }
                    : {}),
                ...(result.section.content_start !== undefined
                    ? { contentStart: result.section.content_start }
                    : {}),
                ...(result.section.source
                    ? { source: result.section.source }
                    : {}),
            }
            : undefined;

        const experiencerEvidence: OpenMedExperiencerEvidence = {
            source: result.experiencer_evidence.source,
            ...(result.experiencer_evidence.cue
                ? { cue: result.experiencer_evidence.cue }
                : {}),
            ...(result.experiencer_evidence.start !== undefined
                ? { start: result.experiencer_evidence.start }
                : {}),
            ...(result.experiencer_evidence.end !== undefined
                ? { end: result.experiencer_evidence.end }
                : {}),
        };

        const mapped: OpenMedContextResult = {
            id: result.id,
            kind: result.kind,
            text: result.text,
            start: result.start,
            end: result.end,
            assertion,
            cues,
            ...(section ? { section } : {}),
            experiencerEvidence,
            ...(medicationSig ? { medicationSig } : {}),
            engine: parsed.engine,
            ...(parsed.engine_version
                ? { engineVersion: parsed.engine_version }
                : {}),
            bridgeVersion: parsed.bridge_version,
            language: parsed.language,
            evaluatedAt: parsed.evaluated_at,
        };
        return mapped;
    });

    return {
        text: parsed.text,
        engine: parsed.engine,
        ...(parsed.engine_version ? { engineVersion: parsed.engine_version } : {}),
        bridgeVersion: parsed.bridge_version,
        language: parsed.language,
        evaluatedAt: parsed.evaluated_at,
        results,
    };
};
