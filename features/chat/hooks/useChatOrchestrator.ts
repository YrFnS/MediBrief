import React, { useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMode as ChatModeEnum, UploadedFile, ChatMessage, GroundingSource } from '../../../types';
import { generateResponseStream } from '../../../services/aiService';
import { exportBriefingToPdf } from '../../../services/exportService';
import { cleanJsonOutput, isJsonBriefing, getFriendlyErrorMessage, isLabReport, parseAndValidate } from '../../../utils';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE, DRUG_ANALYSIS_PROMPT, MODEL_CONFIGS } from '../../../constants';
import { usePatientStore } from '../../patient-management/usePatientStore';
import { useChatStore } from '../stores/useChatStore';
import { useClinicalStore } from '../../clinical-analysis/stores/useClinicalStore';
import { useAuditStore } from '../../audit/useAuditStore';
import { useSettingsStore, AIProvider } from '../../settings/useSettingsStore';
import { useEntityExtractor } from '../../../hooks/useEntityExtractor';
import { FHIRObservation } from '../../fhir/types';
import { evaluateClinicalSafety } from '../../cdss/rulesEngine';
import { PatientMetadata } from '../../patient-management/types';
import { UIAction } from '../../ui/UIContext';
import { LabReportSchema, BriefingSchema, Briefing, LabReport } from '../schemas';
import { normalizeValue } from '../../fhir/unitService';
import { isHighCredibilitySource } from '../../../utils/sourceVerification';

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
    activePatient,
    chatMode,
    uiDispatch,
    uploadedFile,
    setUploadedFile,
    isLive,
    stopSession,
    clearFile
}: UseChatOrchestratorProps) => {
    // Access actions from all stores using individual selectors for stability
    const touchPatient = usePatientStore(state => state.actions.touchPatient);
    
    const resetChat = useChatStore(state => state.actions.resetChat);
    const addMessage = useChatStore(state => state.actions.addMessage);
    const addResponsePlaceholder = useChatStore(state => state.actions.addResponsePlaceholder);
    const updateLastMessageContent = useChatStore(state => state.actions.updateLastMessageContent);
    const appendToLastMessage = useChatStore(state => state.actions.appendToLastMessage);
    
    const clinicalActions = useClinicalStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    
    // Settings Store
    const { provider, geminiApiKey, openRouterApiKey, customModels } = useSettingsStore();
    
    // Determine the actual model to use based on settings or defaults
    const getModelForMode = useCallback((mode: ChatModeEnum) => {
        return customModels[mode] || MODEL_CONFIGS[mode]?.model || 'gemini-1.5-flash';
    }, [customModels]);

    const abortControllerRef = useRef<AbortController | null>(null);
    const { triggerExtraction } = useEntityExtractor();

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
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
            uiDispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Standard });
        }
        
        // Update last active
        touchPatient(activePatientId);

        // --- Export Command ---
        if (trimmedPrompt.toLowerCase() === '/export') {
            const history = messages.filter(m => !isJsonBriefing(m.content));
            if (history.length === 0) {
                 addMessage(activePatientId, { role: 'model', content: '⚠️ **Cannot Export:** No history available.' });
                 return;
            }

            addMessage(activePatientId, { role: 'model', content: '📥 Generating briefing for PDF export...' });
            uiDispatch({ type: 'SET_LOADING', payload: true });
            
            abortControllerRef.current = new AbortController();
            try {
                const modeForRequest = ChatModeEnum.Standard;
                const apiKey = provider === AIProvider.Gemini ? (geminiApiKey || process.env.API_KEY || '') : openRouterApiKey;
                const stream = generateResponseStream(SHIFT_BRIEFING_PROMPT(), history, modeForRequest, { 
                    responseType: 'json',
                    apiKey,
                    provider,
                    model: getModelForMode(modeForRequest)
                });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                    fullResponseText += chunk.text;
                }
                
                if (fullResponseText.includes("NO DATA")) throw new Error("Insufficient clinical data found.");

                // Use Zod validation for PDF export
                const parsedBriefing = parseAndValidate(fullResponseText, BriefingSchema);
                if (!parsedBriefing) throw new Error("Invalid briefing format generated by AI.");
                
                if (parsedBriefing.briefingTitle.includes("NO DATA")) throw new Error("Insufficient clinical data.");

                await exportBriefingToPdf(parsedBriefing);
                updateLastMessageContent(activePatientId, '✅ Shift briefing PDF downloaded.');
                
                // Audit Export
                auditActions.logEvent(
                    'EXPORT_PDF', 
                    activePatientId, 
                    'Generated and downloaded shift briefing PDF', 
                    'USER',
                    { title: parsedBriefing.briefingTitle }
                );

            } catch (e) {
                if (e.message === "Aborted") {
                      updateLastMessageContent(activePatientId, '🛑 Export cancelled.');
                } else {
                    const friendlyError = getFriendlyErrorMessage(e);
                    updateLastMessageContent(activePatientId, `Sorry, PDF generation failed.\n\n**Reason:** ${friendlyError}`);
                }
            } finally {
                uiDispatch({ type: 'SET_LOADING', payload: false });
                abortControllerRef.current = null;
            }
            return;
        }

        // --- Help Command ---
        if (trimmedPrompt.toLowerCase() === '/help') {
             addMessage(activePatientId, { role: 'user', content: '/help' });
             addMessage(activePatientId, { role: 'model', content: HELP_COMMAND_RESPONSE });
             return;
        }

        // --- Standard Message & File Handling ---
        let finalApiPrompt = trimmedPrompt;
        let historyContent = trimmedPrompt;
        
        let fileForApi: UploadedFile | undefined = uploadedFile || undefined;
        
        let displayOverride = undefined;
        let modeForRequest: ChatModeEnum = chatMode === ChatModeEnum.Live ? ChatModeEnum.Standard : chatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';
        const isDrugCommand = trimmedPrompt.toLowerCase().startsWith('/drugs');

        if (uploadedFile) {
             if (activePatientId) {
                 // Trigger Safety Extraction
                 triggerExtraction(uploadedFile, activePatientId);
                 
                 // Register Document (Lightweight Metadata Only)
                 if (uploadedFile.storageId) {
                     // We cast to any because we invoke the store action directly which is not fully typed in this hook's scope, 
                     // but the store knows the ADD_DOCUMENT action. 
                     // Ideally we'd expose this action via usePatientStore's return type interface.
                     // For now, assume the action exists on the store.
                     (usePatientStore.getState().actions as any).addDocument?.(activePatientId, {
                         storageId: uploadedFile.storageId,
                         name: uploadedFile.file.name,
                         type: uploadedFile.type,
                         uploadedAt: Date.now()
                     });
                 }
             }

             try {
                let analysisPrompt: string;
                if (uploadedFile.type === 'application/pdf') {
                    const promptBase = trimmedPrompt ? `User Query: ${trimmedPrompt}` : `Analyze this medical document.`;
                    analysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name) + `\n\n${promptBase}`;
                } else if (uploadedFile.type === 'text/plain' || uploadedFile.file.name.endsWith('.txt') || uploadedFile.file.name.endsWith('.md')) {
                     const textContent = await uploadedFile.file.text();
                     const promptBase = trimmedPrompt ? `User Query: ${trimmedPrompt}` : `Analyze this document.`;
                     const fullEmbeddedContent = `*** BEGIN FILE CONTENT: ${uploadedFile.file.name} ***\n${textContent}\n*** END FILE CONTENT ***\n\n${promptBase}`;
                     analysisPrompt = fullEmbeddedContent;
                     historyContent = fullEmbeddedContent;
                     displayOverride = `📄 **Uploaded ${uploadedFile.file.name}**\n\n${trimmedPrompt || "Requested analysis."}`;
                     fileForApi = undefined; 
                } else {
                    const baseAnalysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name);
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
                    if (!displayOverride) historyContent = trimmedPrompt || "/brief (with file)";
                }
             } catch (error) {
                 addMessage(activePatientId, { role: 'model', content: `Error: ${getFriendlyErrorMessage(error)}` });
                 uiDispatch({ type: 'SET_ERROR', payload: getFriendlyErrorMessage(error) });
                 return;
             }
        } else if (isBriefingCommand) {
            finalApiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = "/brief"; 
            modeForRequest = ChatModeEnum.Standard;
            responseType = 'json';
            
            // Log Briefing Request
            auditActions.logEvent('BRIEFING_GENERATED', activePatientId, 'Briefing requested via command', 'USER');

        } else if (isDrugCommand) {
            finalApiPrompt = DRUG_ANALYSIS_PROMPT(trimmedPrompt);
            modeForRequest = ChatModeEnum.Standard; 
            responseType = 'json';
        }

        if (trimmedPrompt.toLowerCase().startsWith('/patient')) modeForRequest = ChatModeEnum.Standard;

        const userMessage: ChatMessage = { role: 'user', content: historyContent };
        if (displayOverride) userMessage.displayContent = displayOverride;
        
        if (uploadedFile && fileForApi) { 
            userMessage.filePreview = { 
                name: uploadedFile.file.name, 
                type: uploadedFile.type, 
                url: uploadedFile.url,
                storageId: uploadedFile.storageId 
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
            const history = [...messages];
            const apiKey = provider === AIProvider.Gemini ? (geminiApiKey || process.env.API_KEY || '') : openRouterApiKey;
            const stream = generateResponseStream(finalApiPrompt, history, modeForRequest, { 
                file: fileForApi, 
                responseType,
                apiKey,
                provider,
                model: getModelForMode(modeForRequest)
            });
            
            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                
                const textChunk = chunk.text || '';
                fullResponseBuffer += textChunk;

                const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
                let sources: GroundingSource[] | undefined = undefined;

                if (groundingMetadata && groundingMetadata.groundingChunks) {
                    sources = groundingMetadata.groundingChunks.map(chunk => {
                        if (chunk.web) {
                            return { 
                                web: chunk.web,
                                rejected: !isHighCredibilitySource(chunk.web.uri)
                            };
                        }
                        if ((chunk as any).maps) return { maps: (chunk as any).maps };
                        return undefined;
                    }).filter(Boolean) as GroundingSource[];
                }

                appendToLastMessage(activePatientId, textChunk, sources);
            }
        } catch (e) {
             if (e.message === "Aborted") {
                 appendToLastMessage(activePatientId, " [Stopped]", undefined);
            } else {
                const errorMsg = `Sorry, I encountered an error.\n\n**Details:** ${getFriendlyErrorMessage(e)}`;
                updateLastMessageContent(activePatientId, errorMsg);
            }
        } finally {
            uiDispatch({ type: 'SET_LOADING', payload: false });
            
            // Lab rows remain in quarantine until the report-level review creates
            // one source-linked candidate graph. Nothing is confirmed here.
            if (activePatientId && isLabReport(fullResponseBuffer)) {
                const report = parseAndValidate(fullResponseBuffer, LabReportSchema);
                
                if (report && report.labs && report.labs.length > 0) {
                    const source = uploadedFile?.storageId
                        ? {
                            documentId: `document-${uploadedFile.storageId}`,
                            storageId: uploadedFile.storageId,
                            fileName: uploadedFile.file.name,
                            mimeType: uploadedFile.type
                                || uploadedFile.file.type
                                || 'application/octet-stream',
                        }
                        : undefined;
                    uiDispatch({
                        type: 'SET_PENDING_LAB_REPORT',
                        payload: {
                            reviewId: uuidv4(),
                            report,
                            ...(source ? { source } : {}),
                        },
                    });
                } else {
                    console.warn("Lab report detected but failed validation or was empty.");
                }
            }

            abortControllerRef.current = null;
        }
    }, [messages, activePatientId, chatMode, uploadedFile, isLive, stopSession, clinicalActions, auditActions, uiDispatch, setUploadedFile, triggerExtraction, resetChat, addMessage, addResponsePlaceholder, updateLastMessageContent, appendToLastMessage, touchPatient]);

    return {
        handleSend,
        handleStop,
        handleClearChat,
        handleExportChat: useCallback(() => handleSend('/export'), [handleSend])
    };
};