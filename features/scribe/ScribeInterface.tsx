
import React, { useEffect, useState, useRef } from 'react';
import { useScribeSession } from './useScribeSession';
import { SoapNote } from './types';
import { RecordIcon, StopIcon, ClipboardCheckIcon, DownloadIcon, MicrophoneIcon, ChevronRightIcon, ListChecksIcon, XCircleIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';

const AudioVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    return (
        <div className={`h-12 md:h-16 flex items-center justify-center gap-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-sm w-full transition-all`}>
            {isActive ? (
                [...Array(isActive ? 20 : 0)].map((_, i) => (
                    <div 
                        key={i} 
                        className="w-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-music" 
                        style={{ 
                            height: '20%', 
                            animationDuration: `${0.3 + Math.random() * 0.5}s`,
                            animationDelay: `${Math.random() * 0.2}s`
                        }} 
                    />
                ))
            ) : (
                <div className="text-slate-400 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                    Ready to Record
                </div>
            )}
        </div>
    );
};

const TranscriptLog: React.FC<{ transcript: string[], onClose?: () => void }> = ({ transcript, onClose }) => {
    const endRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden font-mono shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Live_Audit_Log</span>
                </div>
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="Close log"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
                {transcript.length === 0 ? (
                    <div className="text-slate-400 italic text-center mt-10 opacity-50">Waiting for speech...</div>
                ) : (
                    transcript.map((line, i) => (
                        <div key={i} className="flex gap-3 animate-fade-in">
                            <span className="text-slate-300 dark:text-slate-600 select-none">{(i + 1).toString().padStart(2, '0')}</span>
                            <span className="text-slate-600 dark:text-slate-300 leading-relaxed">{line}</span>
                        </div>
                    ))
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
};

const NoteSection: React.FC<{ 
    title: string; 
    content: string; 
    onChange: (val: string) => void 
}> = ({ title, content, onChange }) => (
    <div className="flex flex-col gap-1.5 h-full">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</h3>
            <span className="text-[9px] text-slate-300 font-mono">{content.length}</span>
        </div>
        <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="w-full flex-1 bg-slate-50/50 dark:bg-slate-900/30 border border-transparent focus:border-blue-100 rounded-lg p-3 text-sm leading-relaxed focus:ring-4 focus:ring-blue-500/5 focus:outline-none resize-none text-slate-800 dark:text-slate-200 transition-all placeholder-slate-200 min-h-[100px]"
            placeholder={`Listening for ${title.toLowerCase()}...`}
        />
    </div>
);

const ScribeInterface: React.FC = () => {
    const { isActive, startSession, stopSession, soapNote, setSoapNote, transcript, error } = useScribeSession();
    
    const activePatientId = usePatientStore(state => state.activePatientId);
    const chatActions = useChatStore(state => state.actions);
    
    const [isSaved, setIsSaved] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);

    const handleSave = () => {
        const timestamp = new Date().toLocaleString();
        const noteContent = `**SOAP NOTE - AMBIENT SCRIBE**\n**Date:** ${timestamp}\n\n**Subjective:**\n${soapNote.subjective || 'N/A'}\n\n**Objective:**\n${soapNote.objective || 'N/A'}\n\n**Assessment:**\n${soapNote.assessment || 'N/A'}\n\n**Plan:**\n${soapNote.plan || 'N/A'}`.trim();

        chatActions.addMessage(activePatientId, { role: 'model', content: noteContent, displayContent: noteContent });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        if (isActive) stopSession();
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#080b14] relative">
            
            {/* Header Area */}
            <div className="px-4 py-3 md:px-6 md:py-5 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-transparent backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
                <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Ambient Scribe <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-bold uppercase tracking-wider">BETA</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {!isActive ? (
                        <button 
                            onClick={() => startSession()}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-600/20 transition-all active:scale-95"
                        >
                            <RecordIcon className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold uppercase tracking-widest">Start Recording</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => stopSession()}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-full shadow-lg transition-all active:scale-95"
                        >
                            <StopIcon className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-xs font-bold uppercase tracking-widest">Stop & Finalize</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mx-4 mt-2 p-2 bg-red-50 text-red-600 text-[10px] font-bold uppercase text-center rounded-md border border-red-100">
                    {error}
                </div>
            )}

            {/* Main Workspace Layout */}
            <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden p-3 md:p-6 gap-4 md:gap-6">
                
                {/* Visualizer & Log Panel */}
                <div className="flex flex-col gap-3 w-full md:w-1/3 flex-shrink-0">
                    <div className="relative">
                        <AudioVisualizer isActive={isActive} />
                        <button 
                            onClick={() => setIsLogOpen(true)}
                            className="md:hidden absolute bottom-2 right-3 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-[9px] font-bold uppercase text-slate-500 border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            <span>Show Log</span>
                            <ChevronRightIcon className="w-2.5 h-2.5 rotate-90" />
                        </button>
                    </div>

                    {/* Mobile Log Drawer vs Desktop Sidebar */}
                    <div className={`
                        flex-1 overflow-hidden transition-all duration-300
                        ${isLogOpen ? 'fixed inset-0 z-50 bg-white dark:bg-[#080b14] p-4 md:static md:p-0' : 'hidden md:flex h-full'}
                    `}>
                        <TranscriptLog 
                            transcript={transcript} 
                            onClose={isLogOpen ? () => setIsLogOpen(false) : undefined} 
                        />
                    </div>
                </div>

                {/* Documentation Editor */}
                <div className="flex-1 flex flex-col overflow-hidden gap-4 min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4 pb-24 md:pb-0">
                        <div className="bg-white dark:bg-[#0f172a]/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <NoteSection title="Subjective" content={soapNote.subjective} onChange={(v) => setSoapNote(prev => ({...prev, subjective: v}))} />
                        </div>
                        <div className="bg-white dark:bg-[#0f172a]/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <NoteSection title="Objective" content={soapNote.objective} onChange={(v) => setSoapNote(prev => ({...prev, objective: v}))} />
                        </div>
                        <div className="bg-white dark:bg-[#0f172a]/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <NoteSection title="Assessment" content={soapNote.assessment} onChange={(v) => setSoapNote(prev => ({...prev, assessment: v}))} />
                        </div>
                        <div className="bg-white dark:bg-[#0f172a]/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <NoteSection title="Plan" content={soapNote.plan} onChange={(v) => setSoapNote(prev => ({...prev, plan: v}))} />
                        </div>
                    </div>

                    {/* Commit Action - Pinned on Mobile */}
                    <div className="fixed md:static bottom-0 left-0 right-0 p-4 md:p-0 bg-slate-50/90 dark:bg-[#080b14]/90 md:bg-transparent backdrop-blur-md md:backdrop-blur-none z-20 border-t md:border-0 border-slate-200 dark:border-white/5">
                        <button 
                            onClick={handleSave}
                            disabled={isActive || !soapNote.subjective} 
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
                        >
                            {isSaved ? <ClipboardCheckIcon className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                            <span>{isSaved ? 'Handoff Artifact Generated' : 'Commit to Record'}</span>
                        </button>
                        {!soapNote.subjective && !isActive && (
                            <p className="text-[9px] text-center text-slate-400 mt-2 uppercase font-mono tracking-tight">Requires data input before commit</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ScribeInterface;
