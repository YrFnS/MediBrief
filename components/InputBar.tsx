
import React, { useState, useRef, useCallback, ChangeEvent, KeyboardEvent, useEffect, useLayoutEffect } from 'react';
import type { UploadedFile, ChatMode } from '../types';
import { ChatMode as ChatModeEnum } from '../types';
import { PaperclipIcon, SendIcon, XCircleIcon, BriefingIcon, UserIcon, DrugsIcon, DownloadIcon, HelpIcon, DocumentTextIcon, MicrophoneIcon, CameraIcon, LiveIcon } from './icons';

interface InputBarProps {
    onSend: (prompt: string) => void;
    onClearFile: () => void;
    setUploadedFile: (file: UploadedFile) => void;
    isLoading: boolean;
    currentMode: ChatMode;
    uploadedFile: UploadedFile | null;
    toggleLiveSession: () => void;
    isLiveSessionActive: boolean;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const QUICK_COMMANDS = [
  { command: '/brief', description: 'Generate shift briefing', icon: BriefingIcon },
  { command: '/patient ', description: 'Patient summary', icon: UserIcon },
  { command: '/drugs ', description: 'Medication check', icon: DrugsIcon },
  { command: '/export', description: 'Export to PDF', icon: DownloadIcon },
];

const InputBar: React.FC<InputBarProps> = ({ onSend, onClearFile, setUploadedFile, isLoading, currentMode, uploadedFile, toggleLiveSession, isLiveSessionActive }) => {
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
        setShowCommands(value === '/');
    };

    const handleSpeechToText = useCallback(() => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition not supported.");
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
        recognition.start();

    }, [isListening, prompt]);
    
    const handleLiveToggle = () => {
        if (currentMode === ChatModeEnum.Live) {
            toggleLiveSession();
        } else {
            // If in another mode, maybe warn or just switch? 
            // For now, let the parent handle the mode switch visualization
            toggleLiveSession();
        }
    };

    useLayoutEffect(() => { resizeTextarea(); }, [prompt]);
    
    const handleBlur = () => { setTimeout(() => setShowCommands(false), 150); };

    const isInputDisabled = isLoading && !isLiveSessionActive;
    const placeholderText = isLiveSessionActive ? 'Listening...' : 'Message MediBrief...';

    return (
        <footer className="flex-shrink-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 md:p-4 z-10">
            <div className="max-w-3xl mx-auto relative">
                 {showCommands && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="bg-slate-50 dark:bg-slate-700/50 px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                             <p className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400">QUICK ACTIONS</p>
                        </div>
                        <ul className="p-1">
                            {QUICK_COMMANDS.map(({ command, description, icon: Icon }) => (
                                <li key={command}>
                                    <button
                                        onClick={() => handleCommandSelect(command)}
                                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors group"
                                    >
                                        <div className="bg-blue-50 dark:bg-slate-700 p-2 rounded-md text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{command.trim()}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                 {uploadedFile && (
                    <div className="absolute bottom-full left-0 mb-2 animate-in fade-in slide-in-from-bottom-2">
                         <div className="relative group inline-block">
                            {uploadedFile.url && uploadedFile.type.startsWith('image/') ? (
                                 <img src={uploadedFile.url} alt="Attachment" className="w-20 h-20 object-cover rounded-lg border-2 border-white dark:border-slate-700 shadow-lg" />
                            ) : (
                                <div className="w-20 h-20 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg">
                                    <DocumentTextIcon className="w-8 h-8 text-slate-400" />
                                    <span className="text-[10px] text-slate-500 max-w-[90%] truncate px-1">{uploadedFile.file.name}</span>
                                </div>
                            )}
                            <button 
                                onClick={onClearFile}
                                className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-0.5 shadow-md hover:bg-red-500 transition-colors"
                            >
                                <XCircleIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                <div className={`flex items-end gap-2 p-1.5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border transition-all duration-300 ${isListening || isLiveSessionActive ? 'border-red-400 ring-1 ring-red-400/30 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800'}`}>
                    
                    {/* Attachment Actions Group */}
                    <div className="flex gap-1 pb-0.5 pl-1">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isInputDisabled}
                            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors disabled:opacity-30"
                            title="Attach File"
                        >
                            <PaperclipIcon className="w-5 h-5" />
                        </button>
                         <button
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={isInputDisabled}
                            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors disabled:opacity-30"
                            title="Use Camera"
                        >
                            <CameraIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.txt,.md" className="hidden" />
                    <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 self-center mx-1"></div>

                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={handleTextareaInput}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={placeholderText}
                        rows={1}
                        className="flex-1 bg-transparent resize-none outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 disabled:cursor-not-allowed py-2.5 text-[15px] leading-relaxed"
                        disabled={isInputDisabled}
                    />

                    {/* Voice & Live Group */}
                    <div className="flex gap-2 pb-1 pr-1">
                        {/* Standard STT Mic - Only show if NOT live mode to reduce confusion */}
                        {currentMode !== ChatModeEnum.Live && (
                             <button
                                onClick={handleSpeechToText}
                                disabled={isLoading}
                                className={`p-2 rounded-xl transition-all ${isListening ? 'text-red-500 bg-red-100 animate-pulse' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                            >
                                <MicrophoneIcon className="w-5 h-5" />
                            </button>
                        )}

                        {/* Live Toggle - The Big Button */}
                        {currentMode === ChatModeEnum.Live && (
                             <button
                                onClick={handleLiveToggle}
                                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-sm ${isLiveSessionActive 
                                    ? 'bg-red-500 text-white shadow-red-500/30 animate-pulse' 
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'}`}
                                title="Toggle Live Session"
                            >
                                <LiveIcon className="w-5 h-5" />
                            </button>
                        )}

                        {/* Send Button */}
                        <button 
                            onClick={handleSendClick} 
                            disabled={isInputDisabled || (!prompt.trim() && !uploadedFile)}
                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-medical-600 text-white shadow-lg shadow-blue-500/30 hover:bg-medical-500 hover:scale-105 active:scale-95 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {isLoading && !isLiveSessionActive ? (
                                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <SendIcon className="w-5 h-5 ml-0.5" />
                            )}
                        </button>
                    </div>
                </div>
                 <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-2">
                    AI can make mistakes. Verify important clinical details.
                </p>
            </div>
        </footer>
    );
};

export default InputBar;
