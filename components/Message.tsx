import React, { useMemo } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '../types';
import { UserIcon, BotIcon, LinkIcon, DocumentTextIcon } from './icons';
import BriefingReport from './BriefingReport';
import ImageAnalysisReport from './ImageAnalysisReport';
import { isJsonBriefing, isImageAnalysis } from '../utils';

// PERFORMANCE FIX: "The Hook Hoarder"
// Move hook configuration OUTSIDE the component.
// DOMPurify hooks are global. Adding them inside the component adds a NEW duplicate hook
// every time a message renders, eventually crashing the browser tab.
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
}

const Message: React.FC<MessageProps> = ({ message, isLoading, isLast }) => {
    const isModel = message.role === 'model';

    const contentToDisplay = (message.role === 'user' && message.displayContent) ? message.displayContent : message.content;
    
    const isBriefing = isModel && isJsonBriefing(message.content);
    const isAnalysis = isModel && isImageAnalysis(message.content);

    // Detect if we are likely streaming a JSON object but it's not complete/valid yet.
    // This prevents "flashing" raw JSON characters to the user.
    const isStreamingJson = useMemo(() => {
        if (!isModel || !isLoading || !isLast) return false;
        const content = message.content;
        
        // Check if there is an opening JSON code block
        const hasJsonBlockStart = content.includes('```json');
        // Check if there is a closing code block AFTER the opening one
        const hasJsonBlockEnd = hasJsonBlockStart && content.includes('```', content.indexOf('```json') + 7);
        
        // If we started a block but haven't closed it, we are streaming
        if (hasJsonBlockStart && !hasJsonBlockEnd) return true;

        // Check for raw object start
        const trimmed = content.trim();
        if (trimmed.startsWith('{') && !trimmed.endsWith('}')) return true;

        return false;
    }, [message.content, isModel, isLoading, isLast]);

    const parsedContent = useMemo(() => {
        // Configure marked to treat newlines as <br> tags
        const html = parse(contentToDisplay, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(html);
    }, [contentToDisplay]);

    // Define specific typography overrides for Safety Alerts.
    const typographyClasses = `
        prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200
        prose-blockquote:bg-red-50 dark:prose-blockquote:bg-red-900/20 
        prose-blockquote:border-l-4 prose-blockquote:border-red-600 
        prose-blockquote:text-red-800 dark:prose-blockquote:text-red-200 
        prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:rounded-r-md 
        prose-blockquote:not-italic prose-blockquote:font-medium
        prose-blockquote:shadow-sm prose-blockquote:my-4
        prose-strong:text-slate-900 dark:prose-strong:text-slate-100
    `;

    return (
        <div className={`flex items-start gap-4 ${isModel ? '' : 'flex-row-reverse'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isModel ? 'bg-blue-500' : 'bg-slate-400'}`}>
                {isModel ? <BotIcon className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
            </div>
            <div className={`w-full max-w-full rounded-xl p-4 ${isModel ? 'bg-white dark:bg-slate-800 shadow' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                {message.filePreview && (
                    <div className="mb-3">
                        {message.filePreview.type.startsWith('image/') && message.filePreview.url ? (
                            <img src={message.filePreview.url} alt={message.filePreview.name} className="max-w-[250px] w-full max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />
                        ) : (
                             <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 max-w-[250px] w-full">
                                <DocumentTextIcon className="w-8 h-8 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                                <div className="overflow-hidden">
                                    <p className="font-semibold text-sm truncate text-slate-700 dark:text-slate-200">{message.filePreview.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{message.filePreview.type}</p>
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
                     <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 italic p-2 animate-pulse">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Generating structured report...</span>
                    </div>
                ) : (
                    <div className={typographyClasses} dangerouslySetInnerHTML={{ __html: parsedContent }}></div>
                )}
                
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Sources:</h4>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, i) => source.web && (
                                <a 
                                    key={i} 
                                    href={source.web.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-2 py-1 rounded-md text-xs text-slate-600 dark:text-slate-300 transition-colors"
                                >
                                    <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{source.web.title || source.web.uri}</span>
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