
import React, { useState, useRef, useCallback, ChangeEvent, KeyboardEvent, useEffect, useLayoutEffect } from 'react';
import type { UploadedFile, ChatMode } from '../types';
import { ChatMode as ChatModeEnum } from '../types';
import { PaperclipIcon, SendIcon, XCircleIcon, BriefingIcon, UserIcon, DrugsIcon, DownloadIcon, DocumentTextIcon, MicrophoneIcon, CameraIcon, LiveIcon, StopIcon } from './icons';

interface InputBarProps {
    onSend: (prompt: string) => void;
    onClearFile: () => void;
    setUploadedFile: (file: UploadedFile) => void;
    isLoading: boolean;
    currentMode: ChatMode;
    uploadedFile: UploadedFile | null;
    toggleLiveSession: () => void;
    isLiveSessionActive: boolean;
    onStop?: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
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
    const [isListening, setIsListening] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        let activeUrl = uploadedFile?.url;
        return () => {
            if (activeUrl) {
                setTimeout(() => { URL.revokeObjectURL(activeUrl!); }, 1000);
            }
        };
    }, [uploadedFile]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) {
                alert("File is too large. Please select a file smaller than 4MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                const uploadPayload: UploadedFile = { file, base64, type: file.type };
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
            if (recognitionRef.current) {
                recognitionRef.current.onresult = null;
                recognitionRef.current.onend = null; 
                recognitionRef.current.stop();
                setIsListening(false);
            }
            onSend(prompt);
            setPrompt('');
            setShowCommands(false);
        }
    }, [isLoading, isLiveSessionActive, onSend, prompt]);
    
    const handleCommandSelect = (command: string) => {
        setPrompt(command);
        setShowCommands(false);
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
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = `${Math.min(scrollHeight, 150)}px`;
        }
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setPrompt(value);
        setShowCommands(value.trim() === '/' || value.endsWith(' /'));
    };

    const handleSpeechToText = useCallback(() => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognitionRef.current = recognition;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Speech error:', event.error);
            setIsListening(false);
            
            // Specific error handling for user feedback
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                alert("Microphone access denied. Please allow microphone permission in your browser settings.");
            } else if (event.error === 'no-speech') {
                // Usually ignore no-speech, but if it persists it might be hardware
            } else if (event.error === 'audio-capture') {
                alert("No microphone was found. Ensure your microphone is connected.");
            } else if (event.error === 'network') {
                alert("Network error preventing speech recognition.");
            }
        };

        let finalTranscript = prompt ? prompt + ' ' : '';

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                else interimTranscript += event.results[i][0].transcript;
            }
            setPrompt(finalTranscript + interimTranscript);
        };
        
        try {
            recognition.start();
        } catch (e) {
            console.error("Failed to start recognition:", e);
            alert("Could not start speech recognition. Please refresh and try again.");
        }

    }, [isListening, prompt]);
    
    const handleLiveToggle = () => {
        toggleLiveSession();
    };

    useLayoutEffect(() => { resizeTextarea(); }, [prompt]);
    
    const handleBlur = () => { setTimeout(() => setShowCommands(false), 200); };

    const isInputDisabled = isLoading && !isLiveSessionActive;
    const placeholderText = isLiveSessionActive ? 'Listening to conversation...' : 'Type a message or enter / for commands...';

    const showStopButton = isLoading && !isLiveSessionActive && onStop;

    return (
        <footer className="flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 z-20 transition-all duration-300">
            <div className="max-w-3xl mx-auto relative">
                 
                 {/* Quick Command Popover */}
                 {showCommands && (
                    <div className="absolute bottom-full left-0 mb-3 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up w-64 z-30">
                        <div className="bg-slate-50 dark:bg-slate-700/50 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                             <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500">Quick Actions</p>
                        </div>
                        <ul className="p-1">
                            {QUICK_COMMANDS.map(({ command, description, icon: Icon }) => (
                                <li key={command}>
                                    <button
                                        onClick={() => handleCommandSelect(command)}
                                        className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-medical-50 dark:hover:bg-slate-700/70 transition-colors group"
                                    >
                                        <div className="text-medical-500 dark:text-medical-400">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{command.trim()}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* File Attachment Preview */}
                 {uploadedFile && (
                    <div className="absolute bottom-full left-0 mb-3 animate-slide-up z-20">
                         <div className="relative group flex items-center gap-3 bg-white dark:bg-slate-800 p-2 pr-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                            {uploadedFile.url && uploadedFile.type.startsWith('image/') ? (
                                 <img src={uploadedFile.url} alt="Attachment" className="w-10 h-10 object-cover rounded-lg" />
                            ) : (
                                <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg">
                                    <DocumentTextIcon className="w-5 h-5 text-slate-500" />
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[150px] truncate">{uploadedFile.file.name}</span>
                                <span className="text-[10px] text-slate-400 uppercase">{uploadedFile.type.split('/')[1]}</span>
                            </div>
                            <button 
                                onClick={onClearFile}
                                className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <XCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Input Container */}
                <div className={`flex items-end gap-2 transition-all duration-300`}>
                    
                    {/* Input Box Area */}
                    <div className={`flex-1 flex items-end gap-2 p-1.5 rounded-2xl border bg-slate-50 dark:bg-slate-800/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:border-medical-500/50 focus-within:ring-medical-500/20 transition-all shadow-sm ${
                        isListening ? 'ring-2 ring-red-500/30 border-red-500/50 bg-red-50/50' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                        
                        {/* Attachment Button Group */}
                        <div className="flex items-center gap-0.5 pb-1 pl-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isInputDisabled}
                                className="p-2 rounded-xl text-slate-400 hover:text-medical-600 hover:bg-medical-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                title="Attach File"
                            >
                                <PaperclipIcon className="w-5 h-5" />
                            </button>
                             <button
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={isInputDisabled}
                                className="p-2 rounded-xl text-slate-400 hover:text-medical-600 hover:bg-medical-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                title="Camera"
                            >
                                <CameraIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.txt,.md" className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

                        {/* Text Input */}
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={handleTextareaInput}
                            onKeyDown={handleKeyDown}
                            onBlur={handleBlur}
                            placeholder={placeholderText}
                            rows={1}
                            className="flex-1 bg-transparent resize-none outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 disabled:cursor-not-allowed py-2.5 text-sm leading-relaxed max-h-32"
                            disabled={isInputDisabled}
                        />
                        
                        {/* Standard Dictation Mic (Text Mode) */}
                        {currentMode !== ChatModeEnum.Live && (
                             <button
                                onClick={handleSpeechToText}
                                disabled={isLoading}
                                className={`mb-1 p-2 rounded-xl transition-all ${
                                    isListening 
                                    ? 'text-red-500 bg-red-100 dark:bg-red-900/20 animate-pulse' 
                                    : 'text-slate-400 hover:text-medical-600 hover:bg-medical-50 dark:hover:bg-slate-700'
                                }`}
                                title="Dictate"
                            >
                                <MicrophoneIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-end gap-2">
                        {/* Live Toggle Button */}
                         <button
                            onClick={handleLiveToggle}
                            className={`h-[50px] w-[50px] rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border ${
                                isLiveSessionActive 
                                ? 'bg-red-500 border-red-600 text-white shadow-red-500/40 animate-pulse' 
                                : currentMode === ChatModeEnum.Live 
                                    ? 'bg-white dark:bg-slate-800 border-red-200 text-red-500 hover:bg-red-50'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 hover:border-slate-300'
                            }`}
                            title={isLiveSessionActive ? "End Live Session" : "Start Live Session"}
                        >
                            <LiveIcon className={isLiveSessionActive ? "w-6 h-6" : "w-5 h-5"} />
                        </button>

                        {/* Send or Stop Button */}
                        {(!isLiveSessionActive && currentMode !== ChatModeEnum.Live) && (
                            <button 
                                onClick={showStopButton ? onStop : handleSendClick} 
                                disabled={!showStopButton && (isInputDisabled || (!prompt.trim() && !uploadedFile))}
                                className={`h-[50px] w-[50px] rounded-2xl text-white shadow-lg transition-all duration-200 flex items-center justify-center ${
                                    showStopButton 
                                    ? 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 shadow-slate-500/30' 
                                    : 'bg-medical-600 hover:bg-medical-500 hover:scale-105 active:scale-95 shadow-medical-500/30 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed'
                                }`}
                            >
                                {showStopButton ? (
                                    <StopIcon className="w-5 h-5" />
                                ) : (
                                    <SendIcon className="w-5 h-5 ml-0.5" />
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default InputBar;
