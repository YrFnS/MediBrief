import React, { useEffect, useRef, useState } from 'react';
import {
    ChevronRightIcon,
    ClipboardCheckIcon,
    DownloadIcon,
    RecordIcon,
    StopIcon,
    XCircleIcon,
} from '../../components/icons';
import { useAuditStore } from '../audit/useAuditStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { createReviewedSoapNoteRecord } from '../clinical-record/durableActions';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useScribeSession } from './useScribeSession';

const AudioVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => (
    <div className="relative flex h-12 w-full items-center justify-center gap-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 md:h-16">
        {isActive ? (
            [...Array(20)].map((_, index) => (
                <div
                    key={index}
                    className="h-1/5 w-1.5 rounded-full bg-blue-500 animate-music dark:bg-blue-400"
                    style={{
                        animationDuration: `${0.3 + Math.random() * 0.5}s`,
                        animationDelay: `${Math.random() * 0.2}s`,
                    }}
                />
            ))
        ) : (
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                Ready to Record
            </div>
        )}
    </div>
);

const TranscriptLog: React.FC<{
    transcript: string[];
    onClose?: () => void;
}> = ({ transcript, onClose }) => {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 font-mono shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Live transcript
                    </span>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 transition-colors hover:text-red-500"
                        aria-label="Close transcript"
                    >
                        <XCircleIcon className="h-6 w-6" />
                    </button>
                )}
            </div>
            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4 text-xs">
                {transcript.length === 0 ? (
                    <div className="mt-10 text-center italic text-slate-400 opacity-50">
                        Waiting for speech...
                    </div>
                ) : transcript.map((line, index) => (
                    <div key={index} className="flex gap-3 animate-fade-in">
                        <span className="select-none text-slate-300 dark:text-slate-600">
                            {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="leading-relaxed text-slate-600 dark:text-slate-300">
                            {line}
                        </span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};

const NoteSection: React.FC<{
    title: string;
    content: string;
    onChange: (value: string) => void;
}> = ({ title, content, onChange }) => (
    <div className="flex h-full flex-col gap-1.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                {title}
            </h3>
            <span className="text-[9px] font-mono text-slate-300">
                {content.length}
            </span>
        </div>
        <textarea
            value={content}
            onChange={event => onChange(event.target.value)}
            className="min-h-[100px] w-full flex-1 resize-none rounded-lg border border-transparent bg-slate-50/50 p-3 text-sm leading-relaxed text-slate-800 transition-all placeholder-slate-200 focus:border-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-500/5 dark:bg-slate-900/30 dark:text-slate-200"
            placeholder={`Listening for ${title.toLowerCase()}...`}
        />
    </div>
);

const ScribeInterface: React.FC = () => {
    const {
        isActive,
        startSession,
        stopSession,
        soapNote,
        setSoapNote,
        transcript,
        error,
    } = useScribeSession();

    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[activePatientId],
    );
    const chatActions = useChatStore(state => state.actions);
    const clinicalRecordActions = useClinicalRecordStore(
        state => state.actions,
    );
    const auditActions = useAuditStore(state => state.actions);

    const [isSaved, setIsSaved] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const hasNoteContent = [
        soapNote.subjective,
        soapNote.objective,
        soapNote.assessment,
        soapNote.plan,
    ].some(value => value.trim().length > 0);

    const handleSave = () => {
        setSaveError(null);
        try {
            clinicalRecordActions.initializePatientRecord({
                patientId: activePatientId,
                displayName: activePatient?.name
                    || `Patient ${activePatientId.slice(0, 4)}`,
            });
            const note = createReviewedSoapNoteRecord({
                patientId: activePatientId,
                subjective: soapNote.subjective,
                objective: soapNote.objective,
                assessment: soapNote.assessment,
                plan: soapNote.plan,
                transcript,
                author: 'Local user',
            });
            const result = clinicalRecordActions.addResource(note);
            if (!result.ok) {
                throw new Error(
                    result.message || 'The clinical note could not be saved.',
                );
            }

            const message = `📝 **Clinical note saved**\nA reviewed SOAP note was saved to the structured patient record.\n\n**Record ID:** ${note.id}\n**Status:** Final local note`;
            chatActions.addMessage(activePatientId, {
                role: 'model',
                content: message,
                displayContent: message,
            });
            auditActions.logEvent(
                'CLINICAL_NOTE_SAVED',
                activePatientId,
                'Saved a reviewed ambient-scribe SOAP note to the structured record.',
                'USER',
                {
                    noteId: note.id,
                    sectionTitles: note.sections.map(section => section.title),
                    transcriptLines: transcript.length,
                },
            );

            setIsSaved(true);
            window.setTimeout(() => setIsSaved(false), 2000);
            if (isActive) stopSession();
        } catch (saveFailure) {
            console.error('Unable to save clinical note:', saveFailure);
            setSaveError(
                saveFailure instanceof Error
                    ? saveFailure.message
                    : 'The clinical note could not be saved.',
            );
        }
    };

    return (
        <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#080b14]">
            <div className="flex flex-shrink-0 flex-col justify-between gap-3 border-b border-slate-200 bg-white/50 px-4 py-3 backdrop-blur-sm dark:border-white/5 dark:bg-transparent sm:flex-row sm:items-center md:px-6 md:py-5">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-lg font-display font-bold text-slate-900 dark:text-white md:text-xl">
                        Ambient Scribe
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Beta
                        </span>
                    </h1>
                    <p className="mt-1 text-[10px] text-slate-500">
                        Review every section before saving it to the patient record.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {!isActive ? (
                        <button
                            onClick={() => startSession()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 active:scale-95 sm:flex-none"
                        >
                            <RecordIcon className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold uppercase tracking-widest">
                                Start Recording
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={() => stopSession()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 dark:bg-slate-800 sm:flex-none"
                        >
                            <StopIcon className="h-3.5 w-3.5 text-red-400" />
                            <span className="text-xs font-bold uppercase tracking-widest">
                                Stop Recording
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {(error || saveError) && (
                <div className="mx-4 mt-2 rounded-md border border-red-100 bg-red-50 p-2 text-center text-[10px] font-bold uppercase text-red-600">
                    {saveError || error}
                </div>
            )}

            <div className="relative flex flex-1 flex-col gap-4 overflow-hidden p-3 md:flex-row md:gap-6 md:p-6">
                <div className="flex w-full flex-shrink-0 flex-col gap-3 md:w-1/3">
                    <div className="relative">
                        <AudioVisualizer isActive={isActive} />
                        <button
                            onClick={() => setIsLogOpen(true)}
                            className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:hidden"
                        >
                            <span>Show Transcript</span>
                            <ChevronRightIcon className="h-2.5 w-2.5 rotate-90" />
                        </button>
                    </div>

                    <div className={`flex-1 overflow-hidden transition-all duration-300 ${isLogOpen
                        ? 'fixed inset-0 z-50 bg-white p-4 dark:bg-[#080b14] md:static md:p-0'
                        : 'hidden h-full md:flex'
                    }`}>
                        <TranscriptLog
                            transcript={transcript}
                            onClose={isLogOpen
                                ? () => setIsLogOpen(false)
                                : undefined}
                        />
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                    <div className="custom-scrollbar grid flex-1 grid-cols-1 gap-4 overflow-y-auto pb-24 md:grid-cols-2 md:pb-0">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#0f172a]/50">
                            <NoteSection
                                title="Subjective"
                                content={soapNote.subjective}
                                onChange={value => setSoapNote(previous => ({
                                    ...previous,
                                    subjective: value,
                                }))}
                            />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#0f172a]/50">
                            <NoteSection
                                title="Objective"
                                content={soapNote.objective}
                                onChange={value => setSoapNote(previous => ({
                                    ...previous,
                                    objective: value,
                                }))}
                            />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#0f172a]/50">
                            <NoteSection
                                title="Assessment"
                                content={soapNote.assessment}
                                onChange={value => setSoapNote(previous => ({
                                    ...previous,
                                    assessment: value,
                                }))}
                            />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#0f172a]/50">
                            <NoteSection
                                title="Plan"
                                content={soapNote.plan}
                                onChange={value => setSoapNote(previous => ({
                                    ...previous,
                                    plan: value,
                                }))}
                            />
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-slate-50/90 p-4 backdrop-blur-md dark:border-white/5 dark:bg-[#080b14]/90 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                        <button
                            onClick={handleSave}
                            disabled={isActive || !hasNoteContent}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                        >
                            {isSaved
                                ? <ClipboardCheckIcon className="h-4 w-4" />
                                : <DownloadIcon className="h-4 w-4" />}
                            <span>
                                {isSaved
                                    ? 'Saved to Patient Record'
                                    : 'Save Reviewed Note'}
                            </span>
                        </button>
                        {!hasNoteContent && !isActive && (
                            <p className="mt-2 text-center text-[9px] font-mono uppercase tracking-tight text-slate-400">
                                Enter or record at least one note section before saving
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScribeInterface;
