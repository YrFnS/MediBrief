
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMode as ChatModeEnum } from '../../types';
import Header from '../../components/Header';
import MessageList from '../../components/MessageList';
import InputBar from '../../components/InputBar';
import ImageViewer from '../../components/ImageViewer';
import SidebarRoster from '../patient-roster/SidebarRoster';
import HeadsUpDisplay from '../hud/HeadsUpDisplay';
import ScribeInterface from '../scribe/ScribeInterface';
import CDSSContainer from '../cdss/CDSSContainer';
import BioMetricBackground from './BioMetricBackground';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useFileDragAndDrop } from '../../hooks/useFileDragAndDrop';
import { useChatOrchestrator } from '../../hooks/useChatOrchestrator';
import { DocumentTextIcon, ShieldCheckIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useUIStore } from '../ui/UIContext';

// --- IDLE TIMER CONSTANTS ---
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 Minutes

const MainLayout: React.FC = () => {
    // --- Stores ---
    const { state: patientState, dispatch: patientDispatch, activePatient, activeMessages } = usePatientStore();
    const { uiState, uiDispatch } = useUIStore();
    
    // --- UI State ---
    const { uploadedFile, setUploadedFile, isDragging, clearFile, dragHandlers } = useFileDragAndDrop();
    const { chatMode, isLoading } = uiState;
    
    // --- Local UI State ---
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | undefined>(undefined);
    const [viewingImage, setViewingImage] = useState<{src: string, alt: string} | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const lastActivityRef = useRef(Date.now());

    // --- IDLE LOCK LOGIC ---
    useEffect(() => {
        const resetTimer = () => {
            lastActivityRef.current = Date.now();
        };

        const checkIdle = () => {
            if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT_MS) {
                setIsLocked(true);
            }
        };

        // Events to track activity
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('touchstart', resetTimer);
        window.addEventListener('scroll', resetTimer);
        
        // Check interval
        const intervalId = setInterval(checkIdle, 10000); // Check every 10s

        return () => {
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('touchstart', resetTimer);
            window.removeEventListener('scroll', resetTimer);
            clearInterval(intervalId);
        };
    }, []);

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
        if (userInput) patientDispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: userInput } } });
        if (modelOutput) patientDispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: modelOutput } } });
    }, [patientDispatch]);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession(handleLiveTurnComplete);

    useEffect(() => {
        if (liveError) {
            // Log error to chat
            patientDispatch({ type: 'REQUEST_FAILED', payload: liveError });
            // Notify UI (optional, usually handled by toast/component state)
            uiDispatch({ type: 'SET_ERROR', payload: liveError });
        }
    }, [liveError, patientDispatch, uiDispatch]);

    useEffect(() => {
        if (chatMode !== ChatModeEnum.Live && isLive) stopSession();
    }, [chatMode, isLive, stopSession]);

    useEffect(() => {
        if (isLive && chatMode !== ChatModeEnum.Live) uiDispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Live });
    }, [isLive, chatMode, uiDispatch]);

    // --- Chat Orchestrator ---
    const { handleSend, handleStop, handleClearChat, handleExportChat } = useChatOrchestrator({
        messages: activeMessages, 
        activePatientId: activePatient?.id,
        activePatient: activePatient, 
        chatMode: chatMode,
        dispatch: patientDispatch,
        uiDispatch: uiDispatch, // Pass UI dispatch
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

    // --- LOCK SCREEN UI ---
    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
                <div className="z-10 bg-slate-900 border border-slate-700 p-8 rounded-md shadow-2xl max-w-sm w-full text-center technical-border">
                    <ShieldCheckIcon className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-xl font-display font-bold uppercase tracking-widest mb-2">Session Locked</h2>
                    <p className="text-sm text-slate-400 font-mono mb-6">Security Timeout Triggered (5m)</p>
                    <button 
                        onClick={() => {
                            lastActivityRef.current = Date.now();
                            setIsLocked(false);
                        }}
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
            <div className="flex flex-col items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-xl font-bold mb-2">API Key Missing</h1>
                    <p className="text-slate-600 dark:text-slate-400">Environment variable <code>API_KEY</code> is required.</p>
                </div>
            </div>
         );
    }

    return (
        <div 
            className="flex h-[100dvh] font-sans overflow-hidden relative text-slate-900 dark:text-slate-100"
            {...dragHandlers}
        >
            {/* --- ATMOSPHERIC BACKGROUND SYSTEM --- */}
            <BioMetricBackground />

            {/* Overlay for Drag & Drop */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center m-4 rounded-xl animate-fade-in pointer-events-none border-2 border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
                    <div className="flex flex-col items-center text-blue-400 animate-pulse">
                        <DocumentTextIcon className="w-20 h-20 mb-6" />
                        <h2 className="text-3xl font-display font-bold tracking-tight">DATA INGESTION PROTOCOL</h2>
                        <p className="font-mono text-sm mt-2 opacity-70 uppercase tracking-widest">Release to initialize scan</p>
                    </div>
                </div>
            )}
            
            {/* Image Modal */}
            {viewingImage && (
                <ImageViewer 
                    src={viewingImage.src} 
                    alt={viewingImage.alt} 
                    onClose={() => setViewingImage(null)} 
                />
            )}

            {/* --- LAYOUT STRUCTURE --- */}
            
            {/* 1. Sidebar (Left) - Glassmorphic */}
            <SidebarRoster 
                isOpen={isSidebarOpen} 
                toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
            />

            {/* 2. Main Content (Right) */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                <Header
                    currentMode={chatMode}
                    onModeChange={(mode) => uiDispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                    onClearChat={handleClearChat}
                    onExportChat={handleExportChat}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />
                
                {/* 3. Heads Up Display (HUD) */}
                {activePatient && (
                    <HeadsUpDisplay patient={activePatient} />
                )}
                
                {/* 4. CDSS Overlay */}
                <CDSSContainer />
                
                {/* CONDITIONAL RENDER: SCRIBE vs CHAT */}
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
                            isLoading={isLoading}
                            currentMode={chatMode}
                            toggleLiveSession={toggleLiveSession}
                            isLiveSessionActive={isLive}
                            onStop={handleStop}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default MainLayout;
