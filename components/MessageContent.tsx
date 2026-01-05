import React, { useMemo } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import BriefingReport from './BriefingReport';
import ImageAnalysisReport from './ImageAnalysisReport';
import LabReport from './LabReport';
import InteractionMatrix from './InteractionMatrix';
import ReasoningIndicator from './ReasoningIndicator';
import { isJsonBriefing, isImageAnalysis, isLabReport, isInteractionMatrix } from '../utils';
import { ChatMode } from '../types';

interface MessageContentProps {
    content: string;
    role: 'user' | 'model';
    isLoading: boolean;
    isLast: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ content, role, isLoading, isLast }) => {
    // 1. Detect Specialized Report Types
    const isBriefing = role === 'model' && isJsonBriefing(content);
    const isAnalysis = role === 'model' && isImageAnalysis(content);
    const isLab = role === 'model' && isLabReport(content);
    const isInteraction = role === 'model' && isInteractionMatrix(content);

    // 2. Detect Streaming JSON State (prevent showing raw brackets while generating)
    const isStreamingJson = useMemo(() => {
        if (role !== 'model' || !isLoading || !isLast) return false;
        const trimmed = content.trim();
        const hasJsonStart = trimmed.includes('```json') || trimmed.startsWith('{');
        // If it looks like JSON but isn't a complete recognized report yet
        return hasJsonStart && !(isBriefing || isAnalysis || isLab || isInteraction);
    }, [content, role, isLoading, isLast, isBriefing, isAnalysis, isLab, isInteraction]);

    // 3. Detect Placeholder Loading State
    const isPlaceholderLoading = role === 'model' && isLast && isLoading && !content.trim();

    // 4. Memoized Markdown Parsing (Performance)
    const parsedHtml = useMemo(() => {
        if (isStreamingJson || isPlaceholderLoading || isBriefing || isAnalysis || isLab || isInteraction) return null;
        // Basic markdown parsing
        const html = parse(content, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(html);
    }, [content, isStreamingJson, isPlaceholderLoading, isBriefing, isAnalysis, isLab, isInteraction]);

    // --- RENDERERS ---

    if (isBriefing) return <BriefingReport content={content} />;
    if (isAnalysis) return <ImageAnalysisReport content={content} />;
    if (isLab) return <LabReport content={content} />;
    if (isInteraction) return <InteractionMatrix content={content} />;

    if (isPlaceholderLoading) {
        return <ReasoningIndicator mode={ChatMode.Auto} />;
    }

    if (isStreamingJson) {
        return (
            <div className="flex flex-col gap-2 p-4 w-full min-w-[300px] animate-pulse bg-slate-50 dark:bg-slate-900/50 border-l-2 border-blue-400">
                <div className="flex items-center gap-2 text-blue-500">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-mono text-xs uppercase tracking-widest">Synthesizing Clinical Data Structure...</span>
                </div>
                <div className="space-y-2 opacity-50 mt-2">
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 w-3/4 rounded-sm"></div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 w-1/2 rounded-sm"></div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 w-full rounded-sm"></div>
                </div>
            </div>
        );
    }

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
        <div 
            className={typographyClasses} 
            dangerouslySetInnerHTML={{ __html: parsedHtml || '' }}
        ></div>
    );
};

export default MessageContent;