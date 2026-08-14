import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    DownloadIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../../components/icons';
import { encryptedSourceStorage } from '../../../services/encryptedSourceStorage';
import { useAuditStore } from '../../audit/useAuditStore';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../../patient-management/usePatientStore';
import {
    commitAtomicIpsImport,
    prepareAtomicIpsImport,
    type AtomicIpsImportPreview,
} from '../atomicIpsImport';
import {
    buildIpsDocument,
    createIpsFileStem,
    serializeIpsBundle,
} from '../ipsExport';
import type { IpsExportResult } from '../ipsTypes';

const downloadText = (
    content: string,
    fileName: string,
    type: string,
): void => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const CountGrid: React.FC<{
    title: string;
    counts: Record<string, number>;
}> = ({ title, counts }) => {
    const entries = Object.entries(counts).sort(([left], [right]) =>
        left.localeCompare(right));
    if (entries.length === 0) return null;
    return (
        <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {title}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {entries.map(([label, count]) => (
                    <span
                        key={label}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                        {label}: <strong>{count}</strong>
                    </span>
                ))}
            </div>
        </div>
    );
};

const ValidationCard: React.FC<{
    result: IpsExportResult['report']['validation'];
}> = ({ result }) => (
    <div className={`rounded-xl border p-3 ${result.valid
        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
        : 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30'
    }`}>
        <div className="flex items-start gap-2">
            {result.valid ? (
                <ShieldCheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            ) : (
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            )}
            <div>
                <p className={`text-xs font-bold ${result.valid
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                    {result.valid
                        ? 'Local IPS structural checks passed'
                        : 'IPS export/import validation failed'}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {result.summary.entries} entries · {result.summary.sections} sections · {result.summary.requiredSectionsPresent}/3 required sections · {result.summary.unresolvedReferences} unresolved references
                </p>
            </div>
        </div>
        {result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-[10px] text-red-700 dark:text-red-200">
                {result.errors.map(issue => (
                    <li key={`${issue.code}-${issue.path}-${issue.message}`}>
                        <strong>{issue.path}:</strong> {issue.message}
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const identityTone = (
    status: AtomicIpsImportPreview['identity'] extends infer T
        ? T extends { status: infer S }
            ? S
            : never
        : never,
): string => status === 'matched'
    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
    : status === 'mismatch'
        ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30'
        : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30';

const IpsInteroperabilityCenter: React.FC = () => {
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[state.activePatientId],
    );
    const record = useClinicalRecordStore(
        state => state.records[activePatientId],
    );
    const clinicalActions = useClinicalRecordStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [exportResult, setExportResult] = useState<IpsExportResult | null>(null);
    const [importPreview, setImportPreview] =
        useState<AtomicIpsImportPreview | null>(null);
    const [identityAcknowledged, setIdentityAcknowledged] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setImportPreview(null);
        setIdentityAcknowledged(false);
        setStatus(null);
        setError(null);
    }, [activePatientId]);

    const candidateCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        importPreview?.candidates.forEach(candidate => {
            counts[candidate.resourceType] =
                (counts[candidate.resourceType] || 0) + 1;
        });
        return counts;
    }, [importPreview]);

    const safetyErrors = importPreview?.safetyIssues.filter(issue =>
        issue.severity === 'error') || [];

    const createExport = (): IpsExportResult | null => {
        if (!record) {
            setError(
                'The selected patient does not have an initialized structured clinical record.',
            );
            return null;
        }
        const result = buildIpsDocument(record);
        setExportResult(result);
        setStatus(null);
        setError(result.report.validation.valid
            ? null
            : 'The generated document failed local validation and was not downloaded.');
        return result;
    };

    const handleDownloadIps = () => {
        const result = createExport();
        if (!result || !result.report.validation.valid || !record) return;
        downloadText(
            serializeIpsBundle(result.bundle),
            `${createIpsFileStem(record)}.json`,
            'application/fhir+json;charset=utf-8',
        );
        auditActions.logEvent(
            'PATIENT_SUMMARY_EXPORTED',
            activePatientId,
            'Exported a FHIR R4 International Patient Summary document from confirmed local records.',
            'USER',
            {
                format: 'fhir-r4-ips',
                ipsVersion: result.report.ipsVersion,
                entries: result.bundle.entry.length,
                warnings: result.report.warnings.length,
            },
        );
        setStatus('IPS JSON downloaded. Keep it protected as sensitive health information.');
    };

    const handleDownloadReport = () => {
        const result = exportResult || createExport();
        if (!result || !record) return;
        downloadText(
            JSON.stringify(result.report, null, 2),
            `${createIpsFileStem(record)}-validation-report.json`,
            'application/json;charset=utf-8',
        );
        setStatus('Export validation and exclusion report downloaded.');
    };

    const handleSelectedFile = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setError(null);
        setStatus(null);
        setIdentityAcknowledged(false);

        if (!record) {
            setImportPreview(null);
            setError(
                'Initialize the selected patient record before previewing an IPS import.',
            );
            return;
        }

        try {
            const preview = await prepareAtomicIpsImport({
                input: await file.text(),
                targetRecord: record,
                fileName: file.name,
                mimeType: file.type || 'application/fhir+json',
            });
            setImportPreview(preview);

            if (!preview.validation.valid) {
                setError(
                    'The selected file failed local IPS validation. No candidate records were created.',
                );
            } else if (preview.safetyIssues.some(issue =>
                issue.severity === 'error')) {
                setError(
                    'The received document failed the atomic import safety checks. No local record was changed.',
                );
            } else if (!preview.commitReady) {
                setError(
                    'This IPS does not contain a complete supported candidate graph that can be committed safely.',
                );
            }
        } catch (selectedFileError) {
            console.error('IPS import preview failed:', selectedFileError);
            setImportPreview(null);
            setError(
                selectedFileError instanceof Error
                    ? selectedFileError.message
                    : 'The selected IPS file could not be read. No local record was changed.',
            );
        }
    };

    const handleImportCandidates = async () => {
        if (!record) {
            setError('Initialize the selected patient record before importing candidates.');
            return;
        }
        if (!importPreview?.commitReady || !importPreview.source) {
            setError('Only a complete, source-preserving IPS preview can be imported.');
            return;
        }
        if (!identityAcknowledged) {
            setError(
                'Confirm that you compared the IPS patient with the selected local patient before importing.',
            );
            return;
        }

        setIsCommitting(true);
        setError(null);
        setStatus(null);
        const acknowledgedAt = new Date().toISOString();
        const staged = commitAtomicIpsImport({
            currentRecord: record,
            preview: importPreview,
            identityAcknowledgement: {
                confirmed: true,
                targetPatientId: activePatientId,
                sourceSha256: importPreview.source.sha256,
                acknowledgedAt,
            },
        });

        if (staged.status === 'duplicate-source') {
            setStatus(staged.message);
            setIdentityAcknowledged(false);
            setIsCommitting(false);
            return;
        }
        if (!staged.ok || !staged.record || !staged.sourceDocument) {
            setError(staged.message);
            setIsCommitting(false);
            return;
        }

        let sourceStored = false;
        try {
            await encryptedSourceStorage.saveSource(importPreview.source);
            sourceStored = true;
            clinicalActions.replacePatientRecord(staged.record);

            auditActions.logEvent(
                'CLINICAL_RESOURCE_CREATED',
                activePatientId,
                'Atomically imported the Composition-reachable FHIR R4 IPS graph as unconfirmed candidates with its exact encrypted source.',
                'USER',
                {
                    sourceFormat: 'fhir-r4-ips',
                    importId: importPreview.importId,
                    sourceSha256: importPreview.source.sha256,
                    sourceBytes: importPreview.source.byteLength,
                    sourceDocumentId: staged.sourceDocument.id,
                    identityStatus: importPreview.identity?.status,
                    identityAcknowledgedAt: acknowledgedAt,
                    sourceEntries: importPreview.graph?.sourceEntryCount,
                    reachableEntries: importPreview.graph?.reachableEntryCount,
                    created: staged.createdCandidates,
                    duplicates: staged.duplicateCandidates,
                    candidateOnly: true,
                    patientProfileOverwritten: false,
                },
            );

            setImportPreview(null);
            setIdentityAcknowledged(false);
            setStatus(
                `${staged.createdCandidates} candidate record${staged.createdCandidates === 1 ? '' : 's'} committed in one validated patient-record replacement${staged.duplicateCandidates ? ` · ${staged.duplicateCandidates} equivalent candidate${staged.duplicateCandidates === 1 ? '' : 's'} linked to existing evidence` : ''}. The exact received IPS is encrypted locally and every candidate remains unconfirmed until source review.`,
            );
        } catch (commitError) {
            if (sourceStored) {
                try {
                    await encryptedSourceStorage.deleteSource(
                        importPreview.source.id,
                    );
                } catch (cleanupError) {
                    console.error(
                        'Unable to remove unreferenced encrypted IPS source:',
                        cleanupError,
                    );
                }
            }
            console.error('Atomic IPS import failed:', commitError);
            setError(
                commitError instanceof Error
                    ? commitError.message
                    : 'The atomic IPS import could not be committed. No candidate graph was intentionally retained.',
            );
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed left-3 top-20 z-[55] inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-xl backdrop-blur-md transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
                aria-label="Open FHIR and International Patient Summary tools"
            >
                <DocumentTextIcon className="h-4 w-4" />
                <span className="hidden sm:inline">FHIR & IPS</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ips-interoperability-title"
                        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-blue-600 p-2 text-white">
                                    <DocumentTextIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2
                                        id="ips-interoperability-title"
                                        className="font-display text-lg font-bold text-slate-950 dark:text-white"
                                    >
                                        FHIR R4 and International Patient Summary
                                    </h2>
                                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Export confirmed local records as an IPS 2.0.1 document Bundle, or preserve and stage a received IPS as one candidate-only import transaction.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Close FHIR and IPS tools"
                            >
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 md:p-6">
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                                <strong>Selected local patient:</strong>{' '}
                                {record?.profile.displayName
                                    || activePatient?.name
                                    || activePatientId}. The IPS Patient is compared with this profile and never overwrites it automatically.
                            </div>

                            {error && (
                                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                                    {error}
                                </div>
                            )}
                            {status && (
                                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                                    {status}
                                </div>
                            )}

                            <section className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                        Export confirmed record
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Creates a FHIR R4 document Bundle using the IPS 2.0.1 profiles. Candidate, rejected, entered-in-error, negated, family-history, hypothetical, unsupported, and unsafe-to-map records are excluded and reported.
                                    </p>
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={handleDownloadIps}
                                            disabled={!record}
                                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <DownloadIcon className="h-4 w-4" />
                                            Download IPS JSON
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadReport}
                                            disabled={!record}
                                            className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                        >
                                            Validation report
                                        </button>
                                    </div>

                                    {exportResult && (
                                        <div className="mt-4 space-y-4">
                                            <ValidationCard result={exportResult.report.validation} />
                                            <CountGrid title="Included FHIR resources" counts={exportResult.report.includedCounts} />
                                            <CountGrid title="Excluded local records" counts={exportResult.report.excludedCounts} />
                                            {exportResult.report.warnings.length > 0 && (
                                                <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                                                    <summary className="cursor-pointer text-xs font-bold text-amber-800 dark:text-amber-200">
                                                        {exportResult.report.warnings.length} export warning{exportResult.report.warnings.length === 1 ? '' : 's'}
                                                    </summary>
                                                    <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-amber-800 dark:text-amber-100">
                                                        {exportResult.report.warnings.map(warning => (
                                                            <li key={warning}>{warning}</li>
                                                        ))}
                                                    </ul>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                        Atomic import for human review
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Preserves the exact received JSON under the local vault key, limits mapping to the Composition-reachable graph, checks patient ownership, and stages every supported resource as an unconfirmed candidate. Nothing is auto-confirmed.
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="application/fhir+json,application/json,.json"
                                        onChange={handleSelectedFile}
                                        className="hidden"
                                        aria-label="Select FHIR IPS JSON file"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-4 min-h-11 w-full rounded-xl border border-blue-300 px-4 py-3 text-xs font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                    >
                                        Select IPS JSON
                                    </button>

                                    {importPreview && (
                                        <div className="mt-4 space-y-4">
                                            <ValidationCard result={importPreview.validation} />

                                            {importPreview.graph && (
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                    <p className="font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        Document graph boundary
                                                    </p>
                                                    <p className="mt-1">
                                                        {importPreview.graph.reachableEntryCount} of {importPreview.graph.sourceEntryCount} Bundle entries are reachable from the Composition · {importPreview.graph.droppedEntryCount} unrelated entr{importPreview.graph.droppedEntryCount === 1 ? 'y' : 'ies'} excluded from mapping and retained only in the encrypted source.
                                                    </p>
                                                    <CountGrid
                                                        title="Unrelated supported entries excluded"
                                                        counts={importPreview.graph.droppedSupportedResourceTypes}
                                                    />
                                                </div>
                                            )}

                                            {importPreview.identity && (
                                                <div className={`rounded-xl border p-3 ${identityTone(importPreview.identity.status)}`}>
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-70">
                                                        Patient identity comparison · {importPreview.identity.status}
                                                    </p>
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                        <div>
                                                            <p className="text-[9px] font-bold uppercase opacity-60">
                                                                Received IPS
                                                            </p>
                                                            <p className="text-sm font-bold">
                                                                {importPreview.identity.sourceDisplayName}
                                                            </p>
                                                            <p className="mt-1 text-[10px] opacity-75">
                                                                Birth date: {importPreview.patient?.birthDate || 'not supplied'} · Gender: {importPreview.patient?.gender || 'not supplied'} · Identifiers: {importPreview.patient?.identifiers.length || 0}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-bold uppercase opacity-60">
                                                                Selected local patient
                                                            </p>
                                                            <p className="text-sm font-bold">
                                                                {importPreview.identity.targetDisplayName}
                                                            </p>
                                                            <p className="mt-1 text-[10px] opacity-75">
                                                                Birth date: {record?.profile.dateOfBirth?.value || 'not supplied'} · Identifiers: {record?.profile.identifiers.length || 0}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {[...importPreview.identity.matches,
                                                        ...importPreview.identity.mismatches,
                                                        ...importPreview.identity.notes].length > 0 && (
                                                        <ul className="mt-3 space-y-1 text-[10px] leading-relaxed">
                                                            {importPreview.identity.matches.map(item => (
                                                                <li key={`match-${item}`}>✓ {item}</li>
                                                            ))}
                                                            {importPreview.identity.mismatches.map(item => (
                                                                <li key={`mismatch-${item}`} className="font-bold">⚠ {item}</li>
                                                            ))}
                                                            {importPreview.identity.notes.map(item => (
                                                                <li key={`note-${item}`}>• {item}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}

                                            {importPreview.source && (
                                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[10px] leading-relaxed text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
                                                    <p className="font-mono font-bold uppercase tracking-wider text-indigo-500">
                                                        Exact source evidence
                                                    </p>
                                                    <p className="mt-1">
                                                        {importPreview.source.byteLength} UTF-8 bytes · SHA-256
                                                    </p>
                                                    <p className="mt-1 break-all font-mono text-[9px]">
                                                        {importPreview.source.sha256}
                                                    </p>
                                                    <p className="mt-2 font-bold">
                                                        The exact received text is encrypted before local storage and linked from every candidate.
                                                    </p>
                                                </div>
                                            )}

                                            <CountGrid title="Candidate resources prepared" counts={candidateCounts} />
                                            <CountGrid title="Unsupported or skipped resources" counts={importPreview.skippedResourceTypes} />

                                            {importPreview.safetyIssues.length > 0 && (
                                                <div className={`rounded-xl border p-3 ${safetyErrors.length > 0
                                                    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
                                                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                                                }`}>
                                                    <p className="text-xs font-bold">
                                                        {importPreview.safetyIssues.length} graph safety finding{importPreview.safetyIssues.length === 1 ? '' : 's'}
                                                    </p>
                                                    <ul className="mt-2 space-y-1 text-[10px] leading-relaxed">
                                                        {importPreview.safetyIssues.map(issue => (
                                                            <li key={`${issue.code}-${issue.path}-${issue.message}`}>
                                                                <strong>{issue.severity.toUpperCase()} · {issue.path}:</strong>{' '}
                                                                {issue.message}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed ${identityAcknowledged
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                                                : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    checked={identityAcknowledged}
                                                    onChange={event =>
                                                        setIdentityAcknowledged(event.target.checked)}
                                                    disabled={!importPreview.commitReady}
                                                    className="mt-0.5 h-4 w-4 rounded border-slate-400"
                                                    aria-label="I compared the IPS patient with the selected local patient"
                                                />
                                                <span>
                                                    <strong>I compared the IPS patient with the selected local patient.</strong>{' '}
                                                    I understand that matching fields do not prove identity and that any mismatch requires human resolution before I proceed.
                                                </span>
                                            </label>

                                            <button
                                                type="button"
                                                onClick={handleImportCandidates}
                                                disabled={!record
                                                    || !importPreview.commitReady
                                                    || !identityAcknowledged
                                                    || isCommitting}
                                                className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isCommitting
                                                    ? 'Encrypting and validating transaction…'
                                                    : `Import ${importPreview.candidates.length} candidate${importPreview.candidates.length === 1 ? '' : 's'} atomically`}
                                            </button>

                                            {importPreview.warnings.length > 0 && (
                                                <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                                                    <summary className="cursor-pointer text-xs font-bold text-amber-800 dark:text-amber-200">
                                                        {importPreview.warnings.length} import warning{importPreview.warnings.length === 1 ? '' : 's'}
                                                    </summary>
                                                    <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-amber-800 dark:text-amber-100">
                                                        {importPreview.warnings.map(warning => (
                                                            <li key={warning}>{warning}</li>
                                                        ))}
                                                    </ul>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                                    <div>
                                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                                            Interoperability boundary
                                        </h3>
                                        <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                                            Structural and graph validation do not establish clinical truth, patient identity, terminology equivalence, source authenticity, completeness, or receiver acceptance. Imported records remain candidates and must be reviewed against the preserved source before confirmation.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default IpsInteroperabilityCenter;
