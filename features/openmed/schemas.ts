import { z } from 'zod';
import type {
    OpenMedAnalysisResponse,
    OpenMedErrorEnvelope,
    OpenMedHealthResponse,
} from './types';

const OpenMedEntitySchema = z.object({
    text: z.string().min(1),
    label: z.string().min(1),
    confidence: z.number().finite().min(0).max(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
}).passthrough();

const OpenMedAnalysisSchema = z.object({
    text: z.string(),
    entities: z.array(OpenMedEntitySchema),
    model_name: z.string().min(1).optional(),
    modelName: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    engine_version: z.string().min(1).optional(),
}).passthrough();

const OpenMedHealthSchema = z.object({
    status: z.string().min(1),
    service: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    profile: z.string().min(1).optional(),
}).passthrough();

const OpenMedErrorSchema = z.object({
    error: z.object({
        code: z.string().optional(),
        message: z.string().min(1),
        details: z.unknown().optional(),
    }).passthrough(),
}).passthrough();

const normalizeLabel = (value: string): string =>
    value.trim().replace(/^B-|^I-/i, '').replace(/\s+/g, '_').toUpperCase();

export const parseOpenMedHealthResponse = (
    input: unknown,
): OpenMedHealthResponse => {
    const parsed = OpenMedHealthSchema.parse(input);
    return {
        status: parsed.status,
        ...(parsed.service ? { service: parsed.service } : {}),
        ...(parsed.version ? { version: parsed.version } : {}),
        ...(parsed.profile ? { profile: parsed.profile } : {}),
    };
};

/**
 * OpenMed offsets are accepted only when they point into the exact text sent by
 * MediBrief. Invalid spans are rejected rather than being attached to the wrong
 * source location.
 */
export const parseOpenMedAnalysisResponse = ({
    input,
    expectedText,
    requestedModel,
}: {
    input: unknown;
    expectedText: string;
    requestedModel: string;
}): OpenMedAnalysisResponse => {
    const parsed = OpenMedAnalysisSchema.parse(input);
    if (parsed.text !== expectedText) {
        throw new Error(
            'OpenMed returned text that does not match the submitted source text.',
        );
    }

    let rejectedEntityCount = 0;
    const entities = parsed.entities.flatMap(entity => {
        if (entity.end <= entity.start || entity.end > parsed.text.length) {
            rejectedEntityCount += 1;
            return [];
        }

        const exactSourceText = parsed.text.slice(entity.start, entity.end);
        if (!exactSourceText.trim()) {
            rejectedEntityCount += 1;
            return [];
        }

        return [{
            text: exactSourceText,
            label: normalizeLabel(entity.label),
            confidence: entity.confidence,
            start: entity.start,
            end: entity.end,
        }];
    });

    return {
        text: parsed.text,
        entities,
        modelName:
            parsed.model_name
            || parsed.modelName
            || parsed.model
            || requestedModel,
        ...((parsed.engine_version || parsed.version)
            ? { engineVersion: parsed.engine_version || parsed.version }
            : {}),
        rejectedEntityCount,
    };
};

export const parseOpenMedErrorEnvelope = (
    input: unknown,
    fallbackMessage: string,
): OpenMedErrorEnvelope => {
    const parsed = OpenMedErrorSchema.safeParse(input);
    if (!parsed.success) return { message: fallbackMessage };

    return {
        ...(parsed.data.error.code
            ? { code: parsed.data.error.code }
            : {}),
        message: parsed.data.error.message,
        ...(parsed.data.error.details !== undefined
            ? { details: parsed.data.error.details }
            : {}),
    };
};
