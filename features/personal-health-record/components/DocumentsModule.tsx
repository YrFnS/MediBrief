import React, { useMemo, useState } from 'react';
import {
    ChevronRightIcon,
    DocumentTextIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import DocumentExtractionStatusPanel from '../../openmed/components/DocumentExtractionStatusPanel';
import { buildDocumentsModuleViewModel } from '../longitudinalModuleViewModels';
import {
    EmptyModuleState,
    MetricGrid,
    ModuleHeader,
    ModuleSearch,
    ModuleSelect,
    ProvenancePanel,
    StatusBadge,
} from './CoreModulePrimitives';

interface DocumentsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const statusTone = (
    status: string,
): 'positive' | 'warning' | 'neutral' => {
    if (status === 'current') return 'positive';
    if (status === 'superseded') return 'warning';
    return 'neutral';
};

const DocumentsModule: React.FC<DocumentsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [mimeFamily, setMimeFamily] = useState('all');
    const [documentType, setDocumentType] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildDocumentsModuleViewModel(record, {
        search,
        status,
        mimeFamily,
        documentType,
    }), [documentType, mimeFamily, record, search, status]);
    const documentsById = useMemo(
        () => new Map(record.resources.documents.map(document => [
            document.id,
            document,
        ])),
        [record.resources.documents],
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Local source library"
                    title="Documents"
                    description="Confirmed local document references with authored dates, upload provenance, file type, page count, descriptions, related clinical records, direct source preview, and local PDF/OCR extraction status."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current',
                            value: viewModel.currentCount,
                        },
                        {
                            label: 'Superseded',
                            value: viewModel.supersededCount,
                            emphasis: viewModel.supersededCount > 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Confirmed total',
                            value: viewModel.totalConfirmed,
                        },
                        {
                            label: 'Pending review',
                            value: viewModel.candidateCount,
                            emphasis: viewModel.candidateCount > 0
                                ? 'warning'
                                : 'default',
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                        <strong>Authored date</strong> describes when the source document was created when known. <strong>Uploaded date</strong> describes when it entered this browser. Upload time never replaces an unknown authored or clinical date. Embedded text and OCR output are derived local evidence; the original file remains authoritative.
                    </p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search title, filename, type, description, related record, MIME type, hash, or source"
                        />
                        <ModuleSelect
                            label="Status"
                            value={status}
                            onChange={setStatus}
                            options={[
                                { value: 'all', label: 'All statuses' },
                                { value: 'current', label: 'Current' },
                                { value: 'superseded', label: 'Superseded' },
                            ]}
                        />
                        <ModuleSelect
                            label="File family"
                            value={mimeFamily}
                            onChange={setMimeFamily}
                            options={[
                                { value: 'all', label: 'All file families' },
                                ...viewModel.mimeFamilyOptions.map(value => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                        />
                        <ModuleSelect
                            label="Document type"
                            value={documentType}
                            onChange={setDocumentType}
                            options={[
                                { value: 'all', label: 'All document types' },
                                ...viewModel.documentTypeOptions.map(value => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                        />
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title="No confirmed documents match these filters"
                        description="Uploaded files appear here after their document reference is stored and confirmed. Missing binary assets and local extraction failures remain explicit."
                        caution="An empty local document library does not prove that no external report, prescription, image, or note exists."
                    />
                ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {viewModel.items.map(item => {
                            const document = documentsById.get(item.id);
                            return (
                                <details
                                    key={item.id}
                                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                                >
                                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                        <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            <DocumentTextIcon className="h-5 w-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="break-words text-sm font-bold text-slate-950 dark:text-white">
                                                    {item.title}
                                                </span>
                                                <StatusBadge tone={statusTone(item.status)}>
                                                    {item.statusLabel}
                                                </StatusBadge>
                                                <StatusBadge tone="neutral">
                                                    {item.mimeFamily}
                                                </StatusBadge>
                                                {!item.knownClinicalDate && (
                                                    <StatusBadge tone="warning">
                                                        Authored date unknown
                                                    </StatusBadge>
                                                )}
                                            </span>
                                            <span className="mt-1 block break-all text-xs text-slate-500 dark:text-slate-400">
                                                {item.fileName}
                                            </span>
                                            <span className="mt-1 block text-[10px] font-mono uppercase tracking-wide text-slate-400">
                                                Authored {item.authoredLabel} · Uploaded {item.uploadedLabel}
                                            </span>
                                        </span>
                                        <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                    </summary>

                                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {[
                                                ['Document type', item.documentType || 'Not recorded'],
                                                ['MIME type', item.mimeType],
                                                ['Page count', item.pageCount?.toString() || 'Unknown'],
                                                ['Authored date', item.authoredLabel],
                                                ['Uploaded', item.uploadedLabel],
                                                ['Hash', item.hash ? `${item.hash.slice(0, 20)}${item.hash.length > 20 ? '…' : ''}` : 'Not recorded'],
                                            ].map(([label, value]) => (
                                                <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        {label}
                                                    </p>
                                                    <p className="mt-1 break-all text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                        {value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {item.description && (
                                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                                                {item.description}
                                            </div>
                                        )}

                                        {document && (
                                            <DocumentExtractionStatusPanel
                                                patientId={record.patientId}
                                                document={document}
                                            />
                                        )}

                                        <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    Related clinical records
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setSource(item.previewSource)}
                                                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                                                >
                                                    <DocumentTextIcon className="h-3.5 w-3.5" />
                                                    Open document
                                                </button>
                                            </div>
                                            {item.relatedResources.length === 0 ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    No structured relationship is recorded.
                                                </p>
                                            ) : (
                                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                    {item.relatedResources.map(resource => (
                                                        <div
                                                            key={`${resource.resourceType}-${resource.id}`}
                                                            className={`rounded-lg border px-3 py-2 ${resource.missing
                                                                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                                                                : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                                                            }`}
                                                        >
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                                {resource.label}
                                                            </p>
                                                            <p className="mt-0.5 text-[9px] font-mono uppercase tracking-wide text-slate-400">
                                                                {resource.resourceType}
                                                                {resource.dateLabel
                                                                    ? ` · ${resource.dateLabel}`
                                                                    : ''}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <ProvenancePanel provenance={item.provenance} />
                                    </div>
                                </details>
                            );
                        })}
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

export default DocumentsModule;
