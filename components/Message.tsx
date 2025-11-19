
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
    
    // Improved detection for complete JSON responses
    const isBriefing = isModel && isJsonBriefing(message.content);
    const isAnalysis = isModel && isImageAnalysis(message.content);

    // Improved detection for IN-PROGRESS JSON streaming
    // We assume it's streaming a report if it looks like code or starts with { but isn't complete yet
    const isStreamingJson = useMemo(() => {
        if (!isModel || !isLoading || !isLast) return false;
        const content = message.content.trim();
        
        // Strong indicator of streaming JSON
        const hasJsonStart = content.includes('```json') || content.startsWith('{');
        // If we have the start but NOT a clean finish (valid JSON), we are streaming
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

    const typographyClasses = `
        prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed
        prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
        prose-p:my-2 prose-ul:my-2 prose-li:my-0.5
        prose-blockquote:bg-red-50 dark:prose-blockquote:bg-red-900/10 
        prose-blockquote:border-l-4 prose-blockquote:border-red-500 
        prose-blockquote:text-red-700 dark:prose-blockquote:text-red-300 
        prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
        prose-blockquote:not-italic prose-blockquote:font-medium
        prose-strong:font-semibold
    `;

    return (
        <div className={`flex items-start gap-3 md:gap-4 ${isModel ? '' : 'flex-row-reverse'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-sm ${isModel ? 'bg-gradient-to-br from-medical-500 to-medical-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                {isModel ? <BotIcon className="w-5 h-5 md:w-6 md:h-6 text-white" /> : <UserIcon className="w-5 h-5 md:w-6 md:h-6 text-slate-500 dark:text-slate-300" />}
            </div>
            
            <div className={`w-full max-w-full md:max-w-[85%] rounded-2xl p-4 md:p-5 relative shadow-sm border ${isModel ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700' : 'bg-medical-50 dark:bg-medical-900/20 border-medical-100 dark:border-medical-800/30'}`}>
                
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
                            <img 
                                src={message.filePreview.url} 
                                alt={message.filePreview.name} 
                                onLoad={onImageLoad}
                                className="max-w-full md:max-w-sm rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm object-cover" 
                            />
                        ) : (
                             <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 w-fit">
                                <div className="p-2 bg-slate-100 dark:bg-slate-600 rounded-md">
                                    <DocumentTextIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-slate-700 dark:text-slate-200 line-clamp-1">{message.filePreview.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{message.filePreview.type.split('/')[1] || 'FILE'}</p>
                                 </div>
                            </div>
                        )}
                    </div>
                )}

                {isBriefing ? (
                    <BriefingReport content={message.content} />
                ) : isAnalysis ? (
                    <ImageAnalysisReport content={message.content} />
                ) : isStreamingJson ? (
                     <div className="flex flex-col gap-3 p-2 w-full">
                        <div className="flex items-center gap-2 text-medical-600 dark:text-medical-400 animate-pulse">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-mono text-sm font-medium">Analyzing Clinical Data...</span>
                        </div>
                        {/* Skeleton UI for the report */}
                        <div className="space-y-2 opacity-50">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                            <div className="h-20 bg-slate-100 dark:bg-slate-700/50 rounded-lg w-full mt-2 border border-dashed border-slate-300 dark:border-slate-600"></div>
                        </div>
                    </div>
                ) : (
                    <div className={typographyClasses} dangerouslySetInnerHTML={{ __html: parsedContent }}></div>
                )}
                
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-medical-500"></div>
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Citations</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => source.web && (
                                <a 
                                    key={i} 
                                    href={source.web.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-medical-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 hover:border-medical-200 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 transition-colors"
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
