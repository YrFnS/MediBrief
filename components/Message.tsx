import React, { useMemo } from 'react';
import type { ChatMessage } from '../types';
import { UserIcon, BotIcon, LinkIcon, DocumentTextIcon } from './icons';
import BriefingReport from './BriefingReport';

// TypeScript declaration for the 'marked' library loaded from CDN
declare const marked: any;

// Helper to check if a message content is a valid JSON briefing
const isJsonBriefing = (content: string): boolean => {
    try {
        const data = JSON.parse(content);
        return typeof data === 'object' && data !== null && 'briefingTitle' in data && 'sections' in data;
    } catch (e) {
        return false;
    }
};

const Message: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isModel = message.role === 'model';

    const contentToDisplay = (message.role === 'user' && message.displayContent) ? message.displayContent : message.content;
    
    const isBriefing = isModel && isJsonBriefing(message.content);

    // Use the 'marked' library for robust markdown parsing
    const parsedContent = useMemo(() => {
        if (typeof marked === 'undefined') {
            // Fallback for when marked is not loaded yet
            return contentToDisplay.replace(/\n/g, '<br>');
        }
        // Configure marked to treat newlines as <br> tags
        return marked.parse(contentToDisplay, { breaks: true, gfm: true });
    }, [contentToDisplay]);

    return (
        <div className={`flex items-start gap-4 ${isModel ? '' : 'flex-row-reverse'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isModel ? 'bg-blue-500' : 'bg-slate-400'}`}>
                {isModel ? <BotIcon className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
            </div>
            <div className={`w-full max-w-full rounded-xl p-4 ${isModel ? 'bg-white dark:bg-slate-800 shadow' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                {message.filePreview && (
                    <div className="mb-3">
                        {message.filePreview.type.startsWith('image/') && message.filePreview.url ? (
                            <img src={message.filePreview.url} alt={message.filePreview.name} className="max-w-xs max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />
                        ) : (
                             <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 max-w-xs">
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
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: parsedContent }}></div>
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