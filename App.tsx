
import React, { useCallback, useEffect, useState } from 'react';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import SettingsModal from './components/SettingsModal';
import { useLiveSession } from './hooks/useLiveSession';
import { useAppState } from './hooks/useAppState';
import { useFileHandler } from './hooks/useFileHandler';
import { useConnectionSettings } from './hooks/useConnectionSettings';
import { useChatController } from './hooks/useChatController';
import { DocumentTextIcon, KeyIcon } from './components/icons';

const App: React.FC = () => {
    // 1. App State (Reducer + Persistence)
    const { state, dispatch } = useAppState();
    const { messages, isLoading, chatMode } = state;

    // 2. Connection Settings (API Key / OAuth)
    const {
        isSettingsOpen, setIsSettingsOpen,
        customApiKey, handleSaveCustomKey,
        hasEnvKey, hasValidConnection,
        isOAuthAuthenticated, oauthUserEmail,
        handleOAuthLogin, handleOAuthLogout
    } = useConnectionSettings();

    // 3. File Handler (Drag & Drop, Uploads)
    const {
        uploadedFile, setUploadedFile, clearFile,
        isDragging, handleDragOver, handleDragLeave, handleDrop
    } = useFileHandler();

    // 4. Geolocation (Simple state, kept here for now)
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | undefined>(undefined);
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                (err) => console.debug("Location access denied or failed:", err.message)
            );
        }
    }, []);

    // 5. Live Session
    const handleLiveTurnComplete = useCallback((userInput: string, modelOutput: string) => {
        if (userInput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: userInput } } });
        if (modelOutput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: modelOutput } } });
    }, [dispatch]);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession(handleLiveTurnComplete);

    useEffect(() => {
        if (liveError) dispatch({ type: 'REQUEST_FAILED', payload: liveError });
    }, [liveError, dispatch]);

    // 6. Chat Controller (Core Logic)
    const { handleSend, handleStop, handleExportChat, toggleLiveSession } = useChatController({
        messages,
        chatMode,
        dispatch,
        uploadedFile,
        setUploadedFile,
        customApiKey,
        userLocation,
        isLive,
        stopSession,
        startSession
    });

    // 7. Sync Chat Mode <-> Live Session
    useEffect(() => {
        if (chatMode !== ChatModeEnum.Live && isLive) {
            stopSession();
        }
    }, [chatMode, isLive, stopSession]);

    useEffect(() => {
        if (isLive && chatMode !== ChatModeEnum.Live) {
            dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Live });
        }
    }, [isLive, chatMode, dispatch]);

    // --- SETUP SCREEN (Blocking) ---
    if (!hasValidConnection) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md text-center">
                    <div className="text-blue-500 text-5xl mb-4">🔑</div>
                    <h1 className="text-xl font-bold mb-2">Connect MediBrief</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        To access the medical assistant, please connect your Google Cloud account or provide an API key.
                    </p>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-blue-500/30"
                    >
                        <KeyIcon className="w-5 h-5" />
                        Configure Connection
                    </button>
                    <SettingsModal
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        isOAuthAuthenticated={isOAuthAuthenticated}
                        oauthUserEmail={oauthUserEmail}
                        onOAuthLogin={handleOAuthLogin}
                        onOAuthLogout={handleOAuthLogout}
                        customApiKey={customApiKey}
                        onSaveCustomKey={handleSaveCustomKey}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col h-[100dvh] font-sans overflow-hidden relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                isOAuthAuthenticated={isOAuthAuthenticated}
                oauthUserEmail={oauthUserEmail}
                onOAuthLogin={handleOAuthLogin}
                onOAuthLogout={handleOAuthLogout}
                customApiKey={customApiKey}
                onSaveCustomKey={handleSaveCustomKey}
            />

            {isDragging && (
                <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-xl animate-pulse pointer-events-none">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl flex flex-col items-center text-blue-500">
                        <DocumentTextIcon className="w-16 h-16 mb-4" />
                        <h2 className="text-2xl font-bold">Drop Medical Records Here</h2>
                        <p className="text-slate-500 mt-2">PDF, Images (X-Rays, EKG), or Text</p>
                    </div>
                </div>
            )}

            <Header
                currentMode={chatMode}
                onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                onClearChat={() => dispatch({ type: 'RESET_CHAT' })}
                onExportChat={handleExportChat}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />
            <MessageList messages={messages} isLoading={isLoading} isLive={isLive} liveTranscript={transcript} />
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
        </div>
    );
};

export default App;
