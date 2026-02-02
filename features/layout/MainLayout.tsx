
import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMode as ChatModeEnum } from '../../types';
import Header from '../../components/Header';
import MessageList from '../chat/components/MessageList';
import InputBar from '../chat/components/InputBar';
import ImageViewer from '../../components/ImageViewer';
import SidebarRoster from '../patient-roster/SidebarRoster';
import HeadsUpDisplay from '../hud/HeadsUpDisplay';
import ScribeInterface from '../scribe/ScribeInterface';
import CDSSContainer from '../cdss/CDSSContainer';
import BioMetricBackground from './BioMetricBackground';
import DisclaimerModal from '../../components/DisclaimerModal';
import LabVerificationModal from '../clinical-analysis/components/LabVerificationModal';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useFileDragAndDrop } from '../../hooks/useFileDragAndDrop';
import { useChatOrchestrator } from '../chat/hooks/useChatOrchestrator';
import { DocumentTextIcon, ShieldCheckIcon, EyeIcon, WifiOffIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useUIStore } from '../ui/UIContext';
import { scrubPII } from '../../utils/piiScrubber';
import { useSecurityLock } from '../../hooks/useSecurityLock';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { useAuditStore } from '../audit/useAuditStore';
import { LabReport } from '../chat/schemas';
import { FHIRObservation } from '../fhir/types';
import { normalizeValue } from '../fhir/unitService';
import { evaluateClinicalSafety } from '../cdss/rulesEngine';

// Simple hook for online status
const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    return isOnline;
};

const MainLayout: React.FC = () => {
    // --- STORES ---
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(state => state.patients[activePatientId]);
    const chatActions = useChatStore(state => state.actions);
    const clinicalActions = useClinicalStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    
    // Select messages from the specialized Chat Store
    const activeMessages = useChatStore(state => state.chats[activePatientId] || []);

    const { uiState, uiDispatch } = useUIStore();
    
    // --- UI State ---
    const { uploadedFile, setUploadedFile, isDragging, clearFile, dragHandlers } = useFileDragAndDrop();
    const { chatMode, isLoading, pendingLabReport } = uiState;
    
    // --- Local UI State ---
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | undefined>(undefined);
    const [viewingImage, setViewingImage] = useState<{src: string, alt: string} | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const isOnline = useOnlineStatus();
    
    // Security State
    const { isLocked, isBlurred, unlock } = useSecurityLock();

    // Responsive Sidebar Check
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Geolocation ---
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
                (err) => console.debug("Location access denied or failed:", err.message)
            );
        }
    }, []);

    // --- Live Session Integration ---
    const handleLiveTurnComplete = useCallback((userInput: string, modelOutput: string) => {
        if (userInput) {
            const scrubbedInput = scrubPII(userInput);
            chatActions.addMessage(activePatientId, { role: 'user', content: scrubbedInput });
        }
        if (modelOutput) {
            chatActions.addMessage(activePatientId, { role: 'model', content: modelOutput });
        }
    }, [chatActions, activePatientId]);

    const handleLiveToolCall = useCallback((toolName: string, args: any) => {
        if (toolName === 'scheduleAppointment') {
            const { date, time, notes } = args;
            const content = `✅ **ACTION EXECUTED: Appointment Scheduled**\n\n**Date:** ${date}\n**Time:** ${time}\n${notes ? `**Notes:** ${notes}` : ''}`;
            chatActions.addMessage(activePatientId, { 
                role: 'model', 
                content: content,
                displayContent: content
            });
        }
    }, [chatActions, activePatientId]);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession({
        onTurnComplete: handleLiveTurnComplete,
        onToolCall: handleLiveToolCall
    });

    useEffect(() => {
        if (liveError) {
            chatActions.addMessage(activePatientId, { role: 'model', content: `Error: ${liveError}` });
            uiDispatch({ type: 'SET_ERROR', payload: liveError });
        }
    }, [liveError, chatActions, activePatientId, uiDispatch]);

    useEffect(() => {
        if (chatMode !== ChatModeEnum.Live && isLive) stopSession();
    }, [chatMode, isLive, stopSession]);

    useEffect(() => {
        if (isLive && chatMode !== ChatModeEnum.Live) uiDispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Live });
    }, [isLive, chatMode, uiDispatch]);

    // Force stop live session if offline
    useEffect(() => {
        if (!isOnline && isLive) {
            stopSession();
            uiDispatch({ type: 'SET_ERROR', payload: "Network Connection Lost. Live session terminated." });
        }
    }, [isOnline, isLive, stopSession, uiDispatch]);

    // --- Chat Orchestrator ---
    const { handleSend, handleStop, handleClearChat, handleExportChat } = useChatOrchestrator({
        messages: activeMessages, 
        activePatientId: activePatientId,
        activePatient: activePatient, 
        chatMode: chatMode,
        uiDispatch: uiDispatch, 
        uploadedFile,
        setUploadedFile,
        isLive,
        stopSession,
        userLocation,
        clearFile
    });

    const handleViewImage = useCallback((src: string, alt: string) => {
        setViewingImage({ src, alt });
    }, []);

    const toggleLiveSession = useCallback(() => isLive ? stopSession() : startSession(activeMessages), [isLive, stopSession, startSession, activeMessages]);

    // --- Lab Verification Logic ---
    const handleLabVerification = useCallback((verifiedReport: LabReport) => {
        // This is the CRITICAL safety step. Data only enters here after human verification.
        
        if (!verifiedReport.labs) return;

        const newObs: FHIRObservation[] = verifiedReport.labs.map((lab: any) => {
             const rawVal = parseFloat(lab.value.replace(/[^0-9.-]/g, ''));
             const rangeMatch = lab.refRange ? lab.refRange.match(/([\d.]+)\s*-\s*([\d.]+)/) : null;
             
             if (isNaN(rawVal)) return null;

             // Normalize units using the VERIFIED data (not AI hallucinations)
             const normalized = normalizeValue(rawVal, lab.units || '', lab.testName);

             const obs: FHIRObservation = {
                 resourceType: 'Observation',
                 id: uuidv4(),
                 status: 'final',
                 code: { text: lab.testName },
                 subject: { reference: `Patient/${activePatientId}` },
                 valueQuantity: { 
                     value: normalized.value, 
                     unit: normalized.unit,
                     system: 'http://unitsofmeasure.org'
                 },
                 effectiveDateTime: verifiedReport.date && verifiedReport.date !== 'Not Visible' ? new Date(verifiedReport.date).toISOString() : new Date().toISOString(),
                 issued: new Date().toISOString()
             };

             // Attach warnings if still present after human edit (rare but possible for legit critical values)
             if (normalized.warning) {
                 obs.note = [{ text: `⚠️ DATA QUALITY: ${normalized.warning}` }];
                 obs.interpretation = [{ text: 'Data Quality Issue' }];
             } else if (lab.flag && lab.flag !== 'Normal') {
                 obs.interpretation = [{ text: lab.flag }];
             }

             if (rangeMatch) {
                 obs.referenceRange = [{
                     low: { value: parseFloat(rangeMatch[1]), unit: lab.units, system: 'http://unitsofmeasure.org' },
                     high: { value: parseFloat(rangeMatch[2]), unit: lab.units, system: 'http://unitsofmeasure.org' },
                     text: lab.refRange
                 }];
             }

             return obs;
        }).filter(Boolean) as FHIRObservation[];

        if (newObs.length > 0) {
            // 1. Commit to Clinical Store
            clinicalActions.ingestObservations(activePatientId, newObs);
            
            // 2. Audit the Verification
            auditActions.logEvent(
                'SYSTEM_INIT', // Reusing type, ideally add 'DATA_VERIFICATION' type
                activePatientId, 
                `User verified and ingested ${newObs.length} lab observations.`,
                'USER'
            );

            // 3. Run CDSS Safety Checks
            const existingObs = useClinicalStore.getState().data[activePatientId]?.observations || [];
            const combinedObs = [...existingObs, ...newObs];
            
            evaluateClinicalSafety(combinedObs).then(alerts => {
                if (alerts.length > 0) {
                    clinicalActions.updateAlerts(activePatientId, alerts);
                    auditActions.logEvent(
                        'ALERT_TRIGGERED', 
                        activePatientId, 
                        `Generated ${alerts.length} safety alerts from VERIFIED lab data`, 
                        'SYSTEM'
                    );
                }
            });
            
            // 4. Notify User via Chat
            chatActions.addMessage(activePatientId, {
                role: 'model',
                content: `✅ **Data Verified & Ingested**\nSuccessfully added ${newObs.length} lab results to the clinical record. Safety protocols active.`
            });
        }

        // Close Modal
        uiDispatch({ type: 'SET_PENDING_LAB_REPORT', payload: null });

    }, [activePatientId, clinicalActions, chatActions, auditActions, uiDispatch]);

    const handleCancelVerification = useCallback(() => {
        uiDispatch({ type: 'SET_PENDING_LAB_REPORT', payload: null });
        chatActions.addMessage(activePatientId, {
            role: 'model',
            content: `🚫 **Ingestion Cancelled**\nLab data was discarded by user.`
        });
    }, [activePatientId, chatActions, uiDispatch]);


    // --- LOCK SCREEN UI ---
    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
                <div className="z-10 bg-slate-900 border border-slate-700 p-8 rounded-md shadow-2xl max-w-sm w-full text-center technical-border">
                    <ShieldCheckIcon className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-xl font-display font-bold uppercase tracking-widest mb-2">Session Locked</h2>
                    <p className="text-sm text-slate-400 font-mono mb-6">Security Timeout (15m)</p>
                    <button 
                        onClick={unlock}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest rounded-sm transition-colors"
                    >
                        Resume Session
                    </button>
                </div>
            </div>
        );
    }

    if (!process.env.API_KEY) {
         return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-100 text-slate-800 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-xl font-bold mb-2">API Key Missing</h1>
                    <p className="text-slate-600">Environment variable <code>API_KEY</code> is required.</p>
                </div>
            </div>
         );
    }

    return (
        <div 
            className="flex h-[100dvh] font-sans overflow-hidden relative text-slate-900 bg-slate-50 transition-colors duration-500"
            {...dragHandlers}
        >
            <BioMetricBackground />
            
            <DisclaimerModal />

            {/* QUARANTINE MODAL (Verification) */}
            {pendingLabReport && (
                <LabVerificationModal 
                    report={pendingLabReport} 
                    onConfirm={handleLabVerification} 
                    onCancel={handleCancelVerification} 
                />
            )}

            {/* CONTENT WRAPPER */}
            <div className={`flex flex-1 w-full h-full relative transition-all duration-700 ${isBlurred ? 'blur-md opacity-60 grayscale scale-[0.99] pointer-events-none' : ''}`}>
                <SidebarRoster 
                    isOpen={isSidebarOpen} 
                    toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
                />

                <div className="flex-1 flex flex-col min-w-0 relative z-10">
                    <Header
                        currentMode={chatMode}
                        onModeChange={(mode) => uiDispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                        onClearChat={handleClearChat}
                        onExportChat={handleExportChat}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    />
                    
                    {/* OFFLINE BANNER */}
                    {!isOnline && (
                        <div className="bg-amber-500 text-white px-4 py-1 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 animate-slide-up shadow-sm z-50">
                            <WifiOffIcon className="w-3.5 h-3.5" />
                            <span>System Offline - View Only Mode</span>
                        </div>
                    )}
                    
                    {activePatient && (
                        <HeadsUpDisplay patient={activePatient} />
                    )}
                    
                    <CDSSContainer />
                    
                    {chatMode === ChatModeEnum.Scribe ? (
                        <ScribeInterface />
                    ) : (
                        <>
                            <MessageList 
                                messages={activeMessages} 
                                isLoading={isLoading} 
                                isLive={isLive} 
                                liveTranscript={transcript} 
                                onViewImage={handleViewImage}
                            />
                            
                            <InputBar
                                onSend={handleSend}
                                onClearFile={clearFile}
                                setUploadedFile={setUploadedFile}
                                uploadedFile={uploadedFile}
                                isLoading={isLoading || !isOnline}
                                currentMode={chatMode}
                                toggleLiveSession={toggleLiveSession}
                                isLiveSessionActive={isLive}
                                onStop={handleStop}
                                onViewImage={handleViewImage} 
                            />
                        </>
                    )}
                </div>
            </div>

            {/* PRIVACY SHIELD OVERLAY */}
            <div className={`absolute inset-0 z-[60] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${isBlurred ? 'opacity-100' : 'opacity-0'}`}>
                 <div className="bg-slate-900/90 text-white px-8 py-4 rounded-full font-mono text-sm uppercase tracking-widest shadow-2xl border border-white/10 flex items-center gap-3 animate-slide-up">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <EyeIcon className="w-4 h-4 text-emerald-500" />
                    <span>Privacy Shield Active</span>
                 </div>
            </div>

            {isDragging && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center m-4 rounded-xl animate-fade-in pointer-events-none border-2 border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                    <div className="flex flex-col items-center text-blue-400 animate-pulse">
                        <DocumentTextIcon className="w-20 h-20 mb-6" />
                        <h2 className="text-3xl font-display font-bold tracking-tight">DATA INGESTION PROTOCOL</h2>
                        <p className="font-mono text-sm mt-2 opacity-70 uppercase tracking-widest">Release to initialize scan</p>
                    </div>
                </div>
            )}
            
            {viewingImage && (
                <ImageViewer 
                    src={viewingImage.src} 
                    alt={viewingImage.alt} 
                    onClose={() => setViewingImage(null)} 
                />
            )}
        </div>
    );
};

export default MainLayout;
