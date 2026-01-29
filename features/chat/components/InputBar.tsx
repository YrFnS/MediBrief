
import React, { useState, useRef, useCallback, KeyboardEvent, useLayoutEffect, useEffect } from 'react';
import type { UploadedFile, ChatMode } from '../../../types';
import { ChatMode as ChatModeEnum } from '../../../types';
import { PaperclipIcon, SendIcon, XCircleIcon, BriefingIcon, UserIcon, DrugsIcon, DownloadIcon, DocumentTextIcon, MicrophoneIcon, CameraIcon, LiveIcon, StopIcon, BodyIcon } from '../../../components/icons';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import BodyMap from '../../../components/BodyMap';
import { useFileDragAndDrop } from '../../../hooks/useFileDragAndDrop';

interface InputBarProps {
    onSend: (prompt: string) => void;
    onClearFile: () => void;
    setUploadedFile: (file: UploadedFile | null) => void;
    isLoading: boolean;
    currentMode: ChatMode;
    uploadedFile: UploadedFile | null;
    toggleLiveSession: () => void;
    isLiveSessionActive: boolean;
    onStop?: () => void;
}

const QUICK_COMMANDS = [
  { command: '/brief', description: 'Shift briefing', icon: BriefingIcon },
  { command: '/patient ', description: 'Patient summary', icon: UserIcon },
  { command: '/drugs ', description: 'Check drugs', icon: DrugsIcon },
  { command: '/export', description: 'Export PDF', icon: DownloadIcon },
];

const InputBar: React.FC<InputBarProps> = ({ onSend, onClearFile, setUploadedFile, isLoading, currentMode, uploadedFile, toggleLiveSession, isLiveSessionActive, onStop }) => {
    const [prompt, setPrompt] = useState('');
    const [showCommands, setShowCommands] = useState(false);
    const [showBodyMap, setShowBodyMap] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // We use the hook here locally just to access the `processFile` logic for clicks
    // The main drag/drop state is handled in MainLayout, but click uploads happen here
    const { processFile } = useFileDragAndDrop();

    const { isListening, toggleListening, stopListening } = useSpeechRecognition({
        onResult: (transcript) => setPrompt(transcript),
        onError: (err) => alert(err)
    });

    useEffect(() => {
        let activeUrl = uploadedFile?.url;
        return () => {
            if (activeUrl && activeUrl.startsWith('blob:')) {
                // Revoke object URL to free memory when file is cleared or changed
                URL.revokeObjectURL(activeUrl);
            }
        };
    }, [uploadedFile]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // We need to bridge the local processFile to the parent's setUploadedFile
            // This is a bit of a workaround because processFile sets its own state
            // In a real app, we'd refactor the hook to return the processed object promise
            
            // Re-implementing simplified process logic here to feed parent prop
            if (file.size > 10 * 1024 * 1024) { 
                alert("File is too large. Max 10MB.");
                return;
            }
            
            // We use the shared logic from the hook instance in MainLayout via props usually,
            // but here we manually trigger the read to pass to `setUploadedFile` prop.
            // Ideally, `setUploadedFile` in MainLayout should handle the IDB save.
            // For now, we will perform the read and let the MainLayout hook handle state.
            
            // Actually, best approach: Use the prop. 
            // The MainLayout `useFileDragAndDrop` is source of truth.
            // We can't easily access its internal `processFile` without passing it down.
            // Let's implement the read + save here and call setUploadedFile.
            
            const { blobStorage } = await import('../../../services/blobStorageService');
            const { v4: uuidv4 } = await import('uuid');

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const storageId = uuidv4();
                
                try {
                    await blobStorage.saveFile(storageId, base64, file.type);
                } catch(e) { console.error(e); }

                const uploadPayload: UploadedFile = { 
                    file, 
                    base64, 
                    type: file.type, 
                    storageId 
                };
                if (file.type.startsWith('image/')) {
                    uploadPayload.url = URL.createObjectURL(file);
                }
                setUploadedFile(uploadPayload);
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };

    const handleSendClick = useCallback(() => {
        const canSend = !isLoading || isLiveSessionActive;
        if (canSend) {
            if (isListening) stopListening();
            onSend(prompt);
            setPrompt('');
            setShowCommands(false);
        }
    }, [isLoading, isLiveSessionActive, onSend, prompt, isListening, stopListening]);
    
    const handleCommandSelect = (command: string) => {
        setPrompt(command);
        setShowCommands(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleBodyMapSelect = (region: string, symptom: string) => {
        const note = `[Observation] Patient reports ${symptom.toLowerCase()} in the ${region}.`;
        setPrompt(prev => prev ? `${prev}\n${note}` : note);
        setShowBodyMap(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendClick();
        }
    };
    
    const resizeTextarea = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            if (prompt === '') {
                textarea.style.height = '';
                return;
            }
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = `${Math.min(scrollHeight, 150)}px`;
        }
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setPrompt(value);
        setShowCommands(value.trim() === '/' || value.endsWith(' /'));
    };
    
    useLayoutEffect(() => { resizeTextarea(); }, [prompt]);
    const handleBlur = () => { setTimeout(() => setShowCommands(false), 200); };

    const isInputDisabled = (isLoading && !isLiveSessionActive) || isListening;
    const placeholderText = isLiveSessionActive 
        ? 'Voice Stream Active - Listening...' 
        : (isListening ? 'Dictation Active...' : 'Enter clinical instruction (/ for commands)...');

    const showStopButton = isLoading && !isLiveSessionActive && onStop;

    return (
        <footer className="flex-shrink-0 px-3 pb-4 pt-2 z-30 pointer-events-none md:px-4 md:pb-6">
            {showBodyMap && (
                <div className="pointer-events-auto">
                    <BodyMap onClose={() => setShowBodyMap(false)} onSelect={handleBodyMapSelect} />
                </div>
            )}

            <div className="max-w-4xl mx-auto pointer-events-auto">
                <div className={`relative transition-all duration-300 transform ${isLiveSessionActive ? 'scale-[1.01]' : ''}`}>
                    
                     {uploadedFile && (
                        <div className="absolute bottom-full left-0 mb-3 animate-slide-up z-20">
                             <div className="flex items-center gap-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white p-2 pr-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                                {uploadedFile.url && uploadedFile.type.startsWith('image/') ? (
                                     <img src={uploadedFile.url} alt="Attachment" className="w-8 h-8 object-cover rounded-md border border-slate-200" />
                                ) : (
                                    <div className="w-8 h-8 flex items-center justify-center bg-blue-50 dark:bg-slate-700 rounded-md">
                                        <DocumentTextIcon className="w-4 h-4 text-blue-500" />
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold max-w-[150px] truncate">{uploadedFile.file.name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Ready to Ingest</span>
                                </div>
                                <button onClick={onClearFile} className="ml-2 text-slate-400 hover:text-red-500">
                                    <XCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                     {showCommands && (
                        <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-900 rounded-xl shadow-float border border-slate-100 dark:border-slate-800 w-64 animate-slide-up z-20 overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                 <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Quick Execute</p>
                            </div>
                            <ul className="p-1">
                                {QUICK_COMMANDS.map(({ command, description, icon: Icon }) => (
                                    <li key={command}>
                                        <button
                                            onClick={() => handleCommandSelect(command)}
                                            className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                                        >
                                            <div className="p-1.5 bg-blue-50 dark:bg-slate-800 rounded-md text-blue-500 group-hover:bg-blue-100 transition-colors">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600">{command}</p>
                                                <p className="text-[10px] text-slate-400">{description}</p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className={`
                        flex items-end gap-0 rounded-2xl shadow-float transition-all duration-300 border overflow-hidden
                        ${isLiveSessionActive 
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900 ring-1 ring-red-500/20' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'
                        }
                    `}>
                        {/* Live/Voice Trigger */}
                        <button
                            onClick={toggleLiveSession}
                            className={`flex-shrink-0 self-stretch w-14 flex flex-col items-center justify-center transition-all border-r ${
                                isLiveSessionActive 
                                ? 'bg-red-600 text-white border-red-500 hover:bg-red-700' 
                                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-slate-100 dark:border-slate-800'
                            }`}
                            title={isLiveSessionActive ? "Stop Live Session" : "Start Live Consult"}
                        >
                            <LiveIcon className={`w-5 h-5 md:w-6 md:h-6 ${isLiveSessionActive ? 'animate-pulse' : ''}`} />
                            <span className="text-[9px] font-mono font-bold mt-1 uppercase">
                                {isLiveSessionActive ? 'LIVE' : 'VOICE'}
                            </span>
                        </button>

                        <div className="flex-1 flex flex-col relative min-w-0">
                            {isLiveSessionActive && (
                                <div className="absolute inset-0 z-10 bg-white/95 dark:bg-slate-900/95 flex items-center px-4 gap-3 animate-fade-in pointer-events-none">
                                    <div className="flex gap-1 h-3">
                                        {[1,2,3,4].map(i => <div key={i} className="w-1 bg-red-500 animate-music" style={{animationDuration: `${Math.random() * 0.5 + 0.2}s`}}></div>)}
                                    </div>
                                    <span className="font-mono text-xs text-red-600 dark:text-red-400 uppercase tracking-widest font-bold">
                                        Microphone Active
                                    </span>
                                </div>
                            )}

                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={handleTextareaInput}
                                onKeyDown={handleKeyDown}
                                onBlur={handleBlur}
                                placeholder={placeholderText}
                                rows={1}
                                className={`w-full bg-transparent resize-none outline-none py-4 px-4 text-sm font-medium leading-relaxed max-h-32 placeholder-slate-400 ${
                                    isLiveSessionActive ? 'text-transparent' : 'text-slate-900 dark:text-white'
                                }`}
                                disabled={isInputDisabled}
                            />
                        </div>

                        <div className="flex items-center gap-1 self-end pb-2 pr-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.txt,.md" className="hidden" />
                            <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

                            {!isLiveSessionActive && (
                                <>
                                    <button onClick={() => setShowBodyMap(true)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" title="Open Body Map">
                                        <BodyIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" title="Attach File">
                                        <PaperclipIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => cameraInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" title="Camera Capture">
                                        <CameraIcon className="w-5 h-5" />
                                    </button>
                                    {currentMode !== ChatModeEnum.Live && (
                                        <button 
                                            onClick={() => toggleListening(prompt)} 
                                            className={`p-2 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 ${isListening ? 'text-red-500 bg-red-50 dark:bg-red-900/20 animate-pulse' : 'text-slate-400 hover:text-blue-500'}`}
                                            title="Dictate Text"
                                        >
                                            <MicrophoneIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </>
                            )}
                            
                            {(!isLiveSessionActive && currentMode !== ChatModeEnum.Live) && (
                                <button 
                                    onClick={showStopButton ? onStop : handleSendClick}
                                    disabled={!showStopButton && (isInputDisabled || (!prompt.trim() && !uploadedFile))}
                                    className={`ml-2 flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg ${
                                        showStopButton
                                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none'
                                    }`}
                                >
                                    {showStopButton ? <StopIcon className="w-4 h-4" /> : <SendIcon className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default InputBar;
