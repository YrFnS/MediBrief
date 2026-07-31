import type { UploadedFile } from '../../types';
import {
    analyzeOpenMedText,
    OpenMedClientError,
} from './openMedClient';
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
        };
    }
    if (!localText.text) {
        return {
            status: 'invalid',
            entities: [],
            warnings: [
                'The local decoder reported ready text without a text payload.',
            ],
        };
    }

    const models = uniqueModels(settings);
    if (models.length === 0) {
        return {
            status: 'unavailable',
            text: localText.text,
            entities: [],
            warnings: ['No OpenMed disease or medication model is configured.'],
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
                    `${unsupportedLabels} ${modelName} entity span(s) used labels that are not mapped in Slice 1.`,
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
        };
    }
    if (deduplicated.length === 0) {
        return {
            status: failedModels > 0 ? 'partial' : 'empty',
            text: localText.text,
            entities: [],
            warnings,
            ...(serviceVersion ? { serviceVersion } : {}),
        };
    }

    return {
        status: failedModels > 0 ? 'partial' : 'success',
        text: localText.text,
        entities: deduplicated,
        warnings,
        ...(serviceVersion ? { serviceVersion } : {}),
    };
};
