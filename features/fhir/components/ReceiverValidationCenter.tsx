import React, { useMemo, useRef, useState } from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    DownloadIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../../patient-management/usePatientStore';
import {
    buildIpsDocument,
    createIpsFileStem,
} from '../ipsExport';
import {
    RECEIVER_EXCHANGE_PROFILES,
    receiverProfileFromCapabilityStatement,
    type ReceiverExchangeProfile,
} from '../receiverProfiles';
import { validateIpsForReceiver } from '../receiverValidation';
import type {
    ReceiverValidationReport,
} from '../receiverValidationTypes';

const downloadJson = (content: unknown, fileName: string): void => {
    const blob = new Blob(
        [JSON.stringify(content, null, 2)],
        { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const stateLabel = (
    state: ReceiverValidationReport['state'],
): string => ({
    ready: 'Ready for manual transfer review',
    'ready-with-warnings': 'Ready with warnings',
    indeterminate: 'Receiver compatibility is indeterminate',
    'not-ready': 'Not ready for this receiver',
}[state]);

const ReceiverValidationCenter: React.FC = () => {
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[state.activePatientId],
    );
    const record = useClinicalRecordStore(
        state => state.records[activePatientId],
    );
    const capabilityInputRef = useRef<HTMLInputElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(
        RECEIVER_EXCHANGE_PROFILES[0].id,
    );
    const [importedProfile, setImportedProfile] =
        useState<ReceiverExchangeProfile | null>(null);
    const [report, setReport] =
        useState<ReceiverValidationReport | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const profiles = useMemo(
        () => importedProfile
            ? [...RECEIVER_EXCHANGE_PROFILES, importedProfile]
            : RECEIVER_EXCHANGE_PROFILES,
        [importedProfile],
    );
    const selectedProfile = profiles.find(profile =>
        profile.id === selectedProfileId) || profiles[0];

    const handleValidate = async () => {
        setError(null);
        setStatus(null);
        setReport(null);
        if (!record) {
            setError(
                'The selected patient does not have an initialized structured clinical record.',
            );
            return;
        }
        const exportResult = buildIpsDocument(record);
        const nextReport = await validateIpsForReceiver({
            bundle: exportResult.bundle,
            receiver: selectedProfile,
        });
        setReport(nextReport);
        setStatus(
            'Receiver comparison completed locally. No declared receiver endpoint or terminology service was contacted.',
        );
    };

    const handleCapabilityFile = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setError(null);
        setStatus(null);
        setReport(null);
        try {
            const parsedJson = JSON.parse(await file.text()) as unknown;
            const parsed = receiverProfileFromCapabilityStatement(parsedJson);
            if (!parsed.profile) {
                setImportedProfile(null);
                setError(parsed.errors.join(' '));
                return;
            }
            setImportedProfile(parsed.profile);
            setSelectedProfileId(parsed.profile.id);
            setStatus(
                `Imported ${parsed.profile.name} for local comparison. No declared endpoint was contacted.`,
            );
        } catch {
            setImportedProfile(null);
            setError(
                'The selected file is not valid CapabilityStatement JSON. No receiver profile was changed.',
            );
        }
    };

    const downloadReport = () => {
        if (!report || !record) return;
        downloadJson(
            report,
            `${createIpsFileStem(record)}-${report.receiver.id}-receiver-validation.json`,
        );
        setStatus(
            'Derived receiver-validation report downloaded. It does not contain source documents or authorize disclosure.',
        );
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed left-3 top-36 z-[55] inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-xl backdrop-blur-md transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                aria-label="Open receiver-specific exchange validation"
            >
                <ShieldCheckIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Receiver check</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="receiver-validation-title"
                        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-indigo-600 p-2 text-white">
                                    <ShieldCheckIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2
                                        id="receiver-validation-title"
                                        className="font-display text-lg font-bold text-slate-950 dark:text-white"
                                    >
                                        Receiver-specific exchange validation
                                    </h2>
                                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Compare a generated IPS 2.0.1 document with a named receiver contract or an uploaded CapabilityStatement. This is a local engineering check, not transfer authorization.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Close receiver validation"
                            >
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-blue-500">
                                        Selected local patient
                                    </span>
                                    <strong>{activePatient?.name || activePatientId}</strong>
                                </div>
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-600">
                                        Network activity
                                    </span>
                                    <strong>None</strong>
                                    <p className="mt-1 text-[10px] opacity-80">
                                        CapabilityStatement and IPS comparison stay in this browser.
                                    </p>
                                </div>
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-amber-600">
                                        Disclosure boundary
                                    </span>
                                    <strong>Validation is not transfer authorization</strong>
                                </div>
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

                            <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                                    <label className="block">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Receiver contract
                                        </span>
                                        <select
                                            value={selectedProfileId}
                                            onChange={event => {
                                                setSelectedProfileId(event.target.value);
                                                setReport(null);
                                                setError(null);
                                            }}
                                            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        >
                                            {profiles.map(profile => (
                                                <option key={profile.id} value={profile.id}>
                                                    {profile.name} · {profile.version}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <input
                                            ref={capabilityInputRef}
                                            type="file"
                                            accept="application/fhir+json,application/json,.json"
                                            onChange={handleCapabilityFile}
                                            className="hidden"
                                            aria-label="Select receiver CapabilityStatement JSON file"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => capabilityInputRef.current?.click()}
                                            className="min-h-11 rounded-xl border border-indigo-300 px-4 py-3 text-xs font-bold uppercase tracking-wider text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                                        >
                                            Import capability
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleValidate}
                                            disabled={!record}
                                            className="min-h-11 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Validate locally
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                    <strong>{selectedProfile.name}</strong><br />
                                    Source: {selectedProfile.sourceReference}<br />
                                    FHIR {selectedProfile.fhirVersion} · {selectedProfile.ipsPackage}
                                </div>
                            </section>

                            {report && (
                                <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <div className={`rounded-xl border p-4 ${report.state === 'not-ready'
                                        ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30'
                                        : report.state === 'indeterminate'
                                            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
                                            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                                    }`}>
                                        <div className="flex items-start gap-3">
                                            {report.readyForManualTransfer
                                                ? <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
                                                : <AlertTriangleIcon className="h-5 w-5 text-amber-600" />}
                                            <div>
                                                <h3 className="text-sm font-bold">
                                                    {stateLabel(report.state)}
                                                </h3>
                                                <p className="mt-1 text-[10px] leading-relaxed opacity-80">
                                                    {report.summary.bundleEntries} entries · {report.summary.bundleBytes} bytes · {report.summary.terminologyChecks} coded tuples checked
                                                </p>
                                                <p className="mt-2 text-xs font-bold">
                                                    Transfer authorized: No · Receiver acceptance established: No
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {report.issues.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Findings ({report.issues.length})
                                            </h3>
                                            <ul className="mt-2 space-y-2">
                                                {report.issues.map((finding, index) => (
                                                    <li
                                                        key={`${finding.code}-${finding.path}-${index}`}
                                                        className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                                                    >
                                                        <span className={`mr-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${finding.severity === 'error'
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
                                                        }`}>
                                                            {finding.severity}
                                                        </span>
                                                        <strong>{finding.category}</strong>
                                                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                                                            {finding.message}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={downloadReport}
                                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                                    >
                                        <DownloadIcon className="h-4 w-4" />
                                        Download derived report
                                    </button>
                                </section>
                            )}

                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                <div className="flex items-start gap-3">
                                    <DocumentTextIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                                    <div>
                                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                                            Receiver evidence boundary
                                        </h3>
                                        <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                                            A CapabilityStatement describes computable capabilities, not every local receiving rule. This check does not authenticate a destination, transmit a document, prove patient identity or consent, verify source authenticity, establish clinical truth, or guarantee successful ingestion.
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

export default ReceiverValidationCenter;
