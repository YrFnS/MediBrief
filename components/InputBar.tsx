
import React, { useState, useRef, useCallback, ChangeEvent, KeyboardEvent, useEffect } from 'react';
import type { UploadedFile, ChatMode } from '../types';
import { ChatMode as ChatModeEnum } from '../types';
import { PaperclipIcon, SendIcon, XCircleIcon, BriefingIcon, UserIcon, DrugsIcon, DownloadIcon, HelpIcon, DocumentTextIcon, MicrophoneIcon, CameraIcon } from './icons';

interface InputBarProps {
    onSend: (prompt: string) => void;
    onFileUpload: (file: UploadedFile) => void;
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
  { command: '/brief', description: 'Generate your shift briefing', icon: BriefingIcon },
  { command: '/patient ', description: 'Get patient summary (e.g., /patient 123)', icon: UserIcon },
  { command: '/drugs ', description: 'Look up medication info (e.g., /drugs Aspirin)', icon: DrugsIcon },
  { command: '/export', description: 'Download briefing as PDF', icon: DownloadIcon },
  { command: '/help', description: 'Show all commands', icon: HelpIcon },
];


const InputBar: React.FC<InputBarProps> = ({ onSend, onFileUpload, onClearFile, setUploadedFile, isLoading, currentMode, uploadedFile, toggleLiveSession, isLiveSessionActive }) => {
    const [prompt, setPrompt] = useState('');
    const [showCommands, setShowCommands] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);


    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) { // 4MB limit for inline data
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
                
                if (prompt.trim() === '') {
                     onFileUpload(uploadPayload);
                } else {
                     setUploadedFile(uploadPayload);
                }
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };

    const handleSendClick = useCallback(() => {
        if (!isLoading) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            onSend(prompt);
            setPrompt('');
            setShowCommands(false);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    }, [isLoading, onSend, prompt]);
    
    const handleCommandSelect = (command: string) => {
        setPrompt(command);
        setShowCommands(false);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                textareaRef.current.focus();
            }
        }, 0);
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
            textarea.style.height = `${scrollHeight}px`;
        }
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setPrompt(value);
        setShowCommands(value === '/');
        resizeTextarea();
    };

    const handleSpeechToText = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Sorry, your browser doesn't support speech recognition.");
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
            if (event.error === 'not-allowed') {
                alert('Microphone access was denied. Please allow microphone permission in your browser settings to use voice input.');
            } else {
                console.error('Speech recognition error:', event.error);
            }
            setIsListening(false);
        };

        let finalTranscript = prompt ? prompt + ' ' : '';

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setPrompt(finalTranscript + interimTranscript);
        };
        
        recognition.start();

    }, [isListening, prompt]);
    
     const handleMicButtonClick = () => {
        if (currentMode === ChatModeEnum.Live) {
            toggleLiveSession();
        } else {
            handleSpeechToText();
        }
    };

    useEffect(() => {
        resizeTextarea();
    }, [prompt]);
    
    const handleBlur = () => {
        setTimeout(() => setShowCommands(false), 150);
    };

    const isInputDisabled = isLoading || isLiveSessionActive;
    const placeholderText = isLiveSessionActive
        ? 'Live session is active...'
        : `Message MediBrief... (${currentMode} mode)`;

    return (
        <footer className="flex-shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-2 md:p-4 z-10">
            <div className="max-w-3xl mx-auto relative">
                 {showCommands && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 pb-2">QUICK COMMANDS</p>
                        <ul className="space-y-1">
                            {QUICK_COMMANDS.map(({ command, description, icon: Icon }) => (
                                <li key={command}>
                                    <button
                                        onClick={() => handleCommandSelect(command)}
                                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Icon className="w-5 h-5 text-blue-500 flex-shrink-0" />
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
                    <div className="relative w-24 h-24 mb-2 p-1 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700">
                        {uploadedFile.url && uploadedFile.type.startsWith('image/') ? (
                             <img src={uploadedFile.url} alt={uploadedFile.file.name} className="w-full h-full object-cover rounded" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-slate-800 rounded p-1">
                                <DocumentTextIcon className="w-8 h-8 text-slate-500 dark:text-slate-400" />
                                <p className="text-xs text-center text-slate-600 dark:text-slate-300 mt-1 break-all line-clamp-2">{uploadedFile.file.name}</p>
                            </div>
                        )}
                       
                        <button 
                            onClick={onClearFile}
                            className="absolute -top-2 -right-2 bg-slate-600 text-white rounded-full p-0.5 hover:bg-slate-800 transition-colors"
                            aria-label="Remove attached file"
                        >
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <div className="flex gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-800 focus-within:ring-blue-500 transition-all">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isInputDisabled}
                        className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 self-end"
                        title="Attach file (image, PDF, .txt)"
                        aria-label="Attach file"
                    >
                        <PaperclipIcon className="w-6 h-6" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.txt,.md" className="hidden" />
                    
                    <button
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isInputDisabled}
                        className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 self-end"
                        title="Scan document with camera"
                        aria-label="Scan document with camera"
                    >
                        <CameraIcon className="w-6 h-6" />
                    </button>
                    {/* capture="environment" forces rear camera on mobile */}
                    <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={handleTextareaInput}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={placeholderText}
                        rows={1}
                        className="flex-1 bg-transparent resize-none outline-none max-h-48 text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 disabled:cursor-not-allowed py-2"
                        disabled={isInputDisabled}
                    />

                    <button
                        onClick={handleMicButtonClick}
                        disabled={isLoading && !isLiveSessionActive}
                        className={`p-2 rounded-full transition-colors relative self-end ${isListening || isLiveSessionActive ? 'text-red-500 bg-red-100 dark:bg-red-900/50' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                        title={currentMode === ChatModeEnum.Live ? 'Start/Stop live session' : 'Speak your query'}
                        aria-label={currentMode === ChatModeEnum.Live ? 'Start or stop live session' : 'Speak your query'}
                    >
                        <MicrophoneIcon className="w-6 h-6" />
                        {isLiveSessionActive && <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-slate-800 animate-pulse"></span>}
                    </button>
                    
                    <button 
                        onClick={handleSendClick} 
                        disabled={isInputDisabled || (!prompt.trim() && !uploadedFile)}
                        className="p-2 rounded-full bg-blue-500 text-white disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-all duration-200 self-end"
                        aria-label="Send message"
                    >
                        {isLoading && !isLiveSessionActive ? (
                             <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <SendIcon className="w-6 h-6" />
                        )}
                    </button>
                </div>
            </div>
        </footer>
    );
};

export default InputBar;