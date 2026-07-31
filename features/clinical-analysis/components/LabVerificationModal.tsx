import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    BeakerIcon,
    CheckIcon,
    DocumentTextIcon,
    XCircleIcon,
} from '../../../components/icons';
import type { LabReport } from '../../chat/schemas';
import type {
    PendingLabSource,
    ReviewedLabReport,
    ReviewedLabRow,
} from '../../diagnostic-reports';

interface LabVerificationModalProps {
    report: LabReport;
    source?: PendingLabSource;
    onConfirm: (review: ReviewedLabReport) => void;
    onCancel: () => void;
}

const initialRows = (report: LabReport): ReviewedLabRow[] =>
    report.labs.map(lab => ({
        ...lab,
        pageNumber: undefined,
        effectiveDate: '',
    }));

const isoDateTime = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime())
        ? trimmed
        : parsed.toISOString();
};

const LabVerificationModal: React.FC<LabVerificationModalProps> = ({
    report,
    source,
    onConfirm,
    onCancel,
}) => {
    const [reportTitle, setReportTitle] = useState('Laboratory report');
    const [reportDate, setReportDate] = useState(report.date || '');
    const [issuedAt, setIssuedAt] = useState('');
    const [performer, setPerformer] = useState('');
    const [specimenType, setSpecimenType] = useState('');
    const [collectionDate, setCollectionDate] = useState('');
    const [interpretation, setInterpretation] = useState(
        report.interpretation || '',
    );
    const [rows, setRows] = useState<ReviewedLabRow[]>(() =>
        initialRows(report));

    const invalidRowCount = useMemo(() => rows.filter(row =>
        !row.testName.trim() || !String(row.value).trim()).length, [rows]);
    const canSave = Boolean(
        source
        && rows.length > 0
        && invalidRowCount === 0,
    );

    const updateRow = (
        index: number,
        updates: Partial<ReviewedLabRow>,
    ): void => {
        setRows(current => current.map((row, rowIndex) =>
            rowIndex === index ? { ...row, ...updates } : row));
    };

    const removeRow = (index: number): void => {
        setRows(current => current.filter((_, rowIndex) =>
            rowIndex !== index));
    };

    const handleConfirm = (): void => {
        if (!canSave) return;
        onConfirm({
            reportTitle: reportTitle.trim() || 'Laboratory report',
            reportDate: reportDate.trim(),
            ...(isoDateTime(issuedAt) ? { issuedAt: isoDateTime(issuedAt) } : {}),
            ...(performer.trim() ? { performer: performer.trim() } : {}),
            ...(specimenType.trim()
                ? { specimenType: specimenType.trim() }
                : {}),
            ...(collectionDate.trim()
                ? { collectionDate: collectionDate.trim() }
                : {}),
            rows: rows.map(row => ({
                ...row,
                testName: row.testName.trim(),
                value: String(row.value).trim(),
                loinc: row.loinc?.trim() || undefined,
                units: row.units?.trim() || '',
                refRange: row.refRange?.trim() || '',
                effectiveDate: row.effectiveDate?.trim() || undefined,
                sourceExcerpt: row.sourceExcerpt?.trim() || undefined,
            })),
            ...(interpretation.trim()
                ? { interpretation: interpretation.trim() }
                : {}),
        });
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lab-report-review-title"
        >
            <div className="technical-border flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-blue-400 bg-white shadow-2xl dark:border-blue-800 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/80 md:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            <BeakerIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2
                                id="lab-report-review-title"
                                className="text-lg font-display font-bold text-slate-950 dark:text-white"
                            >
                                Review diagnostic report candidates
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                Check the complete report against the original file. Saving creates one candidate report with linked result and specimen candidates; it does not confirm medical facts.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close diagnostic report review"
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </header>

                <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200 md:px-6">
                    <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p className="text-xs leading-relaxed">
                        OCR and AI can misread decimal points, comparators, units, dates, flags, and reference ranges. Qualitative values such as “positive” or “not detected” must remain text rather than being forced into numbers.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <section className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:grid-cols-2 md:p-6 lg:grid-cols-4">
                        <label className="block lg:col-span-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Report title
                            </span>
                            <input
                                value={reportTitle}
                                onChange={event => setReportTitle(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Report clinical date
                            </span>
                            <input
                                value={reportDate}
                                onChange={event => setReportDate(event.target.value)}
                                placeholder="YYYY-MM-DD, YYYY-MM, YYYY, or blank"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Issued at
                            </span>
                            <input
                                type="datetime-local"
                                value={issuedAt}
                                onChange={event => setIssuedAt(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Laboratory / performer
                            </span>
                            <input
                                value={performer}
                                onChange={event => setPerformer(event.target.value)}
                                placeholder="Not recorded"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Specimen type
                            </span>
                            <input
                                value={specimenType}
                                onChange={event => setSpecimenType(event.target.value)}
                                placeholder="Blood, serum, urine…"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Collection date
                            </span>
                            <input
                                value={collectionDate}
                                onChange={event => setCollectionDate(event.target.value)}
                                placeholder="Leave blank when unknown"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block lg:col-span-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Source document
                            </span>
                            <div className={`mt-1.5 flex min-h-[42px] items-center gap-2 rounded-xl border px-3 py-2 text-xs ${source
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200'
                                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200'
                            }`}>
                                <DocumentTextIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="min-w-0 break-all">
                                    {source?.fileName
                                        || 'No original uploaded document is linked'}
                                </span>
                            </div>
                        </label>
                        <label className="block md:col-span-2 lg:col-span-4">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Report interpretation / conclusion
                            </span>
                            <textarea
                                value={interpretation}
                                onChange={event => setInterpretation(event.target.value)}
                                rows={2}
                                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                    </section>

                    <section className="overflow-x-auto">
                        <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                <tr>
                                    <th className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">Test / observation</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">LOINC</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Original value</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Original unit</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Reference text</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Flag</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Result date</th>
                                    <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Page</th>
                                    <th className="border-b border-slate-200 px-3 py-3 text-center dark:border-slate-800">Remove</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rows.map((row, index) => (
                                    <tr
                                        key={`${row.testName}-${index}`}
                                        className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60"
                                    >
                                        <td className="px-4 py-2">
                                            <input
                                                value={row.testName}
                                                onChange={event => updateRow(index, {
                                                    testName: event.target.value,
                                                })}
                                                aria-label={`Result ${index + 1} test name`}
                                                className="w-full min-w-[180px] rounded-lg border border-transparent bg-transparent px-2 py-2 font-semibold outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                value={row.loinc || ''}
                                                onChange={event => updateRow(index, {
                                                    loinc: event.target.value,
                                                })}
                                                aria-label={`Result ${index + 1} LOINC code`}
                                                className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-2 font-mono text-xs outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                value={String(row.value)}
                                                onChange={event => updateRow(index, {
                                                    value: event.target.value,
                                                })}
                                                aria-label={`Result ${index + 1} original value`}
                                                placeholder="<5, Positive, 7.2…"
                                                className="w-32 rounded-lg border border-blue-100 bg-blue-50 px-2 py-2 font-mono font-bold text-slate-950 outline-none focus:border-blue-400 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-white"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                value={row.units || ''}
                                                onChange={event => updateRow(index, {
                                                    units: event.target.value,
                                                })}
                                                aria-label={`Result ${index + 1} original unit`}
                                                className="w-28 rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                value={row.refRange || ''}
                                                onChange={event => updateRow(index, {
                                                    refRange: event.target.value,
                                                })}
                                                aria-label={`Result ${index + 1} reference range`}
                                                placeholder="4.0–10.0 or <5 or text"
                                                className="w-40 rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <select
                                                value={row.flag || 'Normal'}
                                                onChange={event => updateRow(index, {
                                                    flag: event.target.value as ReviewedLabRow['flag'],
                                                })}
                                                aria-label={`Result ${index + 1} interpretation flag`}
                                                className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                {[
                                                    'Normal',
                                                    'High',
                                                    'Low',
                                                    'Critical',
                                                    'Abnormal',
                                                    'Unknown',
                                                ].map(flag => (
                                                    <option key={flag} value={flag}>{flag}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                value={row.effectiveDate || ''}
                                                onChange={event => updateRow(index, {
                                                    effectiveDate: event.target.value,
                                                })}
                                                aria-label={`Result ${index + 1} clinical date`}
                                                placeholder="Blank = report date"
                                                className="w-32 rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={row.pageNumber || ''}
                                                onChange={event => updateRow(index, {
                                                    pageNumber: event.target.value
                                                        ? Number(event.target.value)
                                                        : undefined,
                                                })}
                                                aria-label={`Result ${index + 1} source page`}
                                                className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-2 text-xs outline-none focus:border-blue-400 focus:bg-white dark:focus:bg-slate-950"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => removeRow(index)}
                                                aria-label={`Remove result ${index + 1}`}
                                                className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                            >
                                                <XCircleIcon className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    {rows.length === 0 && (
                        <div className="p-8 text-center text-sm text-slate-500">
                            No report rows remain. Close the review or return to the source document.
                        </div>
                    )}
                </div>

                <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/80 md:flex-row md:items-center md:justify-between md:px-6">
                    <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {!source
                            ? 'Candidate creation is blocked because no original uploaded document is linked. Upload the source report and run the review again.'
                            : invalidRowCount > 0
                                ? `${invalidRowCount} row${invalidRowCount === 1 ? '' : 's'} require a test name and original value.`
                                : 'The saved graph stays pending until report-level confirmation in Labs & Reports.'}
                    </div>
                    <div className="flex flex-shrink-0 justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Discard review
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canSave}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CheckIcon className="h-4 w-4" />
                            Save report candidates
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default LabVerificationModal;