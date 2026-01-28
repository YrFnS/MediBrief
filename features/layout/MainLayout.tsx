
import React, { useState, useCallback, useEffect } from 'react';
import { ChatMode as ChatModeEnum } from '../../types';
import Header from '../../components/Header';
import MessageList from '../../components/MessageList';
import InputBar from '../../components/InputBar';
import ImageViewer from '../../components/ImageViewer';
import SidebarRoster from '../patient-roster/SidebarRoster';
import HeadsUpDisplay from '../hud/HeadsUpDisplay';
import ScribeInterface from '../scribe/ScribeInterface';
import CDSSContainer from '../cdss/CDSSContainer';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useFileDragAndDrop } from '../../hooks/useFileDragAndDrop';
import { useChatOrchestrator } from '../../hooks/useChatOrchestrator';
import { DocumentTextIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';

const MainLayout: React.FC = () => {
    // --- State & Stores ---
    const { state, dispatch, activePatient, activeMessages } = usePatientStore();
    const { uploadedFile, setUploadedFile, isDragging, clearFile, dragHandlers } = useFileDragAndDrop();
    const { globalChatMode, isLoading } = state;
    
    // --- Local UI State ---
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | undefined>(undefined);
    const [viewingImage, setViewingImage] = useState<{src: string, alt: string} | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
        if (userInput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: userInput } } });
        if (modelOutput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: modelOutput } } });
    }, [dispatch]);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession(handleLiveTurnComplete);

    useEffect(() => {
        if (liveError) dispatch({ type: 'REQUEST_FAILED', payload: liveError });
    }, [liveError, dispatch]);

    useEffect(() => {
        if (globalChatMode !== ChatModeEnum.Live && isLive) stopSession();
    }, [globalChatMode, isLive, stopSession]);

    useEffect(() => {
        if (isLive && globalChatMode !== ChatModeEnum.Live) dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Live });
    }, [isLive, globalChatMode, dispatch]);

    // --- Chat Orchestrator ---
    const { handleSend, handleStop, handleClearChat, handleExportChat } = useChatOrchestrator({
        messages: activeMessages, // Pass the ACTIVE patient's messages
        activePatientId: activePatient?.id,
        chatMode: globalChatMode,
        dispatch,
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
            className="flex h-[100dvh] font-sans overflow-hidden relative bg-slate-50 dark:bg-slate-900"
            {...dragHandlers}
        >
            {/* Overlay for Drag & Drop */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center m-4 rounded-sm animate-fade-in pointer-events-none technical-border text-blue-500 border-2 border-blue-500">
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
            
            {/* 1. Sidebar (Left) */}
            <SidebarRoster 
                isOpen={isSidebarOpen} 
                toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
            />

            {/* 2. Main Content (Right) */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                <Header
                    currentMode={globalChatMode}
                    onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                    onClearChat={handleClearChat}
                    onExportChat={handleExportChat}
                />
                
                {/* 3. Heads Up Display (HUD) */}
                {activePatient && (
                    <HeadsUpDisplay patient={activePatient} />
                )}
                
                {/* 4. CDSS Overlay */}
                <CDSSContainer />
                
                {/* CONDITIONAL RENDER: SCRIBE vs CHAT */}
                {globalChatMode === ChatModeEnum.Scribe ? (
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
                            currentMode={globalChatMode}
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
