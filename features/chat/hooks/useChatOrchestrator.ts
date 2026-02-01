
import React, { useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMode as ChatModeEnum, UploadedFile, ChatMessage, GroundingSource } from '../../../types';
import { generateResponseStream } from '../../../services/geminiService';
import { exportBriefingToPdf } from '../../../services/exportService';
import { cleanJsonOutput, isJsonBriefing, getFriendlyErrorMessage, isLabReport, parseAndValidate } from '../../../utils';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE, DRUG_ANALYSIS_PROMPT } from '../../../constants';
import { usePatientStore } from '../../patient-management/usePatientStore';
import { useChatStore } from '../stores/useChatStore';
import { useClinicalStore } from '../../clinical-analysis/stores/useClinicalStore';
import { useEntityExtractor } from '../../../hooks/useEntityExtractor';
import { FHIRObservation } from '../../fhir/types';
import { evaluateClinicalSafety } from '../../cdss/rulesEngine';
import { PatientMetadata } from '../../patient-management/types';
import { UIAction } from '../../ui/UIContext';
import { LabReportSchema, BriefingSchema, Briefing, LabReport } from '../schemas';

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
    userLocation?: { latitude: number, longitude: number };
    clearFile: () => void;
}

// Simple normalization map for common critical values
const NORMALIZE_UNITS = (val: number, unit: string, testName: string): { value: number, unit: string } => {
    const u = unit.toLowerCase().trim();
    const t = testName.toLowerCase();
    
    // Glucose: mmol/L -> mg/dL
    if (t.includes('glucose') && (u === 'mmol/l' || u === 'mmol')) {
        return { value: parseFloat((val * 18.018).toFixed(1)), unit: 'mg/dL' };
    }
    
    // Creatinine: umol/L -> mg/dL
    if ((t.includes('creatinine') || t.includes('scr')) && (u === 'umol/l' || u === 'µmol/l')) {
        return { value: parseFloat((val / 88.4).toFixed(2)), unit: 'mg/dL' };
    }
    
    return { value: val, unit: unit };
};

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
    userLocation,
    clearFile
}: UseChatOrchestratorProps) => {
    // Access actions from all 3 stores
    const patientActions = usePatientStore(state => state.actions);
    const chatActions = useChatStore(state => state.actions);
    const clinicalActions = useClinicalStore(state => state.actions);
    
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
        chatActions.resetChat(activePatientId);
        clearFile();
    }, [chatActions, activePatientId, clearFile]);

    const handleSend = useCallback(async (userPrompt: string) => {
        const trimmedPrompt = userPrompt.trim();
        if (!trimmedPrompt && !uploadedFile) return;

        if (isLive) {
            stopSession();
            uiDispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Standard });
        }
        
        // Update last active
        patientActions.touchPatient(activePatientId);

        // --- Export Command ---
        if (trimmedPrompt.toLowerCase() === '/export') {
            const history = messages.filter(m => !isJsonBriefing(m.content));
            if (history.length === 0) {
                 chatActions.addMessage(activePatientId, { role: 'model', content: '⚠️ **Cannot Export:** No history available.' });
                 return;
            }

            chatActions.addMessage(activePatientId, { role: 'model', content: '📥 Generating briefing for PDF export...' });
            uiDispatch({ type: 'SET_LOADING', payload: true });
            
            abortControllerRef.current = new AbortController();
            try {
                const modeForRequest = ChatModeEnum.Standard;
                const stream = generateResponseStream(SHIFT_BRIEFING_PROMPT(), history, modeForRequest, { responseType: 'json' });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                    fullResponseText += chunk.text;
                }
                
                if (fullResponseText.includes("NO DATA")) throw new Error("Insufficient clinical data found.");

                // Use Zod validation for PDF export
                const parsedBriefing = parseAndValidate<Briefing>(fullResponseText, BriefingSchema);
                if (!parsedBriefing) throw new Error("Invalid briefing format generated by AI.");
                
                if (parsedBriefing.briefingTitle.includes("NO DATA")) throw new Error("Insufficient clinical data.");

                await exportBriefingToPdf(parsedBriefing);
                chatActions.updateLastMessageContent(activePatientId, '✅ Shift briefing PDF downloaded.');
            } catch (e) {
                if (e.message === "Aborted") {
                     chatActions.updateLastMessageContent(activePatientId, '🛑 Export cancelled.');
                } else {
                    const friendlyError = getFriendlyErrorMessage(e);
                    chatActions.updateLastMessageContent(activePatientId, `Sorry, PDF generation failed.\n\n**Reason:** ${friendlyError}`);
                }
            } finally {
                uiDispatch({ type: 'SET_LOADING', payload: false });
                abortControllerRef.current = null;
            }
            return;
        }

        // --- Help Command ---
        if (trimmedPrompt.toLowerCase() === '/help') {
             chatActions.addMessage(activePatientId, { role: 'user', content: '/help' });
             chatActions.addMessage(activePatientId, { role: 'model', content: HELP_COMMAND_RESPONSE });
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
                 chatActions.addMessage(activePatientId, { role: 'model', content: `Error: ${getFriendlyErrorMessage(error)}` });
                 uiDispatch({ type: 'SET_ERROR', payload: getFriendlyErrorMessage(error) });
                 return;
             }
        } else if (isBriefingCommand) {
            finalApiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = "/brief"; 
            modeForRequest = ChatModeEnum.Standard;
            responseType = 'json';
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
        
        chatActions.addMessage(activePatientId, userMessage);
        chatActions.addResponsePlaceholder(activePatientId);
        uiDispatch({ type: 'SET_LOADING', payload: true });
        uiDispatch({ type: 'SET_ERROR', payload: null });
        setUploadedFile(null);

        abortControllerRef.current = new AbortController();
        let fullResponseBuffer = '';

        try {
            const history = [...messages];
            const stream = generateResponseStream(finalApiPrompt, history, modeForRequest, { file: fileForApi, responseType, location: userLocation });
            
            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                
                const textChunk = chunk.text || '';
                fullResponseBuffer += textChunk;

                const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
                let sources: GroundingSource[] | undefined = undefined;

                if (groundingMetadata && groundingMetadata.groundingChunks) {
                    sources = groundingMetadata.groundingChunks.map(chunk => {
                        if (chunk.web) return { web: chunk.web };
                        if ((chunk as any).maps) return { maps: (chunk as any).maps };
                        return undefined;
                    }).filter(Boolean) as GroundingSource[];
                }

                chatActions.appendToLastMessage(activePatientId, textChunk, sources);
            }
        } catch (e) {
             if (e.message === "Aborted") {
                 chatActions.appendToLastMessage(activePatientId, " [Stopped]", undefined);
            } else {
                const errorMsg = `Sorry, I encountered an error.\n\n**Details:** ${getFriendlyErrorMessage(e)}`;
                chatActions.updateLastMessageContent(activePatientId, errorMsg);
            }
        } finally {
            uiDispatch({ type: 'SET_LOADING', payload: false });
            
            // --- FHIR AUTO-INGESTION PROTOCOL WITH ZOD & UNIT NORMALIZATION ---
            if (activePatientId && isLabReport(fullResponseBuffer)) {
                // Use generic to validate and infer LabReport type
                const report = parseAndValidate<LabReport>(fullResponseBuffer, LabReportSchema);
                
                if (report && report.labs) {
                    const newObs: FHIRObservation[] = report.labs.map((lab: any) => {
                         const rawVal = parseFloat(lab.value.replace(/[^0-9.-]/g, ''));
                         const rangeMatch = lab.refRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
                         
                         if (isNaN(rawVal)) return null;

                         // SAFETY: Normalize units to prevent CDSS errors
                         const normalized = NORMALIZE_UNITS(rawVal, lab.units, lab.testName);

                         const obs: FHIRObservation = {
                             resourceType: 'Observation',
                             id: uuidv4(),
                             status: 'final',
                             code: { 
                                 text: lab.testName 
                             },
                             subject: { reference: `Patient/${activePatientId}` },
                             valueQuantity: { 
                                 value: normalized.value, 
                                 unit: normalized.unit,
                                 system: 'http://unitsofmeasure.org'
                             },
                             effectiveDateTime: report.date && report.date !== 'Not Visible' ? new Date(report.date).toISOString() : new Date().toISOString(),
                             issued: new Date().toISOString()
                         };

                         if (rangeMatch) {
                             obs.referenceRange = [{
                                 low: { value: parseFloat(rangeMatch[1]), unit: lab.units, system: 'http://unitsofmeasure.org' },
                                 high: { value: parseFloat(rangeMatch[2]), unit: lab.units, system: 'http://unitsofmeasure.org' },
                                 text: lab.refRange
                             }];
                         }
                         
                         if (lab.flag && lab.flag !== 'Normal') {
                             obs.interpretation = [{ text: lab.flag }];
                         }

                         return obs;
                    }).filter(Boolean);

                    if (newObs.length > 0) {
                        clinicalActions.ingestObservations(activePatientId, newObs);
                        
                        const existingObs = useClinicalStore.getState().data[activePatientId]?.observations || [];
                        const combinedObs = [...existingObs, ...newObs];
                        
                        evaluateClinicalSafety(combinedObs).then(alerts => {
                            if (alerts.length > 0) {
                                clinicalActions.updateAlerts(activePatientId, alerts);
                            }
                        });
                    }
                } else {
                    console.warn("Lab report detected but failed validation.");
                }
            }

            abortControllerRef.current = null;
        }
    }, [messages, activePatientId, chatMode, uploadedFile, isLive, stopSession, userLocation, patientActions, chatActions, clinicalActions, uiDispatch, setUploadedFile, triggerExtraction]);

    return {
        handleSend,
        handleStop,
        handleClearChat,
        handleExportChat: useCallback(() => handleSend('/export'), [handleSend])
    };
};
