
import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../../types';
import { LinkIcon, DocumentTextIcon, ClipboardIcon, CheckIcon, AlertTriangleIcon, ShieldCheckIcon, BoltIcon } from '../../../components/icons';
import MessageContent from './MessageContent';
import { extractMedicationsFromText } from '../../safety/safetyExtractionService';
import { verifyMedicationSafetyAsync } from '../../safety/dosageVerifier';
import { SafetyCheckResult } from '../../safety/types';
import { blobStorage } from '../../../services/blobStorageService';

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
    
    // Safety State
    const [safetyResult, setSafetyResult] = useState<SafetyCheckResult>({ isSafe: true, warnings: [], verifiedItems: [] });
    const [isVerifying, setIsVerifying] = useState(false);

    // File Loading State (IDB Integration)
    const [fileUrl, setFileUrl] = useState<string | undefined>(message.filePreview?.url);
    const objectUrlRef = useRef<string | null>(null);

    // Effect: Load image from IndexedDB if we have a storageId but no URL
    useEffect(() => {
        let isMounted = true;
        
        const loadFile = async () => {
            if (message.filePreview?.storageId && !message.filePreview.url) {
                try {
                    const stored = await blobStorage.getFile(message.filePreview.storageId);
                    if (stored && isMounted) {
                        // Convert base64 back to Blob for URL
                        const byteCharacters = atob(stored.data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: stored.mimeType });
                        
                        const url = URL.createObjectURL(blob);
                        objectUrlRef.current = url;
                        setFileUrl(url);
                    }
                } catch (e) {
                    console.error("Failed to load file from storage", e);
                }
            } else if (message.filePreview?.url) {
                setFileUrl(message.filePreview.url);
            }
        };

        loadFile();

        return () => {
            isMounted = false;
            // Cleanup object URL on unmount to prevent leaks
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
        };
    }, [message.filePreview]);

    useEffect(() => {
        let isMounted = true;
        const runSafetyCheck = async () => {
            if (!isModel || !message.content || isLoading) return;
            const medKeywords = ['mg', 'mcg', 'g', 'tablet', 'dose', 'prescribe', 'taking'];
            const mightHaveMeds = medKeywords.some(k => message.content.toLowerCase().includes(k));
            if (!mightHaveMeds) return;

            setIsVerifying(true);
            try {
                const meds = await extractMedicationsFromText(message.content);
                if (meds.length > 0) {
                    const result = await verifyMedicationSafetyAsync(meds);
                    if (isMounted) setSafetyResult(result);
                }
            } catch (e) {
                console.warn("Safety check failed", e);
            } finally {
                if (isMounted) setIsVerifying(false);
            }
        };
        const timer = setTimeout(runSafetyCheck, 500);
        return () => { isMounted = false; clearTimeout(timer); };
    }, [isModel, message.content, isLoading]);

    const isCriticalPromptAlert = isModel && message.content.includes("🛑 CRITICAL SAFETY WARNING");
    const hasSafetyWarning = isCriticalPromptAlert || !safetyResult.isSafe;

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
            
            <div className={`flex items-center gap-2 px-1 select-none transition-opacity duration-300 ${isModel ? 'opacity-100' : 'opacity-60'}`}>
                {isModel && <div className={`h-1.5 w-1.5 rounded-full ${hasSafetyWarning ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}></div>}
                <span className={`text-[10px] font-mono uppercase tracking-widest font-semibold ${isModel ? (hasSafetyWarning ? 'text-red-600' : 'text-slate-500') : 'text-slate-400'}`}>
                    {isModel ? (hasSafetyWarning ? 'SAFETY INTERVENTION' : 'MEDIBRIEF AI') : 'YOU'}
                </span>
            </div>

            <div className={`
                relative max-w-full md:max-w-3xl p-5 md:p-7 rounded-2xl transition-all duration-300 overflow-hidden
                ${isModel 
                    ? hasSafetyWarning 
                        ? 'bg-red-50 border border-red-200 shadow-soft'
                        : 'bg-white border border-slate-100 shadow-float text-left' 
                    : 'bg-slate-100 border border-transparent text-slate-800 rounded-tr-sm'
                }
            `}>
                
                {hasSafetyWarning && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-bl-xl shadow-sm flex items-center gap-2 z-10">
                        <AlertTriangleIcon className="w-3 h-3" />
                        <span>Protocol Violation</span>
                    </div>
                )}

                {isVerifying && !hasSafetyWarning && (
                     <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-2 flex items-center gap-2 animate-pulse">
                         <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                         <div className="flex flex-col">
                             <span className="text-[10px] text-blue-600 font-mono font-bold tracking-wide">CONNECTING TO FDA DATABASE...</span>
                             <span className="text-[9px] text-blue-400">Verifying labels & black box warnings</span>
                         </div>
                     </div>
                )}

                {!safetyResult.isSafe && (
                    <div className="mb-4 bg-white border border-red-200 rounded-lg p-3 shadow-sm">
                         <div className="flex items-center gap-2 text-red-600 mb-2 border-b border-red-100 pb-1">
                            <BoltIcon className="w-4 h-4" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">External Safety Intercept</span>
                        </div>
                        <ul className="space-y-1">
                            {safetyResult.warnings.map((warn, i) => (
                                <li key={i} className="text-xs text-red-700 font-medium flex items-start gap-2">
                                    <span className="text-red-500">>></span> 
                                    <span>{warn.replace(/🛑 \*\*.*\*\*:/, '').replace(/\*\*/g, '')}</span>
                                </li>
                            ))}
                        </ul>
                         <div className="mt-2 text-[9px] text-slate-400 text-right">Source: openFDA API</div>
                    </div>
                )}
                
                {safetyResult.isSafe && safetyResult.verifiedItems.length > 0 && !isVerifying && (
                     <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-2 flex flex-col gap-1">
                        {safetyResult.verifiedItems.map((item, i) => (
                             <div key={i} className="flex items-center gap-2">
                                <ShieldCheckIcon className="w-3 h-3 text-emerald-600" />
                                <span className="text-[10px] text-emerald-700 font-mono tracking-wide font-medium">{item.replace('✅ Verified:', '')}</span>
                            </div>
                        ))}
                    </div>
                )}

                {isModel && !isLoading && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-slate-50 transition-all z-20"
                        title="Copy to Clipboard"
                    >
                        {isCopied ? <CheckIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardIcon className="w-4 h-4" />}
                    </button>
                )}

                {message.filePreview && (
                    <div className="mb-4 pb-4 border-b border-slate-100">
                         {message.filePreview.type.startsWith('image/') ? (
                             <div className="relative inline-block group/img">
                                <button 
                                    onClick={() => fileUrl && onViewImage?.(fileUrl, message.filePreview!.name)}
                                    className="block overflow-hidden border border-slate-200 bg-slate-50 rounded-lg shadow-sm"
                                    disabled={!fileUrl}
                                >
                                    {fileUrl ? (
                                        <img 
                                            src={fileUrl} 
                                            alt={message.filePreview.name} 
                                            onLoad={onImageLoad}
                                            className="max-w-[150px] md:max-w-[200px] max-h-[150px] md:max-h-[200px] object-contain block group-hover/img:scale-105 transition-transform duration-500" 
                                        />
                                    ) : (
                                        <div className="w-[150px] h-[150px] flex items-center justify-center bg-slate-100 animate-pulse text-slate-400 text-xs">
                                            Loading from Vault...
                                        </div>
                                    )}
                                </button>
                                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400 max-w-[200px]">
                                    <span className="truncate">{message.filePreview.name}</span>
                                    <span className="text-blue-600 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer font-bold tracking-wider">[EXPAND]</span>
                                </div>
                            </div>
                        ) : (
                             <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl w-fit pr-6 shadow-sm">
                                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                    <DocumentTextIcon className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-xs text-slate-700">{message.filePreview.name}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">Ready for Analysis</p>
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
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <ShieldCheckIcon className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Verified Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => {
                                if (source.web) {
                                    const isTrusted = isHighCredibilitySource(source.web.uri);
                                    return (
                                        <a key={i} href={source.web.uri} target="_blank" rel="noopener noreferrer"
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border transition-all rounded-full max-w-full
                                                ${isTrusted 
                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100' 
                                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                                }`}
                                        >
                                            {isTrusted ? <ShieldCheckIcon className="w-3 h-3 text-emerald-500" /> : <LinkIcon className="w-3 h-3 text-slate-400" />}
                                            <span className="truncate max-w-[200px]">{source.web.title}</span>
                                        </a>
                                    );
                                }
                                if (source.maps) {
                                    return (
                                        <a key={i} href={source.maps.uri} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-3 py-1.5 text-[10px] font-bold text-blue-600 transition-all rounded-full"
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
