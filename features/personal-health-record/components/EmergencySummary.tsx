import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    ClockIcon,
    DocumentTextIcon,
    DownloadIcon,
    DrugsIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import type { PatientClinicalRecord } from '../../clinical-record';
import { buildEmergencySummaryViewModel } from '../viewModels';

interface EmergencySummaryProps {
    record: PatientClinicalRecord;
}

const EmergencySection: React.FC<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    className?: string;
    children: React.ReactNode;
}> = ({ title, icon: Icon, className = '', children }) => (
    <section className={`emergency-print-section rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 ${className}`}>
        <div className="mb-3 flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {title}
            </h2>
        </div>
        {children}
    </section>
);

const EmergencySummary: React.FC<EmergencySummaryProps> = ({ record }) => {
    const summary = useMemo(
        () => buildEmergencySummaryViewModel(record),
        [record],
    );
    const printRef = useRef<HTMLDivElement>(null);
    const [printError, setPrintError] = useState<string | null>(null);

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open(
            '',
            'medibrief-emergency-summary',
            'width=920,height=760',
        );
        if (!printWindow) {
            setPrintError(
                'The print window was blocked. Allow pop-ups for this local app and try again.',
            );
            return;
        }

        setPrintError(null);
        printWindow.document.open();
        printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Emergency Summary — ${summary.patientName.replace(/[<>&"']/g, '')}</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; color: #0f172a; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; }
    h1, h2, p { margin-top: 0; }
    .emergency-print-sheet { max-width: 900px; margin: 0 auto; }
    .emergency-print-header { border: 2px solid #0f172a; padding: 18px; margin-bottom: 14px; }
    .emergency-print-header h1 { margin-bottom: 4px; font-size: 24px; }
    .emergency-print-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .emergency-print-section { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 10px; break-inside: avoid; }
    .emergency-print-section h2 { margin-bottom: 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
    .emergency-print-alert { border: 2px solid #b91c1c; background: #fff7f7; }
    .emergency-print-code { border: 2px solid #7e22ce; background: #faf5ff; }
    .emergency-print-item { padding: 7px 0; border-bottom: 1px solid #e2e8f0; }
    .emergency-print-item:last-child { border-bottom: 0; }
    .emergency-print-label { color: #64748b; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
    .emergency-print-value { margin-top: 2px; font-weight: 700; }
    .emergency-print-warning { border: 1px solid #f59e0b; background: #fffbeb; padding: 10px; margin-top: 12px; }
    button, svg { display: none !important; }
    @media print { body { padding: 0; } }
</style>
</head>
<body>${content.outerHTML}</body>
</html>`);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 100);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-7">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-red-600">
                            Confirmed-data emergency view
                        </p>
                        <h1 className="mt-1 text-2xl font-display font-bold text-slate-950 dark:text-white">
                            Emergency summary
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            Generated deterministically from the local confirmed record. Pending candidates and rejected assertions are excluded.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    >
                        <DownloadIcon className="h-4 w-4" />
                        Print summary
                    </button>
                </div>

                {printError && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                        {printError}
                    </div>
                )}

                <div ref={printRef} className="emergency-print-sheet">
                    <header className="emergency-print-header mb-4 overflow-hidden rounded-3xl border-2 border-slate-900 bg-white p-5 shadow-soft dark:border-white dark:bg-slate-950 md:p-7">
                        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-red-600">
                                    <ShieldCheckIcon className="h-5 w-5" />
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em]">
                                        Emergency medical summary
                                    </span>
                                </div>
                                <h1 className="mt-2 text-3xl font-display font-bold text-slate-950 dark:text-white">
                                    {summary.patientName}
                                </h1>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Record updated {summary.recordUpdatedLabel} · Summary generated {summary.generatedLabel}
                                </p>
                            </div>
                            <div className="emergency-print-code rounded-2xl border-2 border-purple-500 bg-purple-50 px-5 py-4 text-center dark:bg-purple-950/30">
                                <p className="emergency-print-label text-[9px] font-mono font-bold uppercase tracking-wider text-purple-500">
                                    Code status
                                </p>
                                <p className="emergency-print-value mt-1 text-lg font-bold text-purple-900 dark:text-purple-100">
                                    {summary.codeStatus || 'Unknown / not confirmed'}
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="emergency-print-grid mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            ['Date of birth', summary.dateOfBirthLabel],
                            ['Age', summary.ageLabel || 'Unknown'],
                            ['Sex', summary.administrativeSexLabel],
                            ['Blood type', summary.bloodTypeLabel],
                            ['Preferred language', summary.preferredLanguageLabel],
                            ['Contact details', summary.contacts.join('; ') || 'Unknown'],
                        ].map(([label, value]) => (
                            <div key={label} className="emergency-print-section rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                                <p className="emergency-print-label text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                    {label}
                                </p>
                                <p className="emergency-print-value mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>

                    {summary.identifiers.length > 0 && (
                        <EmergencySection title="Identifiers" icon={DocumentTextIcon}>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {summary.identifiers.map(identifier => (
                                    <div key={`${identifier.label}-${identifier.value}`} className="emergency-print-item rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                                        <p className="emergency-print-label text-[9px] font-mono font-bold uppercase tracking-wide text-slate-400">
                                            {identifier.label}
                                        </p>
                                        <p className="emergency-print-value mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            {identifier.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </EmergencySection>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                        <EmergencySection
                            title="Allergies and intolerances"
                            icon={AlertTriangleIcon}
                            className="emergency-print-alert border-2 border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20"
                        >
                            {summary.allergies.length === 0 ? (
                                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                                    Allergy status unknown — no active allergy record is confirmed.
                                </p>
                            ) : (
                                <div>
                                    {summary.allergies.map(allergy => (
                                        <div key={allergy.id} className="emergency-print-item border-b border-red-100 py-3 last:border-0 dark:border-red-900/40">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-bold text-red-950 dark:text-red-100">
                                                    {allergy.name}
                                                </p>
                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700 dark:bg-red-950 dark:text-red-300">
                                                    {allergy.criticality}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-red-800/75 dark:text-red-200/70">
                                                {allergy.reactions.length > 0
                                                    ? allergy.reactions.join('; ')
                                                    : 'Reaction details not recorded'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </EmergencySection>

                        <EmergencySection title="Active medications" icon={DrugsIcon}>
                            {summary.medications.length === 0 ? (
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    No active medication is confirmed in the structured record.
                                </p>
                            ) : (
                                <div>
                                    {summary.medications.map(medication => (
                                        <div key={medication.id} className="emergency-print-item border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {medication.name}
                                                </p>
                                                <span className="text-[9px] font-bold uppercase text-slate-500">
                                                    {medication.status}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {medication.dosage || 'Dosage instructions not recorded'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </EmergencySection>

                        <EmergencySection title="Active conditions" icon={ActivityIcon}>
                            {summary.conditions.length === 0 ? (
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    No active condition is confirmed. This does not prove that none exist.
                                </p>
                            ) : (
                                <div>
                                    {summary.conditions.map(condition => (
                                        <div key={condition.id} className="emergency-print-item border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {condition.name}
                                                </p>
                                                <span className="text-[9px] font-bold uppercase text-slate-500">
                                                    {condition.status}
                                                </span>
                                            </div>
                                            {condition.severity && (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Severity: {condition.severity}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </EmergencySection>

                        <EmergencySection title="Recent confirmed vitals" icon={ClockIcon}>
                            {summary.vitals.length === 0 ? (
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    No dated vital observation is available.
                                </p>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {summary.vitals.map(vital => (
                                        <div key={vital.key} className="emergency-print-item rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                                            <p className="emergency-print-label text-[9px] font-mono font-bold uppercase tracking-wide text-slate-400">
                                                {vital.label}
                                            </p>
                                            <p className="emergency-print-value mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                                {vital.value}
                                            </p>
                                            <p className={`mt-1 text-[9px] ${vital.stale
                                                ? 'font-bold text-amber-600'
                                                : 'text-slate-400'
                                            }`}>
                                                {vital.observedAt}{vital.stale ? ' · older value' : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </EmergencySection>
                    </div>

                    <section className="emergency-print-warning mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                            <AlertTriangleIcon className="h-4 w-4" />
                            <h2 className="text-xs font-bold uppercase tracking-wider">
                                Important limitations
                            </h2>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                            {summary.limitations.map(limitation => (
                                <li key={limitation} className="flex items-start gap-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                                    <span>{limitation}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default EmergencySummary;
