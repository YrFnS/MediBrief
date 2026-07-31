import React, { useCallback, useEffect, useState } from 'react';
import {
    DocumentTextIcon,
    EyeIcon,
    ShieldCheckIcon,
    WifiOffIcon,
} from '../../components/icons';
import Header from '../../components/Header';
import ImageViewer from '../../components/ImageViewer';
import DisclaimerModal from '../../components/DisclaimerModal';
import { useFileDragAndDrop } from '../../hooks/useFileDragAndDrop';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useSecurityLock } from '../../hooks/useSecurityLock';
import { ChatMode as ChatModeEnum } from '../../types';
import { scrubPII } from '../../utils/piiScrubber';
import { useAuditStore } from '../audit/useAuditStore';
import CDSSContainer from '../cdss/CDSSContainer';
import InputBar from '../chat/components/InputBar';
import MessageList from '../chat/components/MessageList';
import { useChatOrchestrator } from '../chat/hooks/useChatOrchestrator';
import { useChatStore } from '../chat/stores/useChatStore';
import ClinicalCandidateReview from '../clinical-record/components/ClinicalCandidateReview';
import { createProposedAppointmentRecord } from '../clinical-record/durableActions';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import DiagnosticReportReviewWorkspace from '../diagnostic-reports/components/DiagnosticReportReviewWorkspace';
import type { DiagnosticBundleCommitResult } from '../diagnostic-reports';
import HeadsUpDisplay from '../hud/HeadsUpDisplay';
import { usePatientStore } from '../patient-management/usePatientStore';
import SidebarRoster from '../patient-roster/SidebarRoster';
import ScribeInterface from '../scribe/ScribeInterface';
import SettingsModal from '../settings/SettingsModal';
import { useSettingsStore } from '../settings/useSettingsStore';
import { useUIStore } from '../ui/UIContext';
import BioMetricBackground from './BioMetricBackground';

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

const displayRequestValue = (value: unknown): string =>
    typeof value === 'string' && value.trim()
        ? value.trim()
        : 'Unknown';

const MainLayout: React.FC = () => {
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[activePatientId],
    );

    const addMessage = useChatStore(state => state.actions.addMessage);
    const initializeChat = useChatStore(
        state => state.actions.initializeChat,
    );
    const clinicalRecordActions = useClinicalRecordStore(
        state => state.actions,
    );
    const logEvent = useAuditStore(state => state.actions.logEvent);

    const activeMessagesRaw = useChatStore(
        state => state.chats[activePatientId],
    );
    const activeMessages = activeMessagesRaw || [];

    const { uiState, uiDispatch } = useUIStore();
    const {
        uploadedFile,
        setUploadedFile,
        isDragging,
        clearFile,
        dragHandlers,
    } = useFileDragAndDrop();
    const { chatMode, isLoading, pendingLabReport } = uiState;

    const [viewingImage, setViewingImage] = useState<{
        src: string;
        alt: string;
    } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const isOnline = useOnlineStatus();

    const { isLocked, isBlurred, unlock } = useSecurityLock();
    const { geminiApiKey, openRouterApiKey } = useSettingsStore();
    const hasAnyApiKey = !!(
        process.env.API_KEY
        || geminiApiKey
        || openRouterApiKey
    );

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLiveTurnComplete = useCallback((
        userInput: string,
        modelOutput: string,
    ) => {
        if (userInput) {
            addMessage(activePatientId, {
                role: 'user',
                content: scrubPII(userInput),
            });
        }
        if (modelOutput) {
            addMessage(activePatientId, {
                role: 'model',
                content: modelOutput,
            });
        }
    }, [addMessage, activePatientId]);

    const handleLiveToolCall = useCallback((
        toolName: string,
        args: Record<string, unknown>,
    ) => {
        if (toolName !== 'scheduleAppointment') return;

        clinicalRecordActions.initializePatientRecord({
            patientId: activePatientId,
            displayName: activePatient?.name
                || `Patient ${activePatientId.slice(0, 4)}`,
        });
        const { record, warnings } = createProposedAppointmentRecord({
            patientId: activePatientId,
            date: args.date,
            time: args.time,
            notes: args.notes,
            createdBy: 'Local user',
        });
        const result = clinicalRecordActions.addResource(record);

        if (!result.ok) {
            addMessage(activePatientId, {
                role: 'model',
                content: `⚠️ **Appointment request not saved**\n${result.message || 'The local appointment proposal could not be created.'}`,
            });
            return;
        }

        logEvent(
            'APPOINTMENT_PROPOSAL_CREATED',
            activePatientId,
            'Saved a proposed appointment request to the structured patient record.',
            'USER',
            {
                appointmentId: record.id,
                requestedDate: displayRequestValue(args.date),
                requestedTime: displayRequestValue(args.time),
                warnings,
            },
        );

        const warningText = warnings.length > 0
            ? `\n\n**Needs review:**\n${warnings.map(warning => `- ${warning}`).join('\n')}`
            : '';
        const content = `📅 **Appointment request saved**\n\n**Requested date:** ${displayRequestValue(args.date)}\n**Requested time:** ${displayRequestValue(args.time)}\n${args.notes ? `**Notes:** ${displayRequestValue(args.notes)}\n` : ''}**Status:** Proposed — not booked\n\nThis local record does not confirm that a clinic accepted or scheduled the appointment.${warningText}\n\n**Record ID:** ${record.id}`;
        addMessage(activePatientId, {
            role: 'model',
            content,
            displayContent: content,
        });
    }, [
        activePatient,
        activePatientId,
        addMessage,
        clinicalRecordActions,
        logEvent,
    ]);

    const {
        isLive,
        transcript,
        startSession,
        stopSession,
        error: liveError,
    } = useLiveSession({
        onTurnComplete: handleLiveTurnComplete,
        onToolCall: handleLiveToolCall,
    });

    useEffect(() => {
        if (liveError) {
            addMessage(activePatientId, {
                role: 'model',
                content: `Error: ${liveError}`,
            });
            uiDispatch({ type: 'SET_ERROR', payload: liveError });
        }
    }, [liveError, addMessage, activePatientId, uiDispatch]);

    useEffect(() => {
        if (chatMode !== ChatModeEnum.Live && isLive) stopSession();
    }, [chatMode, isLive, stopSession]);

    useEffect(() => {
        if (isLive && chatMode !== ChatModeEnum.Live) {
            uiDispatch({
                type: 'SET_CHAT_MODE',
                payload: ChatModeEnum.Live,
            });
        }
    }, [isLive, chatMode, uiDispatch]);

    useEffect(() => {
        if (!isOnline && isLive) {
            stopSession();
            uiDispatch({
                type: 'SET_ERROR',
                payload: 'Network Connection Lost. Live session terminated.',
            });
        }
    }, [isOnline, isLive, stopSession, uiDispatch]);

    useEffect(() => {
        if (activePatientId) initializeChat(activePatientId);
    }, [activePatientId, initializeChat]);

    const {
        handleSend,
        handleStop,
        handleClearChat,
        handleExportChat,
    } = useChatOrchestrator({
        messages: activeMessages,
        activePatientId,
        activePatient,
        chatMode,
        uiDispatch,
        uploadedFile,
        setUploadedFile,
        isLive,
        stopSession,
        clearFile,
    });

    const handleViewImage = useCallback((src: string, alt: string) => {
        setViewingImage({ src, alt });
    }, []);

    const toggleLiveSession = useCallback(
        () => isLive
            ? stopSession()
            : startSession(activeMessages),
        [isLive, stopSession, startSession, activeMessages],
    );

    const handleDiagnosticReportSaved = useCallback((
        result: DiagnosticBundleCommitResult,
    ) => {
        uiDispatch({ type: 'SET_PENDING_LAB_REPORT', payload: null });
        addMessage(activePatientId, {
            role: 'model',
            content: `✅ **Reviewed diagnostic report saved**\n${result.message || 'The reviewed report graph was saved to the structured patient record.'}\n\nThe report, included results, linked specimens, and source relationship were saved together. Excluded extracted rows remain in the report review history. No automated diagnosis, order, or treatment action was performed.`,
        });
    }, [activePatientId, addMessage, uiDispatch]);

    const handleCancelVerification = useCallback(() => {
        uiDispatch({ type: 'SET_PENDING_LAB_REPORT', payload: null });
        addMessage(activePatientId, {
            role: 'model',
            content: '🚫 **Diagnostic report review discarded**\nNo report, result, specimen, or source relationship was added to the clinical record.',
        });
    }, [activePatientId, addMessage, uiDispatch]);

    if (isLocked) {
        return (
            <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 text-white">
                <div className="bg-grid-pattern absolute inset-0 opacity-10" />
                <div className="technical-border z-10 w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
                    <ShieldCheckIcon className="mx-auto mb-4 h-12 w-12 animate-pulse text-blue-500" />
                    <h2 className="mb-2 text-xl font-display font-bold uppercase tracking-widest">
                        Session Locked
                    </h2>
                    <p className="mb-6 text-sm font-mono text-slate-400">
                        Security Timeout (15m)
                    </p>
                    <button
                        onClick={unlock}
                        className="w-full rounded-sm bg-blue-600 py-3 font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-500"
                    >
                        Resume Session
                    </button>
                </div>
            </div>
        );
    }

    if (!hasAnyApiKey && !isSettingsOpen) {
        return (
            <div className="flex h-[100dvh] flex-col items-center justify-center bg-slate-100 p-4 font-sans text-slate-800">
                <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
                    <div className="mb-4 animate-bounce text-5xl text-amber-500">🔑</div>
                    <h1 className="mb-3 text-2xl font-display font-bold uppercase tracking-tight text-slate-900">
                        AI Key Required
                    </h1>
                    <p className="mb-6 text-sm leading-relaxed text-slate-600">
                        To activate the Clinical Intelligence Layer, provide a Gemini or OpenRouter API key.
                    </p>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full rounded-xl bg-blue-600 py-4 font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500"
                    >
                        Configure Protocol
                    </button>
                    <p className="mt-6 text-[10px] font-mono italic text-slate-400">
                        Keys are stored locally in your browser's encrypted vault.
                    </p>
                </div>
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                />
            </div>
        );
    }

    return (
        <div
            className="relative flex h-[100dvh] overflow-hidden bg-slate-50 font-sans text-slate-900 transition-colors duration-500"
            {...dragHandlers}
        >
            <BioMetricBackground />
            <DisclaimerModal />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            {pendingLabReport && (
                <DiagnosticReportReviewWorkspace
                    key={pendingLabReport.detectedAt}
                    patientId={activePatientId}
                    pending={pendingLabReport}
                    onSaved={handleDiagnosticReportSaved}
                    onCancel={handleCancelVerification}
                />
            )}

            <div className={`relative flex h-full w-full flex-1 transition-all duration-700 ${isBlurred
                ? 'pointer-events-none scale-[0.99] opacity-60 blur-md grayscale'
                : ''
            }`}>
                <SidebarRoster
                    isOpen={isSidebarOpen}
                    toggle={() => setIsSidebarOpen(!isSidebarOpen)}
                />

                <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                    <Header
                        currentMode={chatMode}
                        onModeChange={mode => uiDispatch({
                            type: 'SET_CHAT_MODE',
                            payload: mode,
                        })}
                        onClearChat={handleClearChat}
                        onExportChat={handleExportChat}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />

                    {!isOnline && (
                        <div className="z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1 text-center text-xs font-bold uppercase tracking-widest text-white shadow-sm animate-slide-up">
                            <WifiOffIcon className="h-3.5 w-3.5" />
                            <span>System Offline - View Only Mode</span>
                        </div>
                    )}

                    {activePatient && (
                        <>
                            <HeadsUpDisplay patient={activePatient} />
                            <ClinicalCandidateReview patientId={activePatient.id} />
                        </>
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

            <div className={`pointer-events-none absolute inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 ${isBlurred ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/90 px-8 py-4 text-sm font-mono uppercase tracking-widest text-white shadow-2xl animate-slide-up">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <EyeIcon className="h-4 w-4 text-emerald-500" />
                    <span>Privacy Shield Active</span>
                </div>
            </div>

            {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-50 m-4 flex items-center justify-center rounded-xl border-2 border-blue-500/50 bg-slate-900/90 shadow-[0_0_50px_rgba(59,130,246,0.3)] backdrop-blur-sm animate-fade-in">
                    <div className="flex animate-pulse flex-col items-center text-blue-400">
                        <DocumentTextIcon className="mb-6 h-20 w-20" />
                        <h2 className="text-3xl font-display font-bold tracking-tight">
                            DATA INGESTION PROTOCOL
                        </h2>
                        <p className="mt-2 text-sm font-mono uppercase tracking-widest opacity-70">
                            Release to initialize scan
                        </p>
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
