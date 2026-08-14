import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../components/icons';
import {
    CAPABILITY_STATUS_LABELS,
    MEDIBRIEF_CAPABILITIES,
    type CapabilityStatus,
} from './capabilities';
import {
    CLOUD_POLICY_BLOCKED_EVENT,
    CLOUD_POLICY_CHANGED_EVENT,
    REVIEWED_CLINICAL_MODEL_REGISTRY,
    cloudProcessingConsentGranted,
    setCloudProcessingConsent,
    type CloudPolicyBlockedDetail,
} from './cloudPolicy';

const statusClasses: Record<CapabilityStatus, string> = {
    available: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
    experimental: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
    disabled: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
    planned: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

const hasLegacyVaultPolicy = (): boolean => {
    if (typeof window === 'undefined') return false;
    const configured = Boolean(window.localStorage.getItem('medibrief_sec_salt'));
    const policy = Number(
        window.localStorage.getItem('medibrief_sec_policy_version') || '1',
    );
    return configured && (!Number.isFinite(policy) || policy < 2);
};

const SafetyBoundaryCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [cloudEnabled, setCloudEnabled] = useState(
        cloudProcessingConsentGranted,
    );
    const [blockedDetail, setBlockedDetail] =
        useState<CloudPolicyBlockedDetail | null>(null);

    useEffect(() => {
        const handleBlocked = (event: Event) => {
            const detail = (
                event as CustomEvent<CloudPolicyBlockedDetail>
            ).detail;
            setBlockedDetail(detail);
            setIsOpen(true);
        };
        const handleChanged = () => {
            setCloudEnabled(cloudProcessingConsentGranted());
        };
        window.addEventListener(
            CLOUD_POLICY_BLOCKED_EVENT,
            handleBlocked as EventListener,
        );
        window.addEventListener(
            CLOUD_POLICY_CHANGED_EVENT,
            handleChanged as EventListener,
        );
        return () => {
            window.removeEventListener(
                CLOUD_POLICY_BLOCKED_EVENT,
                handleBlocked as EventListener,
            );
            window.removeEventListener(
                CLOUD_POLICY_CHANGED_EVENT,
                handleChanged as EventListener,
            );
        };
    }, []);

    const groupedCapabilities = useMemo(() => {
        const groups: Record<CapabilityStatus, typeof MEDIBRIEF_CAPABILITIES> = {
            available: [],
            experimental: [],
            disabled: [],
            planned: [],
        };
        MEDIBRIEF_CAPABILITIES.forEach(capability => {
            groups[capability.status].push(capability);
        });
        return groups;
    }, []);

    const legacyVault = hasLegacyVaultPolicy();

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed right-3 top-20 z-[55] inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-xl backdrop-blur-md transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
                aria-label="Open safety boundaries and capability status"
            >
                <ShieldCheckIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Safety & capabilities</span>
                <span
                    className={`h-2 w-2 rounded-full ${cloudEnabled
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="safety-boundary-title"
                        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-blue-600 p-2 text-white">
                                    <ShieldCheckIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2
                                        id="safety-boundary-title"
                                        className="font-display text-lg font-bold text-slate-950 dark:text-white"
                                    >
                                        Safety boundaries and capability status
                                    </h2>
                                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        MediBrief is a local personal health record and evidence-review assistant. It does not diagnose, prescribe, perform emergency triage, place orders, or certify that a record is complete.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Close safety and capabilities"
                            >
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 md:p-6">
                            {blockedDetail && (
                                <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                        <div>
                                            <h3 className="text-sm font-bold">
                                                Cloud request withheld
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed">
                                                {blockedDetail.message}
                                            </p>
                                            <p className="mt-2 text-[10px] font-mono uppercase tracking-wide opacity-75">
                                                Task: {blockedDetail.task} · Model: {blockedDetail.modelId || 'not selected'}
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                                Cloud processing for this tab
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                                Disabled by default. Enabling it allows general assistant requests to send submitted content directly to OpenRouter using your key. Consent expires when this browser tab closes.
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${cloudEnabled
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                        }`}>
                                            {cloudEnabled ? 'Enabled' : 'Local only'}
                                        </span>
                                    </div>

                                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        Every OpenRouter request is forced to request zero-data-retention endpoints, deny provider data collection, require supported parameters, and disable provider fallback. Provider and legal terms still require independent review.
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = !cloudEnabled;
                                            setCloudProcessingConsent(next);
                                            setCloudEnabled(next);
                                            if (!next) setBlockedDetail(null);
                                        }}
                                        className={`mt-4 w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors ${cloudEnabled
                                            ? 'bg-slate-700 hover:bg-slate-600'
                                            : 'bg-amber-600 hover:bg-amber-500'
                                        }`}
                                    >
                                        {cloudEnabled
                                            ? 'Disable cloud processing'
                                            : 'I understand — enable for this tab'}
                                    </button>
                                    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                                        This permission is only a data-transmission acknowledgement. It is not consent to treatment and does not make model output clinically reliable.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                        Patient-specific model registry
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Patient-record and medical document/image calls require an exact task-specific model/provider review entry. General provider benchmarks are not accepted as clinical validation.
                                    </p>
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/30">
                                        <p className="text-xs font-bold text-red-800 dark:text-red-200">
                                            {REVIEWED_CLINICAL_MODEL_REGISTRY.length} reviewed clinical model profiles
                                        </p>
                                        <p className="mt-1 text-[11px] leading-relaxed text-red-700/80 dark:text-red-200/75">
                                            Patient-specific and medical document/image cloud requests remain disabled until a review package is registered. The deterministic local summary and record workflows remain available.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {legacyVault && (
                                <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
                                    <div className="flex items-start gap-3 text-amber-900 dark:text-amber-100">
                                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                        <div>
                                            <h3 className="text-sm font-bold">
                                                Legacy vault credential detected
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed">
                                                This vault predates the strong-passphrase policy. Existing data remains accessible to avoid destructive migration. Create a validated backup before moving the record to a new vault protected by a long, unique passphrase.
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                            Capability matrix
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Status is based on the active implementation, not planned or historical product claims.
                                        </p>
                                    </div>
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                        Review docs/KNOWN_LIMITATIONS.md
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    {([
                                        'available',
                                        'experimental',
                                        'disabled',
                                        'planned',
                                    ] as CapabilityStatus[]).map(status => (
                                        <div key={status}>
                                            <h4 className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                                {CAPABILITY_STATUS_LABELS[status]}
                                            </h4>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                {groupedCapabilities[status].map(capability => (
                                                    <article
                                                        key={capability.id}
                                                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                                                                {capability.name}
                                                            </h5>
                                                            <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusClasses[capability.status]}`}>
                                                                {CAPABILITY_STATUS_LABELS[capability.status]}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                            {capability.description}
                                                        </p>
                                                        <p className="mt-2 border-l-2 border-slate-300 pl-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                                            {capability.boundary}
                                                        </p>
                                                    </article>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SafetyBoundaryCenter;
