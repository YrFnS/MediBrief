
import React, { useState, useRef, useCallback, KeyboardEvent, useLayoutEffect, useEffect } from 'react';
import type { UploadedFile, ChatMode } from '../../../types';
import { ChatMode as ChatModeEnum } from '../../../types';
import { PaperclipIcon, SendIcon, XCircleIcon, BriefingIcon, UserIcon, DrugsIcon, DownloadIcon, DocumentTextIcon, MicrophoneIcon, CameraIcon, LiveIcon, StopIcon, BodyIcon, PlusIcon, EyeIcon } from '../../../components/icons';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import BodyMap from '../../../components/BodyMap';
import { useFileDragAndDrop } from '../../../hooks/useFileDragAndDrop';
import { blobStorage } from '../../../services/blobStorageService';
import { v4 as uuidv4 } from 'uuid';

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
    onViewImage?: (src: string, alt: string) => void;
}

const QUICK_COMMANDS = [
    { command: '/brief', description: 'Shift briefing', icon: BriefingIcon },
    { command: '/patient ', description: 'Patient summary', icon: UserIcon },
    { command: '/drugs ', description: 'Check drugs', icon: DrugsIcon },
    { command: '/export', description: 'Export PDF', icon: DownloadIcon },
];

const InputBar: React.FC<InputBarProps> = ({ onSend, onClearFile, setUploadedFile, isLoading, currentMode, uploadedFile, toggleLiveSession, isLiveSessionActive, onStop, onViewImage }) => {
    const [prompt, setPrompt] = useState('');
    const [showCommands, setShowCommands] = useState(false);
    const [showBodyMap, setShowBodyMap] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false); // New state for (+) menu

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // We use the hook here locally just to access the `processFile` logic for clicks
    const { processFile } = useFileDragAndDrop();

    const { isListening, toggleListening, stopListening } = useSpeechRecognition({
        onResult: (transcript) => setPrompt(transcript),
        onError: (err) => alert(err)
    });

    useEffect(() => {
        let activeUrl = uploadedFile?.url;
        return () => {
            if (activeUrl && activeUrl.startsWith('blob:')) {
                URL.revokeObjectURL(activeUrl);
            }
        };
    }, [uploadedFile]);

    // Close menus on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                alert("File is too large. Max 10MB.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const storageId = uuidv4();

                try {
                    await blobStorage.saveFile(storageId, base64, file.type);
                } catch (e) { console.error(e); }

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
                setIsMenuOpen(false);
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
        setIsMenuOpen(false);
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
                <div className="relative transition-all duration-300">

                    {uploadedFile && (
                        <div className="absolute bottom-full left-0 mb-3 animate-slide-up z-20">
                            <div className="flex items-center gap-3 bg-white text-slate-800 p-2 pr-4 rounded-lg shadow-lg border border-slate-200">
                                {uploadedFile.url && uploadedFile.type.startsWith('image/') ? (
                                    <button
                                        onClick={() => onViewImage && onViewImage(uploadedFile.url!, uploadedFile.file.name)}
                                        className="relative group overflow-hidden rounded-md border border-slate-200"
                                    >
                                        <img src={uploadedFile.url} alt="Attachment" className="w-10 h-10 object-cover" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="bg-white/80 p-0.5 rounded-full"><EyeIcon className="w-3 h-3 text-slate-800" /></div>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-md">
                                        <DocumentTextIcon className="w-4 h-4 text-blue-500" />
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold max-w-[150px] truncate">{uploadedFile.file.name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Ready to Ingest</span>
                                </div>
                                <button onClick={onClearFile} className="ml-2 text-slate-400 hover:text-red-500" aria-label="Remove attachment">
                                    <XCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {showCommands && (
                        <div className="absolute bottom-full left-12 mb-2 bg-white rounded-xl shadow-float border border-slate-100 w-64 animate-slide-up z-20 overflow-hidden">
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Quick Execute</p>
                            </div>
                            <ul className="p-1">
                                {QUICK_COMMANDS.map(({ command, description, icon: Icon }) => (
                                    <li key={command}>
                                        <button
                                            onClick={() => handleCommandSelect(command)}
                                            className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition-colors group"
                                        >
                                            <div className="p-1.5 bg-blue-50 rounded-md text-blue-500 group-hover:bg-blue-100 transition-colors">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-mono text-xs font-bold text-slate-700 group-hover:text-blue-600">{command}</p>
                                                <p className="text-[10px] text-slate-400">{description}</p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className={`
                        flex items-end gap-2 rounded-2xl shadow-float transition-all duration-300 border p-2
                        ${isLiveSessionActive
                            ? 'bg-red-50 border-red-200 ring-1 ring-red-500/20'
                            : 'bg-white border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'
                        }
                    `}>
                        {/* Hidden Inputs */}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf,.txt,.md" className="hidden" />
                        <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

                        {/* Action Menu (Expandable) */}
                        {!isLiveSessionActive && (
                            <div className="relative flex-shrink-0" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isMenuOpen ? 'bg-slate-100 text-slate-900 rotate-45' : 'bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}
                                    aria-label="Open attachments menu"
                                    aria-expanded={isMenuOpen}
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>

                                {/* Popover Menu */}
                                {isMenuOpen && (
                                    <div className="absolute bottom-full left-0 mb-3 flex flex-col gap-2 p-2 bg-white rounded-xl shadow-xl border border-slate-200 animate-slide-up min-w-[140px]">
                                        <button onClick={() => setShowBodyMap(true)} className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-medium transition-colors">
                                            <div className="p-1.5 bg-blue-100 rounded text-blue-600"><BodyIcon className="w-4 h-4" /></div>
                                            Body Map
                                        </button>
                                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-medium transition-colors">
                                            <div className="p-1.5 bg-indigo-100 rounded text-indigo-600"><PaperclipIcon className="w-4 h-4" /></div>
                                            Attach File
                                        </button>
                                        <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-medium transition-colors">
                                            <div className="p-1.5 bg-emerald-100 rounded text-emerald-600"><CameraIcon className="w-4 h-4" /></div>
                                            Camera
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Live/Voice Trigger (Condensed) */}
                        {isLiveSessionActive && (
                            <button
                                onClick={toggleLiveSession}
                                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-red-100 text-red-600 animate-pulse"
                                title="Stop Live Session"
                                aria-label="Stop live session"
                            >
                                <LiveIcon className="w-5 h-5" />
                            </button>
                        )}

                        {/* Text Area */}
                        <div className="flex-1 min-w-0 relative">
                            {isLiveSessionActive && (
                                <div className="absolute inset-0 z-10 flex items-center gap-3 pointer-events-none">
                                    <div className="flex gap-1 h-3 ml-2">
                                        {[1, 2, 3, 4].map(i => <div key={i} className="w-1 bg-red-500 animate-music" style={{ animationDuration: `${Math.random() * 0.5 + 0.2}s` }}></div>)}
                                    </div>
                                    <span className="font-mono text-xs text-red-600 uppercase tracking-widest font-bold">
                                        Listening...
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
                                className={`w-full bg-transparent resize-none outline-none py-2.5 px-1 text-sm font-medium leading-relaxed max-h-32 placeholder-slate-400 ${isLiveSessionActive ? 'text-transparent' : 'text-slate-900'
                                    }`}
                                disabled={isInputDisabled}
                                aria-label="Clinical instruction input"
                            />
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1 pb-0.5">

                            {/* NEW: Explicit Start Live Button when in Live Mode but not active */}
                            {(!isLiveSessionActive && currentMode === ChatModeEnum.Live) && (
                                <button
                                    onClick={toggleLiveSession}
                                    className={`w-10 h-10 flex items-center justify-center transition-colors rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 animate-pulse border border-blue-200`}
                                    title="Start Live Session"
                                    aria-label="Start Live Session"
                                >
                                    <LiveIcon className="w-5 h-5" />
                                </button>
                            )}

                            {/* Standard Dictation Mic (Hidden in Live Mode to avoid confusion) */}
                            {(!isLiveSessionActive && currentMode !== ChatModeEnum.Live) && (
                                <button
                                    onClick={() => toggleListening(prompt)}
                                    className={`w-10 h-10 flex items-center justify-center transition-colors rounded-xl hover:bg-slate-100 ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-slate-400 hover:text-blue-500'}`}
                                    title="Dictate Text"
                                    aria-label={isListening ? "Stop dictation" : "Start dictation"}
                                >
                                    <MicrophoneIcon className="w-5 h-5" />
                                </button>
                            )}

                            {(!isLiveSessionActive && currentMode !== ChatModeEnum.Live) && (
                                <button
                                    onClick={showStopButton ? onStop : handleSendClick}
                                    disabled={!showStopButton && (isInputDisabled || (!prompt.trim() && !uploadedFile))}
                                    className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg ${showStopButton
                                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
                                        }`}
                                    aria-label={showStopButton ? "Stop generating" : "Send message"}
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
