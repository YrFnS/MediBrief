import React, { useState } from 'react';
import type { ChatMessage } from '../types';
import { LinkIcon, DocumentTextIcon, ClipboardIcon, CheckIcon, AlertTriangleIcon, ShieldCheckIcon } from './icons';
import MessageContent from './MessageContent';

// Helper to detect high-credibility domains for medical info
const isHighCredibilitySource = (uri: string) => {
    try {
        const url = new URL(uri);
        const domain = url.hostname.toLowerCase();
        return domain.endsWith('.gov') || 
               domain.endsWith('.org') || 
               domain.endsWith('.edu') || 
               domain.includes('mayoclinic') ||
               domain.includes('webmd') || 
               domain.includes('medscape') ||
               domain.includes('ncbi') ||
               domain.includes('pubmed');
    } catch {
        return false;
    }
};

const MapPinIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
);

interface MessageProps {
    message: ChatMessage;
    isLoading?: boolean;
    isLast?: boolean;
    onImageLoad?: () => void;
    onViewImage?: (src: string, alt: string) => void;
}

const Message: React.FC<MessageProps> = ({ message, isLoading, isLast, onImageLoad, onViewImage }) => {
    const isModel = message.role === 'model';
    const [isCopied, setIsCopied] = useState(false);

    // Safety Alert Detection
    const isCriticalAlert = isModel && message.content.includes("🛑 CRITICAL SAFETY WARNING");
    
    // Determine content to pass to renderer
    const contentToRender = (message.role === 'user' && message.displayContent) 
        ? message.displayContent 
        : message.content;

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className={`flex flex-col gap-1 group animate-slide-up ${isModel ? 'items-start' : 'items-end'}`}>
            
            {/* Technical Header Label / Timestamp */}
            <div className="flex items-center gap-2 px-1 opacity-60 select-none">
                <div className={`h-1.5 w-1.5 rounded-none ${isModel ? (isCriticalAlert ? 'bg-red-500 animate-pulse' : 'bg-blue-500') : 'bg-slate-400'}`}></div>
                <span className={`text-[9px] font-mono uppercase tracking-widest ${isModel ? (isCriticalAlert ? 'text-red-500 font-bold' : 'text-blue-600 dark:text-blue-400') : 'text-slate-500'}`}>
                    {isModel ? (isCriticalAlert ? 'CRITICAL_SAFETY_INTERVENTION' : 'CIL_OUTPUT') : 'USER_INPUT_LOG'}
                </span>
                {isModel && (
                     <span className="text-[9px] font-mono text-slate-400 border-l border-slate-300 dark:border-slate-700 pl-2">
                        {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Main Data Block with Technical Border */}
            <div className={`
                relative max-w-full md:max-w-3xl p-3 md:p-5 border shadow-sm transition-all duration-300 technical-border
                ${isModel 
                    ? isCriticalAlert 
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-500 shadow-red-500/10 border-l-[4px]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-l-[4px] border-l-blue-500 text-left' 
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 border-l-[4px] border-l-slate-400 text-left'
                }
            `}>
                
                {/* Critical Alert Badge Overlay */}
                {isCriticalAlert && (
                    <div className="absolute -top-3 left-4 bg-red-600 text-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm shadow-md flex items-center gap-2 z-10">
                        <AlertTriangleIcon className="w-3 h-3" />
                        <span>Protocol Violation Detected</span>
                    </div>
                )}

                {/* Copy Button */}
                {isModel && !isLoading && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 rounded-sm text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-all z-20"
                        title="Copy to Clipboard"
                    >
                        {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                    </button>
                )}

                {/* File Attachment Visualization */}
                {message.filePreview && (
                    <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800/50">
                         {message.filePreview.type.startsWith('image/') && message.filePreview.url ? (
                             <div className="relative inline-block group/img">
                                <button 
                                    onClick={() => onViewImage?.(message.filePreview!.url!, message.filePreview!.name)}
                                    className="block overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-black"
                                >
                                    <img 
                                        src={message.filePreview.url} 
                                        alt={message.filePreview.name} 
                                        onLoad={onImageLoad}
                                        className="max-w-[150px] md:max-w-[200px] max-h-[150px] md:max-h-[200px] object-contain block grayscale-[20%] group-hover/img:grayscale-0 transition-all duration-500" 
                                    />
                                </button>
                                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 max-w-[200px]">
                                    <span className="truncate">IMG: {message.filePreview.name}</span>
                                    <span className="text-blue-500 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer">[EXPAND]</span>
                                </div>
                            </div>
                        ) : (
                             <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-800 border-l-2 border-slate-400 w-fit pr-4">
                                <DocumentTextIcon className="w-5 h-5 text-slate-500" />
                                <div>
                                    <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{message.filePreview.name}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">DATA_INGESTED</p>
                                 </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Content Rendering Delegated to MessageContent */}
                <MessageContent 
                    content={contentToRender} 
                    role={message.role} 
                    isLoading={!!isLoading} 
                    isLast={!!isLast} 
                />
                
                {/* Grounding Sources Footer */}
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-6 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheckIcon className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Verified Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => {
                                if (source.web) {
                                    const isTrusted = isHighCredibilitySource(source.web.uri);
                                    return (
                                        <a key={i} href={source.web.uri} target="_blank" rel="noopener noreferrer"
                                            className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium border transition-colors rounded-sm max-w-full
                                                ${isTrusted 
                                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30' 
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {isTrusted ? <ShieldCheckIcon className="w-3 h-3 text-green-500" /> : <LinkIcon className="w-3 h-3 text-blue-400" />}
                                            <span className="truncate max-w-[200px]">{source.web.title}</span>
                                        </a>
                                    );
                                }
                                if (source.maps) {
                                    return (
                                        <a key={i} href={source.maps.uri} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 transition-colors"
                                        >
                                            <MapPinIcon className="w-3 h-3 text-blue-500" />
                                            <span className="truncate max-w-[200px]">{source.maps.title}</span>
                                        </a>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;