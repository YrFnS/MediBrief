import React, { useMemo, useRef, useState } from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    DownloadIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../../patient-management/usePatientStore';
import {
    buildIpsDocument,
    createIpsFileStem,
    serializeIpsBundle,
} from '../ipsExport';
import {
    parseIpsImport,
    type IpsImportPreview,
} from '../ipsImport';
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
    const [importPreview, setImportPreview] = useState<IpsImportPreview | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const candidateCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        importPreview?.candidates.forEach(candidate => {
            counts[candidate.resourceType] =
                (counts[candidate.resourceType] || 0) + 1;
        });
        return counts;
    }, [importPreview]);

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
        try {
            const preview = parseIpsImport(
                await file.text(),
                activePatientId,
            );
            setImportPreview(preview);
            if (!preview.validation.valid) {
                setError(
                    'The selected file failed local IPS validation. No candidate records were created.',
                );
            }
        } catch (selectedFileError) {
            console.error('IPS import preview failed:', selectedFileError);
            setImportPreview(null);
            setError('The selected IPS file could not be read. No local record was changed.');
        }
    };

    const handleImportCandidates = () => {
        if (!record) {
            setError('Initialize the selected patient record before importing candidates.');
            return;
        }
        if (!importPreview?.validation.valid) {
            setError('Only a locally valid IPS document can be imported.');
            return;
        }
        if (importPreview.candidates.length === 0) {
            setError('This IPS contains no supported clinical resources to import.');
            return;
        }

        let created = 0;
        let duplicates = 0;
        let otherFailures = 0;
        importPreview.candidates.forEach(candidate => {
            const result = clinicalActions.addResource(candidate);
            if (result.status === 'created') created += 1;
            else if (result.status === 'duplicate') duplicates += 1;
            else otherFailures += 1;
        });

        auditActions.logEvent(
            'CLINICAL_RESOURCE_CREATED',
            activePatientId,
            'Imported supported FHIR R4 IPS resources as unconfirmed local candidates.',
            'USER',
            {
                sourceFormat: 'fhir-r4-ips',
                created,
                duplicates,
                otherFailures,
                patientProfileOverwritten: false,
            },
        );
        setStatus(
            `${created} candidate record${created === 1 ? '' : 's'} created${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : ''}${otherFailures ? ` · ${otherFailures} item${otherFailures === 1 ? '' : 's'} could not be added` : ''}. Review every candidate against its source before confirmation.`,
        );
        setError(otherFailures > 0
            ? 'Some supported items could not be added; the original IPS file was not modified.'
            : null);
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
                                        Export confirmed local records as an IPS 2.0.1 document Bundle, or preview a received IPS and import supported resources as candidates only.
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
                                {activePatient?.name || activePatientId}. Patient identity must be checked before importing. An IPS Patient resource never overwrites this local profile automatically.
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
                                        Import for human review
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Validates the document structure, previews patient identity, and converts supported resources into pending local candidates. Nothing is auto-confirmed.
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
                                            {importPreview.patient && (
                                                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/60 dark:bg-purple-950/30">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-purple-500">
                                                        IPS patient identity preview
                                                    </p>
                                                    <p className="mt-1 text-sm font-bold text-purple-950 dark:text-purple-100">
                                                        {importPreview.patient.displayName}
                                                    </p>
                                                    <p className="mt-1 text-[10px] text-purple-800/80 dark:text-purple-200/75">
                                                        Birth date: {importPreview.patient.birthDate || 'not supplied'} · Gender: {importPreview.patient.gender || 'not supplied'} · Identifiers: {importPreview.patient.identifiers.length}
                                                    </p>
                                                    <p className="mt-2 text-[10px] font-bold text-purple-800 dark:text-purple-200">
                                                        Compare this identity with the selected local patient before importing.
                                                    </p>
                                                </div>
                                            )}
                                            <CountGrid title="Candidate resources prepared" counts={candidateCounts} />
                                            <CountGrid title="Unsupported or skipped resources" counts={importPreview.skippedResourceTypes} />
                                            <button
                                                type="button"
                                                onClick={handleImportCandidates}
                                                disabled={!record
                                                    || !importPreview.validation.valid
                                                    || importPreview.candidates.length === 0}
                                                className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Import {importPreview.candidates.length} candidate{importPreview.candidates.length === 1 ? '' : 's'}
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
                                            Profile validation verifies structure, not clinical truth, patient identity, terminology equivalence, completeness, source authenticity, or acceptance by every receiving system. Protect exported files as sensitive health information.
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
