import type { UploadedFile } from '../../types';
import {
    analyzeOpenMedText,
    OpenMedClientError,
} from './openMedClient';
import { analyzeOpenMedEntityContext } from './openMedContextClient';
import {
    deduplicateOpenMedEntities,
    toOpenMedCandidateEntity,
} from './candidateMapping';
import { extractLocalTextFromUpload } from './documentText';
import type {
    OpenMedCandidateEntity,
    OpenMedExtractionResult,
    OpenMedExtractionSettings,
} from './types';

const uniqueModels = (settings: OpenMedExtractionSettings): string[] => [
    ...new Set([
        settings.diseaseModel.trim(),
        settings.medicationModel.trim(),
    ].filter(Boolean)),
];

const NON_LATIN_CONTEXT_SCRIPT = /[\u0400-\u052f\u0590-\u08ff\u0900-\u0d7f\u3040-\u30ff\u3400-\u9fff]/;

const supportsEvaluatedEnglishContext = (text: string): boolean =>
    !NON_LATIN_CONTEXT_SCRIPT.test(text);

export const extractOpenMedCandidatesFromUpload = async ({
    file,
    settings,
    signal,
}: {
    file: UploadedFile;
    settings: OpenMedExtractionSettings;
    signal?: AbortSignal;
}): Promise<OpenMedExtractionResult> => {
    const localText = extractLocalTextFromUpload(file);
    if (localText.status !== 'ready') {
        return {
            status: localText.status,
            entities: [],
            warnings: [localText.message],
            contextStatus: 'not-requested',
        };
    }
    if (!localText.text) {
        return {
            status: 'invalid',
            entities: [],
            warnings: [
                'The local decoder reported ready text without a text payload.',
            ],
            contextStatus: 'not-requested',
        };
    }

    const models = uniqueModels(settings);
    if (models.length === 0) {
        return {
            status: 'unavailable',
            text: localText.text,
            entities: [],
            warnings: ['No OpenMed disease or medication model is configured.'],
            contextStatus: 'not-requested',
        };
    }

    const entities: OpenMedCandidateEntity[] = [];
    const warnings: string[] = [];
    let successfulModels = 0;
    let failedModels = 0;
    let serviceVersion: string | undefined;

    for (const modelName of models) {
        if (signal?.aborted) {
            return {
                status: 'aborted',
                text: localText.text,
                entities: [],
                warnings: ['OpenMed extraction was cancelled.'],
                contextStatus: 'not-requested',
            };
        }

        try {
            const response = await analyzeOpenMedText({
                config: {
                    baseUrl: settings.baseUrl,
                    timeoutMs: settings.timeoutMs,
                },
                options: {
                    text: localText.text,
                    modelName,
                    confidenceThreshold: settings.confidenceThreshold,
                    groupEntities: false,
                    aggregationStrategy: 'simple',
                    keepAlive: settings.keepAlive,
                    signal,
                },
            });
            successfulModels += 1;
            serviceVersion = serviceVersion || response.engineVersion;

            if (response.rejectedEntityCount > 0) {
                warnings.push(
                    `${response.rejectedEntityCount} malformed ${modelName} span(s) were rejected.`,
                );
            }

            let unsupportedLabels = 0;
            response.entities.forEach(entity => {
                if (entity.confidence < settings.confidenceThreshold) return;
                const candidate = toOpenMedCandidateEntity({
                    entity,
                    modelName: response.modelName,
                    engineVersion: response.engineVersion,
                });
                if (candidate) entities.push(candidate);
                else unsupportedLabels += 1;
            });
            if (unsupportedLabels > 0) {
                warnings.push(
                    `${unsupportedLabels} ${modelName} entity span(s) used labels that are not mapped in Slice 2.`,
                );
            }
        } catch (error) {
            if (
                signal?.aborted
                || (error instanceof OpenMedClientError
                    && error.code === 'aborted')
            ) {
                return {
                    status: 'aborted',
                    text: localText.text,
                    entities: [],
                    warnings: ['OpenMed extraction was cancelled.'],
                    contextStatus: 'not-requested',
                };
            }
            failedModels += 1;
            const message = error instanceof Error
                ? error.message
                : 'Unknown OpenMed extraction failure.';
            warnings.push(`${modelName}: ${message}`);
        }
    }

    const deduplicated = deduplicateOpenMedEntities(entities);
    if (successfulModels === 0) {
        return {
            status: 'unavailable',
            text: localText.text,
            entities: [],
            warnings,
            contextStatus: 'not-requested',
        };
    }
    if (deduplicated.length === 0) {
        return {
            status: failedModels > 0 ? 'partial' : 'empty',
            text: localText.text,
            entities: [],
            warnings,
            contextStatus: 'not-requested',
            ...(serviceVersion ? { serviceVersion } : {}),
        };
    }

    let enriched = deduplicated;
    let contextStatus: OpenMedExtractionResult['contextStatus'] = 'not-requested';
    let contextAppliedCount = 0;

    if (!supportsEvaluatedEnglishContext(localText.text)) {
        contextStatus = 'skipped-language';
        warnings.push(
            'OpenMed assertion context was skipped because Slice 2 is evaluated for English text only. Polarity, certainty, temporality, and experiencer remain unknown for this document.',
        );
    } else {
        try {
            const context = await analyzeOpenMedEntityContext({
                config: {
                    baseUrl: settings.baseUrl,
                    timeoutMs: settings.timeoutMs,
                },
                text: localText.text,
                entities: deduplicated,
                language: 'en',
                signal,
            });
            enriched = deduplicated.map((entity, index) => ({
                ...entity,
                context: context.results[index],
            }));
            contextAppliedCount = context.results.length;
            contextStatus = 'applied';
        } catch (error) {
            if (
                signal?.aborted
                || (error instanceof OpenMedClientError
                    && error.code === 'aborted')
            ) {
                return {
                    status: 'aborted',
                    text: localText.text,
                    entities: [],
                    warnings: ['OpenMed extraction was cancelled.'],
                    contextStatus: 'unavailable',
                };
            }
            contextStatus = 'unavailable';
            const message = error instanceof Error
                ? error.message
                : 'Unknown OpenMed context-bridge failure.';
            warnings.push(
                `${message} NER candidates were retained with unknown assertion context.`,
            );
        }
    }

    return {
        status: failedModels > 0 ? 'partial' : 'success',
        text: localText.text,
        entities: enriched,
        warnings,
        contextStatus,
        ...(contextAppliedCount > 0 ? { contextAppliedCount } : {}),
        ...(serviceVersion ? { serviceVersion } : {}),
    };
};
