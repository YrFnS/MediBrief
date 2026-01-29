
import React, { useEffect, useState } from 'react';
import { useScribeSession } from './useScribeSession';
import { SoapNote } from './types';
import { RecordIcon, StopIcon, ClipboardCheckIcon, DownloadIcon } from '../../components/icons';
import { usePatientStore } from '../patient-management/usePatientStore';

const AudioVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    return (
        <div className="h-16 flex items-center justify-center gap-1 bg-slate-900 rounded-sm border border-slate-800 overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
            {isActive ? (
                [...Array(20)].map((_, i) => (
                    <div 
                        key={i} 
                        className="w-1 bg-blue-500 animate-music" 
                        style={{ 
                            height: '20%', 
                            animationDuration: `${0.4 + Math.random() * 0.5}s`,
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
            className="flex-1 w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-sm p-3 text-sm font-sans leading-relaxed focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none text-slate-800 dark:text-slate-200"
            placeholder={`Waiting for ${title.toLowerCase()} data...`}
        />
    </div>
);

const ScribeInterface: React.FC = () => {
    const { isActive, startSession, stopSession, soapNote, setSoapNote, error } = useScribeSession();
    const actions = usePatientStore(state => state.actions);
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

        // Save as model message
        actions.addFullResponse({ 
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
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
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
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4 rounded-sm text-red-700 dark:text-red-300 text-xs font-mono">
                    ERROR: {error}
                </div>
            )}

            {/* Main Workspace */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                
                {/* Left Column: Subjective & Objective */}
                <div className="flex flex-col gap-4">
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
                </div>

                {/* Right Column: Assessment & Plan + Visualizer */}
                <div className="flex flex-col gap-4">
                     {/* Audio Viz */}
                    <div className="flex-shrink-0">
                        <AudioVisualizer isActive={isActive} />
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm shadow-sm">
                        <NoteSection 
                            title="Assessment" 
                            content={soapNote.assessment} 
                            onChange={(v) => setSoapNote(prev => ({...prev, assessment: v}))}
                        />
                    </div>
                    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-sm shadow-sm">
                        <NoteSection 
                            title="Plan" 
                            content={soapNote.plan} 
                            onChange={(v) => setSoapNote(prev => ({...prev, plan: v}))}
                        />
                    </div>

                    {/* Commit Action */}
                    <button 
                        onClick={handleSave}
                        disabled={isActive && !soapNote.subjective} // Can't save empty while recording essentially
                        className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest text-xs rounded-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaved ? <ClipboardCheckIcon className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
                        {isSaved ? 'Saved to Patient Record' : 'Commit to Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScribeInterface;
