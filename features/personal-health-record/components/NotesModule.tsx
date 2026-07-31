import React, { useMemo, useState } from 'react';
import {
    BriefingIcon,
    ChevronRightIcon,
    DocumentTextIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import { buildClinicalNotesModuleViewModel } from '../longitudinalModuleViewModels';
import {
    EmptyModuleState,
    MetricGrid,
    ModuleHeader,
    ModuleSearch,
    ModuleSelect,
    ProvenancePanel,
    StatusBadge,
} from './CoreModulePrimitives';

interface NotesModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const statusTone = (
    status: string,
): 'positive' | 'info' | 'warning' | 'neutral' => {
    if (status === 'final') return 'positive';
    if (status === 'amended') return 'info';
    if (status === 'draft') return 'warning';
    return 'neutral';
};

const NotesModule: React.FC<NotesModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [noteType, setNoteType] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildClinicalNotesModuleViewModel(record, {
        search,
        status,
        noteType,
    }), [noteType, record, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Durable longitudinal documentation"
                    title="Clinical notes"
                    description="Reviewed notes stored outside chat, including SOAP notes, visit notes, progress notes, discharge summaries, patient notes, source documents, amendments, and encounter links."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Final',
                            value: viewModel.finalCount,
                            helper: 'reviewed note records',
                        },
                        {
                            label: 'Draft',
                            value: viewModel.draftCount,
                            helper: 'not final',
                            emphasis: viewModel.draftCount > 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Amended',
                            value: viewModel.amendedCount,
                        },
                        {
                            label: 'Confirmed total',
                            value: viewModel.totalConfirmed,
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search title, author, section text, note type, encounter, document, or source"
                        />
                        <ModuleSelect
                            label="Status"
                            value={status}
                            onChange={setStatus}
                            options={[
                                { value: 'all', label: 'All statuses' },
                                ...viewModel.statusOptions.map(value => ({
                                    value,
                                    label: value.replace(/-/g, ' '),
                                })),
                            ]}
                        />
                        <ModuleSelect
                            label="Note type"
                            value={noteType}
                            onChange={setNoteType}
                            options={[
                                { value: 'all', label: 'All note types' },
                                ...viewModel.typeOptions.map(value => ({
                                    value,
                                    label: value.replace(/-/g, ' '),
                                })),
                            ]}
                        />
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title="No confirmed clinical notes match these filters"
                        description="Reviewed scribe output and manually confirmed notes appear here as durable records. Chat messages are not treated as clinical notes."
                        caution="An empty note list does not prove that no visit documentation exists outside this local record."
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                        <BriefingIcon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.title}
                                            </span>
                                            <StatusBadge tone={statusTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            <StatusBadge tone="neutral">
                                                {item.noteTypeLabel}
                                            </StatusBadge>
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            Authored {item.authoredLabel}
                                            {item.author ? ` · ${item.author}` : ''}
                                        </span>
                                        {item.encounter && (
                                            <span className="mt-1 block text-[10px] font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400">
                                                Encounter: {item.encounter.label}
                                                {item.encounter.dateLabel
                                                    ? ` · ${item.encounter.dateLabel}`
                                                    : ''}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="space-y-3">
                                        {item.sections.map((section, index) => (
                                            <section
                                                key={`${item.id}-section-${index}`}
                                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                                            >
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                                        {section.title}
                                                    </h2>
                                                    {section.code && (
                                                        <StatusBadge tone="neutral">
                                                            {section.code}
                                                        </StatusBadge>
                                                    )}
                                                </div>
                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
                                                    {section.text || 'This section is empty.'}
                                                </p>
                                            </section>
                                        ))}
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Source documents
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {item.sourceDocumentIds.length}
                                            </p>
                                            {item.sourceDocumentIds.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {item.sourceDocumentIds.map(documentId => (
                                                        <button
                                                            key={documentId}
                                                            type="button"
                                                            onClick={() => setSource({ documentId })}
                                                            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                                                        >
                                                            <DocumentTextIcon className="h-3 w-3" />
                                                            Open source
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Transcript document
                                            </p>
                                            <p className="mt-1 break-all text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                {item.transcriptDocumentId || 'Not linked'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Amends note
                                            </p>
                                            <p className="mt-1 break-all text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                {item.amendsNoteId || 'No prior note linked'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Sections
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {item.sections.length}
                                            </p>
                                        </div>
                                    </div>

                                    <ProvenancePanel
                                        provenance={item.provenance}
                                        onViewSource={item.provenance.sourceDocument
                                            ? () => setSource(item.provenance.sourceDocument!)
                                            : undefined}
                                    />
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </div>

            {source && (
                <DocumentSourcePreview
                    patientId={record.patientId}
                    source={source}
                    onClose={() => setSource(null)}
                />
            )}
        </div>
    );
};

export default NotesModule;
