
import React, { useEffect, useState, useRef } from 'react';
import { useScribeSession } from './useScribeSession';
import { SoapNote } from './types';
import { RecordIcon, StopIcon, ClipboardCheckIcon, DownloadIcon, MicrophoneIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';

const AudioVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    return (
        <div className="h-12 flex items-center justify-center gap-1 bg-slate-900 rounded-sm border border-slate-800 overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
            {isActive ? (
                [...Array(30)].map((_, i) => (
                    <div 
                        key={i} 
                        className="w-1 bg-blue-500 animate-music" 
                        style={{ 
                            height: '20%', 
                            animationDuration: `${0.3 + Math.random() * 0.5}s`,
                            animationDelay: `${Math.random() * 0.2}s`
                        }} 
                    />
                ))
            ) : (
                <div className="text-slate-600 text-xs font-mono uppercase tracking-widest">
                    Audio Stream Inactive
                </div>
            )}
        </div>
    );
};

const TranscriptLog: React.FC<{ transcript: string[] }> = ({ transcript }) => {
    const endRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-sm overflow-hidden font-mono">
            <div className="px-3 py-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Transcript Feed</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {transcript.length === 0 ? (
                    <div className="text-slate-600 text-xs italic text-center mt-10">Waiting for speech input...</div>
                ) : (
                    transcript.map((line, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                            <span className="text-slate-600 select-none">{(i + 1).toString().padStart(2, '0')}</span>
                            <span className="text-slate-300 leading-relaxed">{line}</span>
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
    <div className="flex flex-col gap-2 h-full">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
            <span className="text-[9px] text-slate-400">{content.length} chars</span>
        </div>
        <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-sm p-3 text-sm font-sans leading-relaxed focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none text-slate-800 dark:text-slate-200 transition-colors"
            placeholder={`Waiting for ${title.toLowerCase()} data...`}
        />
    </div>
);

const ScribeInterface: React.FC = () => {
    const { isActive, startSession, stopSession, soapNote, setSoapNote, transcript, error } = useScribeSession();
    
    const activePatientId = usePatientStore(state => state.activePatientId);
    const chatActions = useChatStore(state => state.actions);
    
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = () => {
        const timestamp = new Date().toLocaleString();
        const noteContent = `
**SOAP NOTE - AMBIENT SCRIBE**
**Date:** ${timestamp}

**Subjective:**
${soapNote.subjective || 'N/A'}

**Objective:**
${soapNote.objective || 'N/A'}

**Assessment:**
${soapNote.assessment || 'N/A'}

**Plan:**
${soapNote.plan || 'N/A'}
        `.trim();

        // Save as model message in Chat Store
        chatActions.addMessage(activePatientId, { 
            role: 'model', 
            content: noteContent,
            displayContent: noteContent 
        });

        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        
        // Also stop session if active
        if (isActive) stopSession();
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-slate-950 p-3 md:p-6 relative">
            
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 flex-shrink-0">
                <div>
                    <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        AMBIENT SCRIBE <span className="text-blue-500">v1.0</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                        Passive listening mode. AI synthesizes consultation into structured SOAP format.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {!isActive ? (
                        <button 
                            onClick={() => startSession()}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-sm shadow-lg transition-all active:translate-y-0.5"
                        >
                            <RecordIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Start Recording</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => stopSession()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-sm shadow-lg transition-all active:translate-y-0.5 animate-pulse"
                        >
                            <StopIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Stop & Finalize</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4 rounded-sm text-red-700 dark:text-red-300 text-xs font-mono flex-shrink-0">
                    ERROR: {error}
                </div>
            )}

            {/* Main Workspace Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
                
                {/* LEFT: SOAP Note Editor (8 cols) */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-hidden">
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm shadow-sm">
                        <NoteSection 
                            title="Subjective" 
                            content={soapNote.subjective} 
                            onChange={(v) => setSoapNote(prev => ({...prev, subjective: v}))}
                        />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm shadow-sm">
                        <NoteSection 
                            title="Objective" 
                            content={soapNote.objective} 
                            onChange={(v) => setSoapNote(prev => ({...prev, objective: v}))}
                        />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm shadow-sm">
                        <NoteSection 
                            title="Assessment" 
                            content={soapNote.assessment} 
                            onChange={(v) => setSoapNote(prev => ({...prev, assessment: v}))}
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm shadow-sm">
                            <NoteSection 
                                title="Plan" 
                                content={soapNote.plan} 
                                onChange={(v) => setSoapNote(prev => ({...prev, plan: v}))}
                            />
                        </div>
                        {/* Commit Action placed here for easy access */}
                        <button 
                            onClick={handleSave}
                            disabled={isActive && !soapNote.subjective} 
                            className="flex-shrink-0 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs rounded-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaved ? <ClipboardCheckIcon className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                            {isSaved ? 'Saved to Patient Record' : 'Commit to Record'}
                        </button>
                    </div>
                </div>

                {/* RIGHT: Live Feed & Visuals (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4 h-full min-h-[300px]">
                     {/* Audio Viz */}
                    <div className="flex-shrink-0">
                        <AudioVisualizer isActive={isActive} />
                    </div>

                    {/* Transcript Log */}
                    <div className="flex-1 min-h-0">
                        <TranscriptLog transcript={transcript} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScribeInterface;
