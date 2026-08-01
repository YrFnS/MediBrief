import React, { useCallback, useEffect, useRef } from 'react';
import {
    ChatMode as ChatModeEnum,
    type ChatMessage,
    type GroundingSource,
    type UploadedFile,
} from '../../../types';
import {
    BRIEFING_TRIGGERS,
    DRUG_ANALYSIS_PROMPT,
    FILE_ANALYSIS_PROMPT,
    HELP_COMMAND_RESPONSE,
    MODEL_CONFIGS,
    SHIFT_BRIEFING_PROMPT,
} from '../../../constants';
import { generateResponseStream } from '../../../services/aiService';
import { exportBriefingToPdf } from '../../../services/exportService';
import {
    getFriendlyErrorMessage,
    isJsonBriefing,
    isLabReport,
    parseAndValidate,
} from '../../../utils';
import { isHighCredibilitySource } from '../../../utils/sourceVerification';
import { useEntityExtractor } from '../../../hooks/useEntityExtractor';
import { useAuditStore } from '../../audit/useAuditStore';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import { createPendingLegacyLabReview } from '../../diagnostic-reports';
import {
    finalizeGroundedAssistantAnswer,
    prepareAssistantTurn,
} from '../../grounded-assistance';
import type { PatientMetadata } from '../../patient-management/types';
import { usePatientStore } from '../../patient-management/usePatientStore';
import { AIProvider, useSettingsStore } from '../../settings/useSettingsStore';
import type { UIAction } from '../../ui/UIContext';
import { BriefingSchema, LabReportSchema } from '../schemas';
import { useChatStore } from '../stores/useChatStore';

interface UseChatOrchestratorProps {
    messages: ChatMessage[];
    activePatientId: string;
    activePatient: PatientMetadata;
    chatMode: ChatModeEnum;
    uiDispatch: React.Dispatch<UIAction>;
    uploadedFile: UploadedFile | null;
    setUploadedFile: (file: UploadedFile | null) => void;
    isLive: boolean;
    stopSession: () => void;
    clearFile: () => void;
}

export const useChatOrchestrator = ({
    messages,
    activePatientId,
    activePatient: _activePatient,
    chatMode,
    uiDispatch,
    uploadedFile,
    setUploadedFile,
    isLive,
    stopSession,
    clearFile,
}: UseChatOrchestratorProps) => {
    const touchPatient = usePatientStore(state => state.actions.touchPatient);
    const resetChat = useChatStore(state => state.actions.resetChat);
    const addMessage = useChatStore(state => state.actions.addMessage);
    const addResponsePlaceholder = useChatStore(
        state => state.actions.addResponsePlaceholder,
    );
    const updateLastMessageContent = useChatStore(
        state => state.actions.updateLastMessageContent,
    );
    const appendToLastMessage = useChatStore(
        state => state.actions.appendToLastMessage,
    );
    const auditActions = useAuditStore(state => state.actions);
    const activeRecord = useClinicalRecordStore(
        state => state.records[activePatientId],
    );
    const {
        provider,
        geminiApiKey,
        openRouterApiKey,
        customModels,
    } = useSettingsStore();

    const getModelForMode = useCallback((mode: ChatModeEnum) =>
        customModels[mode]
        || MODEL_CONFIGS[mode]?.model
        || 'gemini-1.5-flash', [customModels]);

    const abortControllerRef = useRef<AbortController | null>(null);
    const { triggerExtraction } = useEntityExtractor();

    useEffect(() => () => {
        abortControllerRef.current?.abort();
    }, []);

    const handleStop = useCallback(() => {
        abortControllerRef.current?.abort();
        uiDispatch({ type: 'SET_LOADING', payload: false });
    }, [uiDispatch]);

    const handleClearChat = useCallback(() => {
        resetChat(activePatientId);
        clearFile();
    }, [resetChat, activePatientId, clearFile]);

    const handleSend = useCallback(async (userPrompt: string) => {
        const trimmedPrompt = userPrompt.trim();
        if (!trimmedPrompt && !uploadedFile) return;

        if (isLive) {
            stopSession();
            uiDispatch({
                type: 'SET_CHAT_MODE',
                payload: ChatModeEnum.Standard,
            });
        }

        touchPatient(activePatientId);

        if (trimmedPrompt.toLowerCase() === '/export') {
            const history = messages.filter(message =>
                !isJsonBriefing(message.content));
            if (history.length === 0) {
                addMessage(activePatientId, {
                    role: 'model',
                    content: '⚠️ **Cannot Export:** No history available.',
                });
                return;
            }

            addMessage(activePatientId, {
                role: 'model',
                content: '📥 Generating briefing for PDF export...',
            });
            uiDispatch({ type: 'SET_LOADING', payload: true });
            abortControllerRef.current = new AbortController();

            try {
                const modeForRequest = ChatModeEnum.Standard;
                const apiKey = provider === AIProvider.Gemini
                    ? geminiApiKey || process.env.API_KEY || ''
                    : openRouterApiKey;
                const stream = generateResponseStream(
                    SHIFT_BRIEFING_PROMPT(),
                    history,
                    modeForRequest,
                    {
                        responseType: 'json',
                        apiKey,
                        provider,
                        model: getModelForMode(modeForRequest),
                    },
                );
                let fullResponseText = '';
                for await (const chunk of stream) {
                    if (abortControllerRef.current?.signal.aborted) {
                        throw new Error('Aborted');
                    }
                    fullResponseText += chunk.text;
                }

                if (fullResponseText.includes('NO DATA')) {
                    throw new Error('Insufficient clinical data found.');
                }
                const parsedBriefing = parseAndValidate(
                    fullResponseText,
                    BriefingSchema,
                );
                if (!parsedBriefing) {
                    throw new Error('Invalid briefing format generated by AI.');
                }
                if (parsedBriefing.briefingTitle.includes('NO DATA')) {
                    throw new Error('Insufficient clinical data.');
                }

                await exportBriefingToPdf(parsedBriefing);
                updateLastMessageContent(
                    activePatientId,
                    '✅ Shift briefing PDF downloaded.',
                );
                auditActions.logEvent(
                    'EXPORT_PDF',
                    activePatientId,
                    'Generated and downloaded shift briefing PDF',
                    'USER',
                    { title: parsedBriefing.briefingTitle },
                );
            } catch (error) {
                if (error instanceof Error && error.message === 'Aborted') {
                    updateLastMessageContent(
                        activePatientId,
                        '🛑 Export cancelled.',
                    );
                } else {
                    const friendlyError = getFriendlyErrorMessage(error);
                    updateLastMessageContent(
                        activePatientId,
                        `Sorry, PDF generation failed.\n\n**Reason:** ${friendlyError}`,
                    );
                }
            } finally {
                uiDispatch({ type: 'SET_LOADING', payload: false });
                abortControllerRef.current = null;
            }
            return;
        }

        if (trimmedPrompt.toLowerCase() === '/help') {
            addMessage(activePatientId, { role: 'user', content: '/help' });
            addMessage(activePatientId, {
                role: 'model',
                content: HELP_COMMAND_RESPONSE,
            });
            return;
        }

        const preparedTurn = uploadedFile
            ? ({ kind: 'general' } as const)
            : prepareAssistantTurn(activeRecord, trimmedPrompt);

        if (preparedTurn.kind === 'deterministic-summary') {
            addMessage(activePatientId, {
                role: 'user',
                content: trimmedPrompt,
            });
            addMessage(activePatientId, {
                role: 'model',
                content: preparedTurn.response,
            });
            auditActions.logEvent(
                'DETERMINISTIC_SUMMARY_GENERATED',
                activePatientId,
                'Generated a deterministic summary from confirmed patient-record evidence.',
                'SYSTEM',
                {
                    selectedEvidence:
                        preparedTurn.summary.evidenceBundle.selection.selected,
                    pendingCandidates:
                        preparedTurn.summary.pendingCandidateCount,
                    diagnosticConflicts:
                        preparedTurn.summary.diagnosticConflictCount,
                },
            );
            return;
        }

        if (
            preparedTurn.kind === 'patient-record'
            && preparedTurn.immediateResponse
        ) {
            addMessage(activePatientId, {
                role: 'user',
                content: trimmedPrompt,
            });
            addMessage(activePatientId, {
                role: 'model',
                content: preparedTurn.immediateResponse,
            });
            auditActions.logEvent(
                'GROUNDED_ASSISTANT_REJECTED',
                activePatientId,
                'Patient-record request ended without a model call because confirmed evidence was unavailable.',
                'SYSTEM',
                {
                    selectedEvidence: preparedTurn.bundle.selection.selected,
                    includeHistory: preparedTurn.includeHistory,
                    resourceTypes: preparedTurn.resourceTypes,
                    reason: 'no-confirmed-evidence',
                },
            );
            return;
        }

        const groundedTurn = preparedTurn.kind === 'patient-record'
            ? preparedTurn
            : undefined;

        let finalApiPrompt = trimmedPrompt;
        let historyContent = trimmedPrompt;
        let fileForApi: UploadedFile | undefined = uploadedFile || undefined;
        let displayOverride: string | undefined;
        let modeForRequest: ChatModeEnum = chatMode === ChatModeEnum.Live
            ? ChatModeEnum.Standard
            : chatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger =>
            trimmedPrompt.toLowerCase().includes(trigger))
            || trimmedPrompt.toLowerCase() === '/brief';
        const isDrugCommand = trimmedPrompt.toLowerCase().startsWith('/drugs');

        if (uploadedFile) {
            if (activePatientId) {
                triggerExtraction(uploadedFile, activePatientId);
                if (uploadedFile.storageId) {
                    (usePatientStore.getState().actions as any).addDocument?.(
                        activePatientId,
                        {
                            storageId: uploadedFile.storageId,
                            name: uploadedFile.file.name,
                            type: uploadedFile.type,
                            uploadedAt: Date.now(),
                        },
                    );
                }
            }

            try {
                let analysisPrompt: string;
                if (uploadedFile.type === 'application/pdf') {
                    const promptBase = trimmedPrompt
                        ? `User Query: ${trimmedPrompt}`
                        : 'Analyze this medical document.';
                    analysisPrompt = `${FILE_ANALYSIS_PROMPT(uploadedFile.file.name)}\n\n${promptBase}`;
                } else if (
                    uploadedFile.type === 'text/plain'
                    || uploadedFile.file.name.endsWith('.txt')
                    || uploadedFile.file.name.endsWith('.md')
                ) {
                    const textContent = await uploadedFile.file.text();
                    const promptBase = trimmedPrompt
                        ? `User Query: ${trimmedPrompt}`
                        : 'Analyze this document.';
                    const fullEmbeddedContent = `*** BEGIN FILE CONTENT: ${uploadedFile.file.name} ***\n${textContent}\n*** END FILE CONTENT ***\n\n${promptBase}`;
                    analysisPrompt = fullEmbeddedContent;
                    historyContent = fullEmbeddedContent;
                    displayOverride = `📄 **Uploaded ${uploadedFile.file.name}**\n\n${trimmedPrompt || 'Requested analysis.'}`;
                    fileForApi = undefined;
                } else {
                    const baseAnalysisPrompt = FILE_ANALYSIS_PROMPT(
                        uploadedFile.file.name,
                    );
                    if (!trimmedPrompt) {
                        analysisPrompt = baseAnalysisPrompt;
                        displayOverride = `Analyzing file: ${uploadedFile.file.name}`;
                    } else {
                        analysisPrompt = `${baseAnalysisPrompt}\n\n---\n**ADDITIONAL INSTRUCTION:**\nThe user has asked: "${trimmedPrompt}".\n1. You MUST still output VALID JSON.\n2. Answer the user's question within the "visualObservations" or "note" fields.`;
                    }
                }

                finalApiPrompt = analysisPrompt;
                if (isBriefingCommand) {
                    finalApiPrompt = `${finalApiPrompt}\n\nIMPORTANT: After analyzing, ${SHIFT_BRIEFING_PROMPT()}`;
                    modeForRequest = ChatModeEnum.Standard;
                    responseType = 'json';
                    if (!displayOverride) {
                        historyContent = trimmedPrompt || '/brief (with file)';
                    }
                }
            } catch (error) {
                const friendlyError = getFriendlyErrorMessage(error);
                addMessage(activePatientId, {
                    role: 'model',
                    content: `Error: ${friendlyError}`,
                });
                uiDispatch({ type: 'SET_ERROR', payload: friendlyError });
                return;
            }
        } else if (isBriefingCommand && !groundedTurn) {
            finalApiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = '/brief';
            modeForRequest = ChatModeEnum.Standard;
            responseType = 'json';
            auditActions.logEvent(
                'BRIEFING_GENERATED',
                activePatientId,
                'Briefing requested via command',
                'USER',
            );
        } else if (isDrugCommand && !groundedTurn) {
            finalApiPrompt = DRUG_ANALYSIS_PROMPT(trimmedPrompt);
            modeForRequest = ChatModeEnum.Standard;
            responseType = 'json';
        }

        if (trimmedPrompt.toLowerCase().startsWith('/patient')) {
            modeForRequest = ChatModeEnum.Standard;
        }

        if (groundedTurn?.modelPrompt) {
            finalApiPrompt = groundedTurn.modelPrompt;
            responseType = 'text';
            fileForApi = undefined;
            auditActions.logEvent(
                'GROUNDING_BUNDLE_GENERATED',
                activePatientId,
                'Selected confirmed patient-record evidence for a grounded Assistant request.',
                'SYSTEM',
                {
                    selectedEvidence: groundedTurn.bundle.selection.selected,
                    eligibleBeforeSelection:
                        groundedTurn.bundle.selection.eligibleBeforeSelection,
                    excludedCounts: groundedTurn.bundle.excludedCounts,
                    includeHistory: groundedTurn.includeHistory,
                    resourceTypes: groundedTurn.resourceTypes,
                },
            );
        }

        const userMessage: ChatMessage = {
            role: 'user',
            content: historyContent,
        };
        if (displayOverride) userMessage.displayContent = displayOverride;
        if (uploadedFile && fileForApi) {
            userMessage.filePreview = {
                name: uploadedFile.file.name,
                type: uploadedFile.type,
                url: uploadedFile.url,
                storageId: uploadedFile.storageId,
            };
        }

        addMessage(activePatientId, userMessage);
        addResponsePlaceholder(activePatientId);
        uiDispatch({ type: 'SET_LOADING', payload: true });
        uiDispatch({ type: 'SET_ERROR', payload: null });
        setUploadedFile(null);

        abortControllerRef.current = new AbortController();
        let fullResponseBuffer = '';

        try {
            const history = groundedTurn ? [] : [...messages];
            const apiKey = provider === AIProvider.Gemini
                ? geminiApiKey || process.env.API_KEY || ''
                : openRouterApiKey;
            const stream = generateResponseStream(
                finalApiPrompt,
                history,
                modeForRequest,
                {
                    file: fileForApi,
                    responseType,
                    apiKey,
                    provider,
                    model: getModelForMode(modeForRequest),
                },
            );

            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) {
                    throw new Error('Aborted');
                }
                const textChunk = chunk.text || '';
                fullResponseBuffer += textChunk;

                const groundingMetadata = chunk.candidates?.[0]
                    ?.groundingMetadata;
                let sources: GroundingSource[] | undefined;
                if (groundingMetadata?.groundingChunks) {
                    sources = groundingMetadata.groundingChunks
                        .map(chunk => {
                            if (chunk.web) {
                                return {
                                    web: chunk.web,
                                    rejected: !isHighCredibilitySource(
                                        chunk.web.uri,
                                    ),
                                };
                            }
                            if ((chunk as any).maps) {
                                return { maps: (chunk as any).maps };
                            }
                            return undefined;
                        })
                        .filter(Boolean) as GroundingSource[];
                }
                if (!groundedTurn) {
                    appendToLastMessage(activePatientId, textChunk, sources);
                }
            }

            if (groundedTurn) {
                const finalized = finalizeGroundedAssistantAnswer(
                    fullResponseBuffer,
                    groundedTurn.bundle,
                );
                updateLastMessageContent(
                    activePatientId,
                    finalized.displayText,
                );
                auditActions.logEvent(
                    finalized.accepted
                        ? 'GROUNDED_ASSISTANT_COMPLETED'
                        : 'GROUNDED_ASSISTANT_REJECTED',
                    activePatientId,
                    finalized.accepted
                        ? 'Completed a citation-checked grounded Assistant response.'
                        : 'Withheld a patient-specific model response that failed local citation validation.',
                    'AI',
                    {
                        status: finalized.status,
                        citedEvidenceCount: finalized.citedEvidenceCount,
                        referencedEvidenceIds:
                            finalized.assessment?.referencedEvidenceIds || [],
                        unknownEvidenceIds:
                            finalized.assessment?.unknownEvidenceIds || [],
                    },
                );
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'Aborted') {
                if (groundedTurn) {
                    updateLastMessageContent(
                        activePatientId,
                        '🛑 Grounded record question cancelled.',
                    );
                } else {
                    appendToLastMessage(activePatientId, ' [Stopped]', undefined);
                }
            } else {
                updateLastMessageContent(
                    activePatientId,
                    `Sorry, I encountered an error.\n\n**Details:** ${getFriendlyErrorMessage(error)}`,
                );
                if (groundedTurn) {
                    auditActions.logEvent(
                        'GROUNDED_ASSISTANT_REJECTED',
                        activePatientId,
                        'Grounded Assistant generation failed before citation validation.',
                        'AI',
                        {
                            reason: 'provider-or-stream-error',
                            selectedEvidence:
                                groundedTurn.bundle.selection.selected,
                            error: getFriendlyErrorMessage(error),
                        },
                    );
                }
            }
        } finally {
            uiDispatch({ type: 'SET_LOADING', payload: false });

            if (
                !groundedTurn
                && activePatientId
                && isLabReport(fullResponseBuffer)
            ) {
                const report = parseAndValidate(
                    fullResponseBuffer,
                    LabReportSchema,
                );
                if (report?.labs?.length) {
                    const source = uploadedFile
                        ? {
                            ...(uploadedFile.storageId
                                ? {
                                    documentId:
                                        `document-${uploadedFile.storageId}`,
                                    storageId: uploadedFile.storageId,
                                }
                                : {}),
                            fileName: uploadedFile.file.name,
                            mimeType: uploadedFile.type
                                || uploadedFile.file.type
                                || undefined,
                        }
                        : {};
                    uiDispatch({
                        type: 'SET_PENDING_LAB_REPORT',
                        payload: createPendingLegacyLabReview({
                            report,
                            source,
                            extractionEngine: provider === AIProvider.Gemini
                                ? 'Google Gemini lab-report extraction'
                                : 'OpenRouter lab-report extraction',
                        }),
                    });
                } else {
                    console.warn(
                        'Lab report detected but failed validation or was empty.',
                    );
                }
            }

            abortControllerRef.current = null;
        }
    }, [
        activePatientId,
        activeRecord,
        addMessage,
        addResponsePlaceholder,
        appendToLastMessage,
        auditActions,
        chatMode,
        clearFile,
        geminiApiKey,
        getModelForMode,
        isLive,
        messages,
        openRouterApiKey,
        provider,
        resetChat,
        setUploadedFile,
        stopSession,
        touchPatient,
        triggerExtraction,
        uiDispatch,
        updateLastMessageContent,
        uploadedFile,
    ]);

    return {
        handleSend,
        handleStop,
        handleClearChat,
        handleExportChat: useCallback(
            () => handleSend('/export'),
            [handleSend],
        ),
    };
};
