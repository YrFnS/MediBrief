import React, { useMemo } from 'react';
import type { ChatMessage } from '../types';
import { UserIcon, BotIcon, LinkIcon } from './icons';

interface MessageProps {
    message: ChatMessage;
}

// Basic markdown-to-HTML converter
const parseMarkdown = (text: string) => {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 rounded px-1 py-0.5 font-mono text-sm">$1</code>')
        .replace(/(\r\n|\r|\n){2,}/g, '<br><br>') 
        .replace(/(\r\n|\r|\n)/g, '<br>'); 
        
    // Handle lists
    html = html.replace(/<br>\s*-\s/g, '<li>');
    html = html.replace(/(<li>.*?)<br><br>/g, '$1</li></ul><ul>');
    html = `<ul>${html}</ul>`.replace(/<ul><br>/g, '<ul>');
    if (html.endsWith('</li></ul>')) {
      // no closing br
    } else {
       html = html.replace(/<li>(.*?)<br>/g, '<li>$1</li>');
    }

    html = html.replace(/<\/li><ul>/g, '</li></ul>').replace(/<\/ul><ul>/g, '');


    return html;
};


const Message: React.FC<MessageProps> = ({ message }) => {
    const isModel = message.role === 'model';

    const contentToDisplay = (message.role === 'user' && message.displayContent) ? message.displayContent : message.content;
    const parsedContent = useMemo(() => parseMarkdown(contentToDisplay), [contentToDisplay]);

    return (
        <div className={`flex items-start gap-4 ${isModel ? '' : 'flex-row-reverse'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isModel ? 'bg-blue-500' : 'bg-slate-400'}`}>
                {isModel ? <BotIcon className="w-5 h-5 text-white" /> : <UserIcon className="w-5 h-5 text-white" />}
            </div>
            <div className={`w-full max-w-full rounded-xl p-4 ${isModel ? 'bg-white dark:bg-slate-800 shadow' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                {message.filePreview && (
                    <div className="mb-3">
                        <img src={message.filePreview.url} alt="Uploaded content" className="max-w-xs max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />
                    </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: parsedContent }}></div>
                
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