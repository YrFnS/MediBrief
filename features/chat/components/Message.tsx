
import React, { useState, useMemo } from 'react';
import type { ChatMessage } from '../../../types';
import { LinkIcon, DocumentTextIcon, ClipboardIcon, CheckIcon, AlertTriangleIcon, ShieldCheckIcon, BoltIcon } from '../../../components/icons';
import MessageContent from './MessageContent';
import { verifyDosages } from '../../safety/dosageVerifier';

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

    // Run Deterministic Safety Check on every model message
    const safetyCheck = useMemo(() => {
        if (!isModel || !message.content) return { isSafe: true, warnings: [], verifiedItems: [] };
        return verifyDosages(message.content);
    }, [isModel, message.content]);

    // AI-generated alerts (from prompt engineering)
    const isCriticalPromptAlert = isModel && message.content.includes("🛑 CRITICAL SAFETY WARNING");
    
    // Combined Alert Logic (Deterministic overrides AI)
    const hasSafetyWarning = isCriticalPromptAlert || !safetyCheck.isSafe;

    const contentToRender = (message.role === 'user' && message.displayContent) 
        ? message.displayContent 
        : message.content;

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className={`flex flex-col gap-2 group animate-slide-up ${isModel ? 'items-start' : 'items-end'}`}>
            
            <div className={`flex items-center gap-2 px-1 select-none transition-opacity duration-300 ${isModel ? 'opacity-70' : 'opacity-50'}`}>
                {isModel && <div className={`h-1.5 w-1.5 rounded-full ${hasSafetyWarning ? 'bg-red-500 animate-pulse' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'}`}></div>}
                <span className={`text-[10px] font-mono uppercase tracking-widest ${isModel ? (hasSafetyWarning ? 'text-red-500 font-bold' : 'text-blue-400') : 'text-slate-500'}`}>
                    {isModel ? (hasSafetyWarning ? 'SAFETY_GUARDRAIL_ACTIVE' : 'CIL_OUTPUT') : 'USER_INPUT'}
                </span>
                {isModel && (
                     <span className="text-[9px] font-mono text-slate-400 border-l border-slate-700 pl-2">
                        {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>

            <div className={`
                relative max-w-full md:max-w-3xl p-4 md:p-6 rounded-xl transition-all duration-300 overflow-hidden
                ${isModel 
                    ? hasSafetyWarning 
                        ? 'bg-red-950/40 border-l-4 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.1)] backdrop-blur-md'
                        : 'bg-white/5 dark:bg-[#0f172a]/40 border border-white/10 dark:border-white/5 border-l-4 border-l-blue-500 text-left shadow-lg backdrop-blur-md' 
                    : 'bg-white/10 dark:bg-white/5 border border-white/10 text-left backdrop-blur-md rounded-tr-none'
                }
            `}>
                
                {hasSafetyWarning && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-bl-xl shadow-md flex items-center gap-2 z-10">
                        <AlertTriangleIcon className="w-3 h-3" />
                        <span>Protocol Violation</span>
                    </div>
                )}

                {/* DETERMINISTIC GUARDRAIL ALERTS */}
                {!safetyCheck.isSafe && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-sm p-3">
                         <div className="flex items-center gap-2 text-red-500 mb-2 border-b border-red-500/20 pb-1">
                            <BoltIcon className="w-4 h-4" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Automatic Safety Intercept</span>
                        </div>
                        <ul className="space-y-1">
                            {safetyCheck.warnings.map((warn, i) => (
                                <li key={i} className="text-xs text-red-300 font-mono flex items-start gap-2">
                                    <span className="text-red-500">>></span> {warn.replace('🛑 **SAFETY VIOLATION**:', '')}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                {/* VERIFICATION BADGES (Positive Reinforcement) */}
                {safetyCheck.isSafe && safetyCheck.verifiedItems.length > 0 && (
                     <div className="mb-4 bg-green-500/5 border border-green-500/20 rounded-sm p-2 flex flex-col gap-1">
                        {safetyCheck.verifiedItems.map((item, i) => (
                             <div key={i} className="flex items-center gap-2">
                                <ShieldCheckIcon className="w-3 h-3 text-green-500" />
                                <span className="text-[10px] text-green-400 font-mono tracking-wide">{item.replace('✅ Verified:', '')}</span>
                            </div>
                        ))}
                    </div>
                )}

                {isModel && !isLoading && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all z-20"
                        title="Copy to Clipboard"
                    >
                        {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                    </button>
                )}

                {message.filePreview && (
                    <div className="mb-4 pb-4 border-b border-slate-200/10">
                         {message.filePreview.type.startsWith('image/') && message.filePreview.url ? (
                             <div className="relative inline-block group/img">
                                <button 
                                    onClick={() => onViewImage?.(message.filePreview!.url!, message.filePreview!.name)}
                                    className="block overflow-hidden border border-white/10 bg-black/50 rounded-lg"
                                >
                                    <img 
                                        src={message.filePreview.url} 
                                        alt={message.filePreview.name} 
                                        onLoad={onImageLoad}
                                        className="max-w-[150px] md:max-w-[200px] max-h-[150px] md:max-h-[200px] object-contain block group-hover/img:scale-105 transition-transform duration-500" 
                                    />
                                </button>
                                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400 max-w-[200px]">
                                    <span className="truncate">IMG: {message.filePreview.name}</span>
                                    <span className="text-blue-500 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer font-bold tracking-wider">[EXPAND]</span>
                                </div>
                            </div>
                        ) : (
                             <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg w-fit pr-6">
                                <div className="p-2 bg-white/10 rounded-md">
                                    <DocumentTextIcon className="w-5 h-5 text-slate-300" />
                                </div>
                                <div>
                                    <p className="font-mono text-xs font-bold text-slate-200">{message.filePreview.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">DATA_INGESTED</p>
                                 </div>
                            </div>
                        )}
                    </div>
                )}

                <MessageContent 
                    content={contentToRender} 
                    role={message.role} 
                    isLoading={!!isLoading} 
                    isLast={!!isLast} 
                />
                
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-200/10">
                        <div className="flex items-center gap-2 mb-3">
                            <ShieldCheckIcon className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Verified Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => {
                                if (source.web) {
                                    const isTrusted = isHighCredibilitySource(source.web.uri);
                                    return (
                                        <a key={i} href={source.web.uri} target="_blank" rel="noopener noreferrer"
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium border transition-all rounded-full max-w-full
                                                ${isTrusted 
                                                    ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' 
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
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
                                            className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 text-[10px] font-medium text-blue-300 transition-all rounded-full"
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
