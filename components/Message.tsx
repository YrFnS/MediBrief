
import React, { useMemo, useState } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '../types';
import { UserIcon, BotIcon, LinkIcon, DocumentTextIcon, ClipboardIcon, CheckIcon } from './icons';
import BriefingReport from './BriefingReport';
import ImageAnalysisReport from './ImageAnalysisReport';
import LabReport from './LabReport';
import { isJsonBriefing, isImageAnalysis, isLabReport } from '../utils';

// New Icon for Maps
const MapPinIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
);

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
}

const Message: React.FC<MessageProps> = ({ message, isLoading, isLast, onImageLoad }) => {
    const isModel = message.role === 'model';
    const [isCopied, setIsCopied] = useState(false);

    const contentToDisplay = (message.role === 'user' && message.displayContent) ? message.displayContent : message.content;
    
    const isBriefing = isModel && isJsonBriefing(message.content);
    const isAnalysis = isModel && isImageAnalysis(message.content);
    const isLab = isModel && isLabReport(message.content);

    const isStreamingJson = useMemo(() => {
        if (!isModel || !isLoading || !isLast) return false;
        const content = message.content.trim();
        const hasJsonStart = content.includes('```json') || content.startsWith('{');
        const isComplete = isBriefing || isAnalysis || isLab; 
        return hasJsonStart && !isComplete;
    }, [message.content, isModel, isLoading, isLast, isBriefing, isAnalysis, isLab]);

    const parsedContent = useMemo(() => {
        const html = parse(contentToDisplay, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(html);
    }, [contentToDisplay]);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const typographyClasses = `
        prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed font-sans
        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 dark:prose-headings:text-white
        prose-p:my-2 prose-ul:my-2 prose-li:my-0.5
        prose-strong:font-semibold prose-strong:text-slate-900 dark:prose-strong:text-white
        prose-blockquote:bg-red-50 dark:prose-blockquote:bg-red-900/20 
        prose-blockquote:border-l-4 prose-blockquote:border-red-500 
        prose-blockquote:text-red-800 dark:prose-blockquote:text-red-200 
        prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
        prose-blockquote:not-italic prose-blockquote:font-medium prose-blockquote:shadow-sm
        prose-code:font-mono prose-code:text-xs prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-800 dark:prose-code:text-slate-200
    `;

    return (
        <div className={`flex items-start gap-2 md:gap-4 ${isModel ? '' : 'flex-row-reverse'} group animate-in fade-in slide-up duration-500`}>
            <div className={`flex-shrink-0 w-7 h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800 ${isModel ? 'bg-gradient-to-br from-medical-500 to-medical-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                {isModel ? <BotIcon className="w-4 h-4 md:w-6 md:h-6 text-white" /> : <UserIcon className="w-4 h-4 md:w-6 md:h-6 text-slate-500 dark:text-slate-300" />}
            </div>
            
            <div className={`w-full max-w-full md:max-w-[85%] rounded-2xl p-3 md:p-6 relative shadow-sm border transition-all ${isModel ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700' : 'bg-medical-50/50 dark:bg-medical-900/10 border-medical-100 dark:border-medical-900/30'}`}>
                
                {isModel && !isBriefing && !isAnalysis && !isLab && !isStreamingJson && (
                    <button 
                        onClick={handleCopy}
                        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-medical-600 hover:bg-slate-50 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy"
                    >
                        {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                    </button>
                )}

                {message.filePreview && (
                    <div className="mb-4">
                        {message.filePreview.type.startsWith('image/') && message.filePreview.url ? (
                            <div className="relative group inline-block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                <img 
                                    src={message.filePreview.url} 
                                    alt={message.filePreview.name} 
                                    onLoad={onImageLoad}
                                    className="max-w-full md:max-w-sm object-cover block" 
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                            </div>
                        ) : (
                             <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 w-fit shadow-sm">
                                <div className="p-2 bg-slate-100 dark:bg-slate-600 rounded-md">
                                    <DocumentTextIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-slate-700 dark:text-slate-200 line-clamp-1">{message.filePreview.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{message.filePreview.type.split('/')[1] || 'FILE'}</p>
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
                ) : isStreamingJson ? (
                     <div className="flex flex-col gap-4 p-2 w-full min-w-[300px]">
                        <div className="flex items-center gap-3 text-medical-600 dark:text-medical-400">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-mono text-sm font-medium tracking-wide animate-pulse">ANALYZING CLINICAL DATA...</span>
                        </div>
                        <div className="space-y-3 opacity-60">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse delay-75"></div>
                            <div className="h-32 bg-slate-100 dark:bg-slate-700/50 rounded-lg w-full mt-2 border border-dashed border-slate-300 dark:border-slate-600"></div>
                        </div>
                    </div>
                ) : (
                    <div className={typographyClasses} dangerouslySetInnerHTML={{ __html: parsedContent }}></div>
                )}
                
                {/* Citations (Grounding) */}
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-4 bg-medical-500 rounded-full"></div>
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">References & Locations</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => {
                                if (source.web) {
                                    return (
                                        <a 
                                            key={i} 
                                            href={source.web.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-medical-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 hover:border-medical-200 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 transition-all shadow-sm hover:shadow"
                                        >
                                            <LinkIcon className="w-3 h-3 flex-shrink-0 text-medical-500" />
                                            <span className="truncate max-w-[200px]">{source.web.title || new URL(source.web.uri).hostname}</span>
                                        </a>
                                    );
                                }
                                if (source.maps) {
                                    return (
                                        <a 
                                            key={i} 
                                            href={source.maps.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800 hover:border-green-300 px-3 py-1.5 rounded-md text-xs font-medium text-green-800 dark:text-green-300 transition-all shadow-sm hover:shadow"
                                        >
                                            <MapPinIcon className="w-3 h-3 flex-shrink-0 text-green-600 dark:text-green-400" />
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
