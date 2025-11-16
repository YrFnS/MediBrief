import React, { useState, useRef, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import type { UploadedFile, ChatMode } from '../types';
import { PaperclipIcon, SendIcon, XCircleIcon, BriefingIcon, UserIcon, DrugsIcon, ExportIcon, HelpIcon } from './icons';

interface InputBarProps {
    onSend: (prompt: string) => void;
    onFileUpload: (file: UploadedFile) => void;
    onClearFile: () => void;
    isLoading: boolean;
    currentMode: ChatMode;
    uploadedFile: UploadedFile | null;
}

const QUICK_COMMANDS = [
  { command: '/brief', description: 'Generate your shift briefing', icon: BriefingIcon },
  { command: '/patient ', description: 'Get patient summary (e.g., /patient 123)', icon: UserIcon },
  { command: '/drugs ', description: 'Look up medication info (e.g., /drugs Aspirin)', icon: DrugsIcon },
  { command: '/export', description: 'Export briefing as text', icon: ExportIcon },
  { command: '/help', description: 'Show all commands', icon: HelpIcon },
];


const InputBar: React.FC<InputBarProps> = ({ onSend, onFileUpload, onClearFile, isLoading, currentMode, uploadedFile }) => {
    const [prompt, setPrompt] = useState('');
    const [showCommands, setShowCommands] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) { // 4MB limit for inline data
                alert("File is too large. Please select a file smaller than 4MB.");
                return;
            }
            if (file.type.startsWith('image/')) {
                 const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    const url = URL.createObjectURL(file);
                    onFileUpload({ file, base64, type: file.type, url });
                };
                reader.readAsDataURL(file);
            } else {
                alert("Only image files are supported for analysis.");
            }
        }
        // Reset the file input so the user can select the same file again
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleSendClick = useCallback(() => {
        if (!isLoading) {
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
    
    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setPrompt(value);
        setShowCommands(value === '/');
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };
    
    const handleBlur = () => {
        // Use a small timeout to allow click events on the suggestions to register
        setTimeout(() => {
            setShowCommands(false);
        }, 150);
    };

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
                    <div className="relative w-24 h-24 mb-2 p-1 border rounded-lg bg-slate-100 dark:bg-slate-700">
                        <img src={uploadedFile.url} alt="File preview" className="w-full h-full object-cover rounded" />
                        <button 
                            onClick={onClearFile}
                            className="absolute -top-2 -right-2 bg-slate-600 text-white rounded-full p-0.5 hover:bg-slate-800 transition-colors"
                            aria-label="Remove attached file"
                        >
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <div className="flex items-end gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-transparent focus-within:border-blue-500 transition-colors">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        title="Attach Image (will use Standard mode for analysis)"
                        aria-label="Attach file"
                    >
                        <PaperclipIcon className="w-6 h-6" />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    
                    <textarea
                        ref={textareaRef}
                        value={prompt}
                        onChange={handleTextareaInput}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={`Message MediBrief... (${currentMode} mode)`}
                        rows={1}
                        className="flex-1 bg-transparent resize-none outline-none max-h-48 text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400"
                        disabled={isLoading}
                    />
                    
                    <button 
                        onClick={handleSendClick} 
                        disabled={isLoading || (!prompt.trim() && !uploadedFile)}
                        className="p-2 rounded-full bg-blue-500 text-white disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-blue-600 transition-all duration-200"
                        aria-label="Send message"
                    >
                        {isLoading ? (
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