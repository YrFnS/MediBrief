
import React, { useEffect, useState, useRef } from 'react';
import { useScribeSession } from './useScribeSession';
import { SoapNote } from './types';
import { RecordIcon, StopIcon, ClipboardCheckIcon, DownloadIcon, MicrophoneIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';

const AudioVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    return (
        <div className="h-16 flex items-center justify-center gap-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-sm">
            {isActive ? (
                [...Array(30)].map((_, i) => (
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
                <div className="text-slate-400 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                    Ready to Record
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
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden font-mono min-h-[150px]">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-center gap-2 sticky top-0 z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Live Transcript</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {transcript.length === 0 ? (
                    <div className="text-slate-400 text-xs italic text-center mt-10">Waiting for speech input...</div>
                ) : (
                    transcript.map((line, i) => (
                        <div key={i} className="flex gap-3 text-xs">
                            <span className="text-slate-300 dark:text-slate-600 select-none font-bold">{(i + 1).toString().padStart(2, '0')}</span>
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
    <div className="flex flex-col gap-2 h-full min-h-[180px]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
            <span className="text-[9px] text-slate-300 font-mono">{content.length} chars</span>
        </div>
        <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 w-full bg-slate-50 dark:bg-slate-900/30 border border-transparent focus:border-blue-100 dark:focus:border-blue-900 rounded-lg p-3 text-sm font-sans leading-relaxed focus:ring-2 focus:ring-blue-500/10 focus:outline-none resize-none text-slate-800 dark:text-slate-200 transition-all placeholder-slate-300"
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

        chatActions.addMessage(activePatientId, { 
            role: 'model', 
            content: noteContent,
            displayContent: noteContent 
        });

        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        if (isActive) stopSession();
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 p-2 md:p-6 relative">
            
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 flex-shrink-0">
                <div>
                    <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Ambient Scribe <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold tracking-wide">BETA</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Passive listening mode. Synthesizes consultation into structured SOAP format.
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {!isActive ? (
                        <button 
                            onClick={() => startSession()}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg hover:shadow-red-500/20 transition-all active:translate-y-0.5 group"
                        >
                            <div className="bg-white/20 p-1 rounded-full"><RecordIcon className="w-3 h-3" /></div>
                            <span className="text-xs font-bold uppercase tracking-wide">Start Recording</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => stopSession()}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg transition-all active:translate-y-0.5"
                        >
                            <StopIcon className="w-3 h-3 text-red-400" />
                            <span className="text-xs font-bold uppercase tracking-wide">Stop & Finalize</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 p-3 mb-4 rounded-lg text-red-600 text-xs font-medium flex-shrink-0">
                    {error}
                </div>
            )}

            {/* Main Workspace Grid - Responsive Layout */}
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0">
                
                {/* RIGHT PANEL (Visualizer/Transcript) - Moved to TOP on mobile via Order */}
                <div className="lg:col-span-4 flex flex-col gap-4 flex-shrink-0 lg:h-full min-h-[250px] lg:min-h-0 order-1 lg:order-2">
                    <div className="flex-shrink-0">
                        <AudioVisualizer isActive={isActive} />
                    </div>
                    <div className="flex-1 min-h-0 h-[200px] lg:h-auto shadow-sm">
                        <TranscriptLog transcript={transcript} />
                    </div>
                </div>

                {/* LEFT PANEL (SOAP Note Editor) - Stacks on mobile */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0 lg:h-full lg:overflow-y-auto order-2 lg:order-1">
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5 rounded-xl shadow-float transition-shadow hover:shadow-lg">
                        <NoteSection 
                            title="Subjective" 
                            content={soapNote.subjective} 
                            onChange={(v) => setSoapNote(prev => ({...prev, subjective: v}))}
                        />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5 rounded-xl shadow-float transition-shadow hover:shadow-lg">
                        <NoteSection 
                            title="Objective" 
                            content={soapNote.objective} 
                            onChange={(v) => setSoapNote(prev => ({...prev, objective: v}))}
                        />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5 rounded-xl shadow-float transition-shadow hover:shadow-lg">
                        <NoteSection 
                            title="Assessment" 
                            content={soapNote.assessment} 
                            onChange={(v) => setSoapNote(prev => ({...prev, assessment: v}))}
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5 rounded-xl shadow-float transition-shadow hover:shadow-lg">
                            <NoteSection 
                                title="Plan" 
                                content={soapNote.plan} 
                                onChange={(v) => setSoapNote(prev => ({...prev, plan: v}))}
                            />
                        </div>
                        <button 
                            onClick={handleSave}
                            disabled={isActive && !soapNote.subjective} 
                            className="flex-shrink-0 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isSaved ? <ClipboardCheckIcon className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                            {isSaved ? 'Saved to Patient Record' : 'Commit to Record'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ScribeInterface;
