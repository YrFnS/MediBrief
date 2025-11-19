
import React, { useMemo, useState } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '../types';
import { UserIcon, BotIcon, LinkIcon, DocumentTextIcon, ClipboardIcon, CheckIcon } from './icons';
import BriefingReport from './BriefingReport';
import ImageAnalysisReport from './ImageAnalysisReport';
import { isJsonBriefing, isImageAnalysis } from '../utils';

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
    
    // Detection for complete JSON responses
    const isBriefing = isModel && isJsonBriefing(message.content);
    const isAnalysis = isModel && isImageAnalysis(message.content);

    // Robust detection for IN-PROGRESS JSON streaming
    // We hide the "raw" text while it's building the JSON structure
    const isStreamingJson = useMemo(() => {
        if (!isModel || !isLoading || !isLast) return false;
        const content = message.content.trim();
        
        // If we see the start of a code block or object, but haven't finished, assume streaming.
        // Or if we have the triggers but parsing failed (via util checks).
        const hasJsonStart = content.includes('```json') || content.startsWith('{');
        const isComplete = isBriefing || isAnalysis; 
        
        return hasJsonStart && !isComplete;
    }, [message.content, isModel, isLoading, isLast, isBriefing, isAnalysis]);

    const parsedContent = useMemo(() => {
        const html = parse(contentToDisplay, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(html);
    }, [contentToDisplay]);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Refined typography for medical readability
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
        <div className={`flex items-start gap-3 md:gap-4 ${isModel ? '' : 'flex-row-reverse'} group animate-in fade-in slide-up duration-500`}>
            <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800 ${isModel ? 'bg-gradient-to-br from-medical-500 to-medical-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                {isModel ? <BotIcon className="w-5 h-5 md:w-6 md:h-6 text-white" /> : <UserIcon className="w-5 h-5 md:w-6 md:h-6 text-slate-500 dark:text-slate-300" />}
            </div>
            
            <div className={`w-full max-w-full md:max-w-[85%] rounded-2xl p-4 md:p-6 relative shadow-sm border transition-all ${isModel ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700' : 'bg-medical-50/50 dark:bg-medical-900/10 border-medical-100 dark:border-medical-900/30'}`}>
                
                {isModel && !isBriefing && !isAnalysis && !isStreamingJson && (
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

                {/* Rendering Logic Switch */}
                {isBriefing ? (
                    <BriefingReport content={message.content} />
                ) : isAnalysis ? (
                    <ImageAnalysisReport content={message.content} />
                ) : isStreamingJson ? (
                     /* Skeleton Loader for Streaming State */
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
                
                {/* Citations */}
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-4 bg-medical-500 rounded-full"></div>
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">References</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => source.web && (
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
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;
