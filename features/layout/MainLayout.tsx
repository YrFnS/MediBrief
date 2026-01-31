
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { useLiveSession } from '../../hooks/useLiveSession';
import { useFileDragAndDrop } from '../../hooks/useFileDragAndDrop';
import { useChatOrchestrator } from '../chat/hooks/useChatOrchestrator';
import { DocumentTextIcon, ShieldCheckIcon, EyeIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useUIStore } from '../ui/UIContext';

// --- IDLE TIMER CONSTANTS ---
const PRIVACY_BLUR_MS = 2 * 60 * 1000; // 2 Minutes -> Blur
const AUTO_LOCK_MS = 15 * 60 * 1000;   // 15 Minutes -> Full Lock

const MainLayout: React.FC = () => {
    // --- STORES ---
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(state => state.patients[activePatientId]);
    const chatActions = useChatStore(state => state.actions);
    
    // Select messages from the specialized Chat Store
    // This is the key optimization: changing clinical data won't re-render MessageList parent
    const activeMessages = useChatStore(state => state.chats[activePatientId] || []);

    const { uiState, uiDispatch } = useUIStore();
    
    // --- UI State ---
    const { uploadedFile, setUploadedFile, isDragging, clearFile, dragHandlers } = useFileDragAndDrop();
    const { chatMode, isLoading } = uiState;
    
    // --- Local UI State ---
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | undefined>(undefined);
    const [viewingImage, setViewingImage] = useState<{src: string, alt: string} | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // Security State
    const [isLocked, setIsLocked] = useState(false);
    const [isBlurred, setIsBlurred] = useState(false);
    const lastActivityRef = useRef(Date.now());

    // --- IDLE LOCK LOGIC ---
    useEffect(() => {
        const resetTimer = () => {
            lastActivityRef.current = Date.now();
            setIsBlurred(prev => prev ? false : prev); // Optimistic unblur
        };

        const checkIdle = () => {
            const idleTime = Date.now() - lastActivityRef.current;
            
            if (idleTime > AUTO_LOCK_MS) {
                setIsLocked(true);
            } else if (idleTime > PRIVACY_BLUR_MS) {
                setIsBlurred(true);
            }
        };

        // Events to track activity
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('touchstart', resetTimer);
        window.addEventListener('scroll', resetTimer);
        
        // Check interval
        const intervalId = setInterval(checkIdle, 5000); // Check every 5s

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
        if (userInput) chatActions.addMessage(activePatientId, { role: 'user', content: userInput });
        if (modelOutput) chatActions.addMessage(activePatientId, { role: 'model', content: modelOutput });
    }, [chatActions, activePatientId]);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession(handleLiveTurnComplete);

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

    // --- LOCK SCREEN UI (Full Security) ---
    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
                <div className="z-10 bg-slate-900 border border-slate-700 p-8 rounded-md shadow-2xl max-w-sm w-full text-center technical-border">
                    <ShieldCheckIcon className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-xl font-display font-bold uppercase tracking-widest mb-2">Session Locked</h2>
                    <p className="text-sm text-slate-400 font-mono mb-6">Security Timeout (15m)</p>
                    <button 
                        onClick={() => {
                            lastActivityRef.current = Date.now();
                            setIsLocked(false);
                            setIsBlurred(false);
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
            <BioMetricBackground />

            {/* CONTENT WRAPPER: Applied Blur Filter here */}
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

            {/* PRIVACY SHIELD OVERLAY (Visible only when blurred) */}
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
