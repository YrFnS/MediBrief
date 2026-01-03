import React, { useMemo, useState, useEffect } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '../types';
import { UserIcon, BotIcon, LinkIcon, DocumentTextIcon, ClipboardIcon, CheckIcon, ImageIcon, AlertTriangleIcon, ShieldCheckIcon } from './icons';
import BriefingReport from './BriefingReport';
import ImageAnalysisReport from './ImageAnalysisReport';
import LabReport from './LabReport';
import InteractionMatrix from './InteractionMatrix';
import ReasoningIndicator from './ReasoningIndicator'; 
import { isJsonBriefing, isImageAnalysis, isLabReport, isInteractionMatrix } from '../utils';
import { ChatMode } from '../types';

const MapPinIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
);

// Helper to detect high-credibility domains for medical info
const isHighCredibilitySource = (uri: string) => {
    try {
        const url = new URL(uri);
        const domain = url.hostname.toLowerCase();
        return domain.endsWith('.gov') || 
               domain.endsWith('.org') || 
               domain.endsWith('.edu') || 
               domain.includes('mayoclinic') ||
               domain.includes('webmd') || // controversial but widely used
               domain.includes('medscape') ||
               domain.includes('ncbi') ||
               domain.includes('pubmed');
    } catch {
        return false;
    }
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});

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
    const [streamKey, setStreamKey] = useState(0);

    const contentToDisplay = (message.role === 'user' && message.displayContent) ? message.displayContent : message.content;
    
    const isBriefing = isModel && isJsonBriefing(message.content);
    const isAnalysis = isModel && isImageAnalysis(message.content);
    const isLab = isModel && isLabReport(message.content);
    const isInteraction = isModel && isInteractionMatrix(message.content);

    useEffect(() => {
        if (isModel && isLoading && isLast) {
            setStreamKey(prev => prev + 1);
        }
    }, [message.content, isModel, isLoading, isLast]);

    const isStreamingJson = useMemo(() => {
        if (!isModel || !isLoading || !isLast) return false;
        const content = message.content.trim();
        const hasJsonStart = content.includes('```json') || content.startsWith('{');
        const isComplete = isBriefing || isAnalysis || isLab || isInteraction; 
        return hasJsonStart && !isComplete;
    }, [message.content, isModel, isLoading, isLast, isBriefing, isAnalysis, isLab, isInteraction]);

    const isPlaceholderLoading = useMemo(() => {
        return isModel && isLast && isLoading && !message.content.trim() && !message.filePreview;
    }, [isModel, isLast, isLoading, message.content, message.filePreview]);

    // Custom renderer for Critical Alerts in plain text
    // We look for the "🛑 CRITICAL SAFETY WARNING" marker or blockquote
    const isCriticalAlert = isModel && message.content.includes("🛑 CRITICAL SAFETY WARNING");

    const parsedContent = useMemo(() => {
        if (isPlaceholderLoading || isStreamingJson) return '';
        // If critical alert, we rely on the component wrapper, but we still parse the markdown
        const html = parse(contentToDisplay, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(html);
    }, [contentToDisplay, isPlaceholderLoading, isStreamingJson]);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const typographyClasses = `
        prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed font-sans
        prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 dark:prose-headings:text-white
        prose-p:my-2 prose-ul:my-2 prose-li:my-0.5
        prose-strong:font-semibold prose-strong:text-slate-900 dark:prose-strong:text-white
        prose-blockquote:bg-red-50 dark:prose-blockquote:bg-red-900/10 
        prose-blockquote:border-l-4 prose-blockquote:border-red-500 
        prose-blockquote:text-red-800 dark:prose-blockquote:text-red-200 
        prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:rounded-r-sm
        prose-blockquote:not-italic prose-blockquote:font-medium
        prose-code:font-mono prose-code:text-[11px] prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:text-slate-800 dark:prose-code:text-slate-200
        ${isLoading && isLast ? 'animate-soft-stream' : ''}
    `;

    return (
        <div className={`flex flex-col gap-1 group animate-slide-up ${isModel ? 'items-start' : 'items-end'}`}>
            
            {/* Technical Header Label */}
            <div className="flex items-center gap-2 px-1 opacity-50">
                <span className={`text-[9px] font-mono uppercase tracking-widest ${isModel ? (isCriticalAlert ? 'text-red-500 font-bold animate-pulse' : 'text-blue-500') : 'text-slate-500'}`}>
                    {isModel ? (isCriticalAlert ? '⚠️ CRITICAL_ALERT' : 'SYS_OUTPUT') : 'USR_COMMAND'}
                </span>
                <div className={`h-px w-4 ${isCriticalAlert ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                {isModel && (
                     <span className="text-[9px] font-mono text-slate-400">
                        {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Main Data Block */}
            <div className={`
                relative max-w-full md:max-w-3xl p-5 border shadow-sm transition-all duration-300
                ${isModel 
                    ? isCriticalAlert 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-500 shadow-red-500/10 border-l-[6px]'
                        : 'bg-white dark:bg-slate-900 border-l-4 border-l-blue-500 border-y-slate-200 border-r-slate-200 dark:border-y-slate-800 dark:border-r-slate-800 text-left' 
                    : 'bg-slate-50 dark:bg-slate-800/50 border-l-4 border-l-slate-400 border-y-slate-200 border-r-slate-200 dark:border-y-slate-700 dark:border-r-slate-700 text-left'
                }
            `}>
                
                {isCriticalAlert && (
                    <div className="absolute -top-3 left-4 bg-red-600 text-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm shadow-sm flex items-center gap-2">
                        <AlertTriangleIcon className="w-3 h-3" />
                        <span>Safety Intervention</span>
                    </div>
                )}

                {isModel && !isBriefing && !isAnalysis && !isLab && !isInteraction && !isStreamingJson && !isPlaceholderLoading && message.content.trim() && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 rounded-sm text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                    </button>
                )}

                {message.filePreview && (
                    <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                         {message.filePreview.type.startsWith('image/') && message.filePreview.url ? (
                             <div className="relative inline-block group/img">
                                <button 
                                    onClick={() => onViewImage?.(message.filePreview!.url!, message.filePreview!.name)}
                                    className="block overflow-hidden border border-slate-200 dark:border-slate-700"
                                >
                                    <img 
                                        src={message.filePreview.url} 
                                        alt={message.filePreview.name} 
                                        onLoad={onImageLoad}
                                        className="max-w-[200px] max-h-[200px] object-cover block grayscale-[20%] group-hover/img:grayscale-0 transition-all duration-500" 
                                    />
                                </button>
                                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 max-w-[200px]">
                                    <span className="truncate">IMG: {message.filePreview.name}</span>
                                    <span className="text-blue-500 opacity-0 group-hover/img:opacity-100 transition-opacity">[VIEW]</span>
                                </div>
                            </div>
                        ) : (
                             <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-800 border-l-2 border-slate-400 w-fit">
                                <DocumentTextIcon className="w-5 h-5 text-slate-500" />
                                <div>
                                    <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{message.filePreview.name}</p>
                                    <p className="text-[10px] text-slate-400 uppercase">FILE_INGESTED</p>
                                 </div>
                            </div>
                        )}
                    </div>
                )}

                {isBriefing ? (
                    <BriefingReport content={message.content} />
                ) : isAnalysis ? (
                    <ImageAnalysisReport content={message.content} />
                ) : isLab ? (
                    <LabReport content={message.content} />
                ) : isInteraction ? (
                    <InteractionMatrix content={message.content} />
                ) : isStreamingJson ? (
                     <div className="flex flex-col gap-2 p-2 w-full min-w-[300px]">
                        <div className="flex items-center gap-2 text-blue-500">
                            <span className="animate-pulse">●</span>
                            <span className="font-mono text-xs uppercase">Decoding Structured Data...</span>
                        </div>
                        <div className="space-y-2 opacity-50">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 w-1/2 animate-pulse"></div>
                        </div>
                    </div>
                ) : isPlaceholderLoading ? (
                    <ReasoningIndicator mode={ChatMode.Auto} />
                ) : (
                    <div 
                        key={streamKey} 
                        className={typographyClasses} 
                        dangerouslySetInnerHTML={{ __html: parsedContent }}
                    ></div>
                )}
                
                {/* Sources Footer */}
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Grounded Sources</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => {
                                if (source.web) {
                                    const isTrusted = isHighCredibilitySource(source.web.uri);
                                    return (
                                        <a key={i} href={source.web.uri} target="_blank" rel="noopener noreferrer"
                                            className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium border transition-colors rounded-sm
                                                ${isTrusted 
                                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30' 
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {isTrusted ? <ShieldCheckIcon className="w-3 h-3 text-green-500" /> : <LinkIcon className="w-3 h-3 text-blue-400" />}
                                            <span className="truncate max-w-[150px]">{source.web.title}</span>
                                        </a>
                                    );
                                }
                                if (source.maps) {
                                    return (
                                        <a key={i} href={source.maps.uri} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-green-900/20 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 transition-colors"
                                        >
                                            <MapPinIcon className="w-3 h-3 text-green-500" />
                                            <span className="truncate max-w-[150px]">{source.maps.title}</span>
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