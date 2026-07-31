import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    AlertTriangleIcon,
    BeakerIcon,
    CheckIcon,
    DocumentTextIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import { useClinicalRecordStore } from '../../clinical-record';
import {
    buildAndCommitReviewedDiagnosticReport,
    buildReviewedDiagnosticReportBundle,
} from '../reviewAmendments';
import { buildDiagnosticReviewEvidence } from '../reviewEvidence';
import { createLegacyLabReviewSeed } from '../legacyLabReview';
import { validateDiagnosticReportBundleGraph } from '../graph';
import type {
    DiagnosticBundleCommitResult,
    DiagnosticReportReviewEvidence,
    PendingLegacyLabReview,
    ReviewedDiagnosticReportDraft,
    ReviewedObservationDraft,
    ReviewedSpecimenDraft,
} from '../types';
import DiagnosticReportSourcePane from './DiagnosticReportSourcePane';

const REVIEW_ACTOR = 'Local user';
const DEFAULT_REVIEW_REASON =
    'Human review corrected or selected the extracted diagnostic report content before confirmation.';

const REPORT_STATUSES: NonNullable<
    ReviewedDiagnosticReportDraft['status']
>[] = [
    'registered',
    'partial',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'cancelled',
    'entered-in-error',
    'unknown',
];

const RESULT_STATUSES: NonNullable<ReviewedObservationDraft['status']>[] = [
    'registered',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'cancelled',
    'entered-in-error',
    'unknown',
];

const SPECIMEN_STATUSES: NonNullable<ReviewedSpecimenDraft['status']>[] = [
    'available',
    'unavailable',
    'unsatisfactory',
    'entered-in-error',
    'unknown',
];

const optionalText = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed || undefined;
};

const nullableText = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed || null;
};

const splitPeople = (value: string): string[] => [
    ...new Set(
        value
            .split(/[,;\n]+/)
            .map(item => item.trim())
            .filter(Boolean),
    ),
];

const inputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition-colors focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClass =
    'text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400';

const fieldLabel = (value: string): string => value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_.]/g, ' ')
    .replace(/^./, letter => letter.toUpperCase());

interface DiagnosticReportReviewWorkspaceProps {
    patientId: string;
    pending: PendingLegacyLabReview;
    onSaved: (result: DiagnosticBundleCommitResult) => void;
    onCancel: () => void;
}

interface PreparedReview {
    draft: ReviewedDiagnosticReportDraft;
    evidence?: DiagnosticReportReviewEvidence;
    bundle: ReturnType<typeof buildReviewedDiagnosticReportBundle>;
    validation: ReturnType<typeof validateDiagnosticReportBundleGraph>;
}

const DiagnosticReportReviewWorkspace: React.FC<
    DiagnosticReportReviewWorkspaceProps
> = ({ patientId, pending, onSaved, onCancel }) => {
    const seed = useMemo(() => createLegacyLabReviewSeed({
        report: pending.report,
        patientId,
        source: pending.source,
    }), [patientId, pending]);
    const record = useClinicalRecordStore(state => state.records[patientId]);
    const logEvent = useAuditStore(state => state.actions.logEvent);

    const [draft, setDraft] = useState<ReviewedDiagnosticReportDraft>(
        seed.draft,
    );
    const [includedResultIds, setIncludedResultIds] = useState<Set<string>>(
        () => new Set(seed.draft.results.map(result => result.localId)),
    );
    const [reviewReason, setReviewReason] = useState(DEFAULT_REVIEW_REASON);
    const [sourcePage, setSourcePage] = useState<number | undefined>(
        seed.draft.source.pageNumber,
    );
    const [commitError, setCommitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        logEvent(
            'DIAGNOSTIC_REPORT_REVIEW_STARTED',
            patientId,
            'Opened the report-level diagnostic review workspace.',
            'USER',
            {
                documentId: pending.source.documentId,
                fileName: pending.source.fileName,
                extractionEngine: pending.extractionEngine,
                extractedResultCount: pending.report.labs.length,
            },
        );
    }, [
        logEvent,
        patientId,
        pending.detectedAt,
        pending.extractionEngine,
        pending.report.labs.length,
        pending.source.documentId,
        pending.source.fileName,
    ]);

    const cancelReview = useCallback(() => {
        logEvent(
            'DIAGNOSTIC_REPORT_REVIEW_CANCELLED',
            patientId,
            'Discarded the pending diagnostic report review without changing the clinical record.',
            'USER',
            {
                documentId: pending.source.documentId,
                fileName: pending.source.fileName,
                includedResultCount: includedResultIds.size,
            },
        );
        onCancel();
    }, [
        includedResultIds.size,
        logEvent,
        onCancel,
        patientId,
        pending.source.documentId,
        pending.source.fileName,
    ]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') cancelReview();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [cancelReview]);

    const setReportField = <K extends keyof ReviewedDiagnosticReportDraft>(
        field: K,
        value: ReviewedDiagnosticReportDraft[K],
    ) => {
        setCommitError(null);
        setDraft(current => ({ ...current, [field]: value }));
    };

    const updateResult = (
        localId: string,
        patch: Partial<ReviewedObservationDraft>,
    ) => {
        setCommitError(null);
        setDraft(current => ({
            ...current,
            results: current.results.map(result =>
                result.localId === localId
                    ? { ...result, ...patch }
                    : result),
        }));
    };

    const updateResultSource = (
        localId: string,
        patch: NonNullable<ReviewedObservationDraft['source']>,
    ) => {
        setCommitError(null);
        setDraft(current => ({
            ...current,
            results: current.results.map(result =>
                result.localId === localId
                    ? {
                        ...result,
                        source: { ...(result.source || {}), ...patch },
                    }
                    : result),
        }));
    };

    const toggleResult = (localId: string) => {
        setCommitError(null);
        setIncludedResultIds(current => {
            const next = new Set(current);
            if (next.has(localId)) next.delete(localId);
            else next.add(localId);
            return next;
        });
    };

    const addResult = () => {
        const localId = `manual-result-${Date.now()}-${draft.results.length + 1}`;
        const result: ReviewedObservationDraft = {
            localId,
            testName: '',
            status: 'unknown',
            categoryTexts: ['Laboratory'],
            valueText: null,
            source: {},
        };
        setDraft(current => ({
            ...current,
            results: [...current.results, result],
        }));
        setIncludedResultIds(current => new Set([...current, localId]));
    };

    const updateSpecimen = (
        localId: string,
        patch: Partial<ReviewedSpecimenDraft>,
    ) => {
        setCommitError(null);
        setDraft(current => ({
            ...current,
            specimens: (current.specimens || []).map(specimen =>
                specimen.localId === localId
                    ? { ...specimen, ...patch }
                    : specimen),
        }));
    };

    const addSpecimen = () => {
        const localId = `review-specimen-${Date.now()}-${(draft.specimens || []).length + 1}`;
        const specimen: ReviewedSpecimenDraft = {
            localId,
            status: 'unknown',
            collectedDate: null,
            receivedDate: null,
        };
        setDraft(current => ({
            ...current,
            specimens: [...(current.specimens || []), specimen],
        }));
    };

    const removeSpecimen = (localId: string) => {
        setCommitError(null);
        setDraft(current => ({
            ...current,
            specimens: (current.specimens || []).filter(specimen =>
                specimen.localId !== localId),
            results: current.results.map(result =>
                result.specimenLocalId === localId
                    ? { ...result, specimenLocalId: undefined }
                    : result),
        }));
    };

    const prepared = useMemo<{
        value?: PreparedReview;
        error?: string;
    }>(() => {
        const results = draft.results.filter(result =>
            includedResultIds.has(result.localId));
        if (results.length === 0) {
            return {
                error:
                    'At least one reviewed result must remain included before the report can be confirmed.',
            };
        }

        try {
            const reviewedAt = pending.detectedAt;
            const withoutEvidence: ReviewedDiagnosticReportDraft = {
                ...draft,
                patientId,
                results,
                verificationStatus: 'confirmed',
                reviewedAt,
                reviewedBy: REVIEW_ACTOR,
            };
            const evidence = buildDiagnosticReviewEvidence({
                initial: seed.draft,
                reviewed: withoutEvidence,
                includedResultIds,
                reason: reviewReason.trim() || DEFAULT_REVIEW_REASON,
            });
            const reviewedDraft: ReviewedDiagnosticReportDraft = {
                ...withoutEvidence,
                ...(evidence ? { reviewEvidence: evidence } : {}),
            };
            const bundle = buildReviewedDiagnosticReportBundle(reviewedDraft, {
                now: reviewedAt,
                actor: REVIEW_ACTOR,
            });
            return {
                value: {
                    draft: reviewedDraft,
                    ...(evidence ? { evidence } : {}),
                    bundle,
                    validation: validateDiagnosticReportBundleGraph(
                        bundle,
                        record,
                    ),
                },
            };
        } catch (error) {
            return {
                error: error instanceof Error
                    ? error.message
                    : 'The reviewed diagnostic report is invalid.',
            };
        }
    }, [
        draft,
        includedResultIds,
        patientId,
        pending.detectedAt,
        record,
        reviewReason,
        seed.draft,
    ]);

    const confirmReview = async () => {
        if (!prepared.value || !prepared.value.validation.valid) return;
        setIsSaving(true);
        setCommitError(null);
        try {
            const committedAt = new Date().toISOString();
            const finalDraft: ReviewedDiagnosticReportDraft = {
                ...prepared.value.draft,
                reviewedAt: committedAt,
            };
            const result = buildAndCommitReviewedDiagnosticReport(finalDraft, {
                now: committedAt,
                committedAt,
                actor: REVIEW_ACTOR,
            });
            if (!result.commit.ok) {
                setCommitError(
                    result.commit.message
                    || 'The diagnostic report graph was not saved.',
                );
                return;
            }

            logEvent(
                'DIAGNOSTIC_REPORT_REVIEW_CONFIRMED',
                patientId,
                'Confirmed and atomically saved a reviewed diagnostic report graph.',
                'USER',
                {
                    reportId: result.commit.reportId,
                    documentId: pending.source.documentId,
                    createdResourceIds: result.commit.createdResourceIds,
                    resultCount: result.bundle.observations.length,
                    specimenCount: result.bundle.specimens.length,
                    excludedResultCount:
                        seed.draft.results.length - includedResultIds.size,
                    reviewEvidence: finalDraft.reviewEvidence,
                    warnings: result.bundle.warnings,
                },
            );
            onSaved(result.commit);
        } catch (error) {
            setCommitError(
                error instanceof Error
                    ? error.message
                    : 'The diagnostic report could not be saved.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    const validationIssues = prepared.value?.validation.issues || [];
    const parsingWarnings = prepared.value?.bundle.warnings || [];
    const evidence = prepared.value?.evidence;
    const excludedCount = seed.draft.results.length
        - [...includedResultIds].filter(localId =>
            seed.draft.results.some(result => result.localId === localId)).length;
    const resultChangeCount = Object.values(
        evidence?.resultChanges || {},
    ).reduce((total, changes) => total + changes.length, 0);
    const specimenChangeCount = Object.values(
        evidence?.specimenChanges || {},
    ).reduce((total, changes) => total + changes.length, 0);

    return (
        <div
            className="fixed inset-0 z-[110] bg-slate-950/85 p-2 backdrop-blur-sm sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diagnostic-review-title"
        >
            <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-50 shadow-2xl dark:bg-slate-950">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            <BeakerIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h2
                                id="diagnostic-review-title"
                                className="truncate text-base font-bold text-slate-900 dark:text-white"
                            >
                                Review laboratory report
                            </h2>
                            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Original source + report + specimens + results
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={cancelReview}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 dark:border-slate-700"
                        aria-label="Discard diagnostic report review"
                    >
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </header>

                <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-3 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.45fr)] lg:p-4">
                    <div className="min-h-0 overflow-auto">
                        {seed.sourceAvailable && pending.source.documentId ? (
                            <DiagnosticReportSourcePane
                                patientId={patientId}
                                documentId={pending.source.documentId}
                                pageNumber={sourcePage}
                            />
                        ) : (
                            <section className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
                                <div className="max-w-md">
                                    <DocumentTextIcon className="mx-auto mb-3 h-10 w-10 text-amber-500" />
                                    <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                        Original report not linked
                                    </h3>
                                    <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                        {seed.sourceWarning}
                                    </p>
                                </div>
                            </section>
                        )}
                    </div>

                    <div className="min-h-0 overflow-y-auto pr-1">
                        <div className="space-y-4 pb-6">
                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                                    <div>
                                        <h3 className="text-xs font-bold text-amber-950 dark:text-amber-100">
                                            Source review is required
                                        </h3>
                                        <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                            OCR and AI can misread decimal points, comparators, units, dates, and row boundaries. Confirm only what is visible in the original report. A recorded flag or range is not a diagnosis.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Report metadata
                                        </h3>
                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                            Dates may be YYYY-MM-DD, YYYY-MM, or YYYY. Leave blank when unknown.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] text-slate-500 dark:bg-slate-800">
                                        {pending.extractionEngine}
                                    </span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block sm:col-span-2">
                                        <span className={labelClass}>Report title</span>
                                        <input
                                            value={draft.reportTitle}
                                            onChange={event => setReportField(
                                                'reportTitle',
                                                event.target.value,
                                            )}
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Status</span>
                                        <select
                                            value={draft.status || 'unknown'}
                                            onChange={event => setReportField(
                                                'status',
                                                event.target.value as ReviewedDiagnosticReportDraft['status'],
                                            )}
                                            className={inputClass}
                                        >
                                            {REPORT_STATUSES.map(status => (
                                                <option key={status} value={status}>
                                                    {fieldLabel(status)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Clinical report date</span>
                                        <input
                                            value={draft.effectiveDate || ''}
                                            onChange={event => setReportField(
                                                'effectiveDate',
                                                nullableText(event.target.value),
                                            )}
                                            placeholder="YYYY-MM-DD, YYYY-MM, YYYY, or blank"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Issued date-time</span>
                                        <input
                                            value={draft.issuedAt || ''}
                                            onChange={event => setReportField(
                                                'issuedAt',
                                                nullableText(event.target.value),
                                            )}
                                            placeholder="ISO date-time or blank"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>Performer</span>
                                        <input
                                            value={(draft.performer || []).join(', ')}
                                            onChange={event => setReportField(
                                                'performer',
                                                splitPeople(event.target.value),
                                            )}
                                            placeholder="Laboratory or organization"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block sm:col-span-2">
                                        <span className={labelClass}>Accession identifier</span>
                                        <input
                                            value={draft.accessionIdentifier?.value || ''}
                                            onChange={event => setReportField(
                                                'accessionIdentifier',
                                                optionalText(event.target.value)
                                                    ? {
                                                        ...(draft.accessionIdentifier || {}),
                                                        value: event.target.value.trim(),
                                                    }
                                                    : undefined,
                                            )}
                                            placeholder="Optional source accession number"
                                            className={inputClass}
                                        />
                                    </label>
                                    <label className="block sm:col-span-2">
                                        <span className={labelClass}>Conclusion / report comment</span>
                                        <textarea
                                            value={draft.conclusion || ''}
                                            onChange={event => setReportField(
                                                'conclusion',
                                                optionalText(event.target.value),
                                            )}
                                            rows={3}
                                            className={inputClass}
                                        />
                                    </label>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Specimens
                                        </h3>
                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                            Sample details belong to a specimen, not to every result row.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addSpecimen}
                                        className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                    >
                                        Add specimen
                                    </button>
                                </div>

                                {(draft.specimens || []).length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
                                        No specimen details were extracted. Leave this empty rather than inventing a sample.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {(draft.specimens || []).map((specimen, index) => (
                                            <article
                                                key={specimen.localId}
                                                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                                            >
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                        Specimen {index + 1}
                                                    </h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSpecimen(specimen.localId)}
                                                        className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:underline"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                    <label>
                                                        <span className={labelClass}>Type</span>
                                                        <input
                                                            value={specimen.typeText || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                { typeText: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Status</span>
                                                        <select
                                                            value={specimen.status || 'unknown'}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                {
                                                                    status: event.target.value as ReviewedSpecimenDraft['status'],
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        >
                                                            {SPECIMEN_STATUSES.map(status => (
                                                                <option key={status} value={status}>
                                                                    {fieldLabel(status)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Identifier</span>
                                                        <input
                                                            value={specimen.identifiers?.[0]?.value || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                {
                                                                    identifiers: optionalText(event.target.value)
                                                                        ? [{
                                                                            ...(specimen.identifiers?.[0] || {}),
                                                                            value: event.target.value.trim(),
                                                                        }]
                                                                        : undefined,
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Collected date</span>
                                                        <input
                                                            value={specimen.collectedDate || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                {
                                                                    collectedDate: nullableText(event.target.value),
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Received date</span>
                                                        <input
                                                            value={specimen.receivedDate || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                {
                                                                    receivedDate: nullableText(event.target.value),
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Collector</span>
                                                        <input
                                                            value={specimen.collector || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                { collector: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Body site</span>
                                                        <input
                                                            value={specimen.bodySiteText || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                { bodySiteText: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Collection method</span>
                                                        <input
                                                            value={specimen.collectionMethodText || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                {
                                                                    collectionMethodText: optionalText(event.target.value),
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label className="sm:col-span-2 lg:col-span-3">
                                                        <span className={labelClass}>Notes</span>
                                                        <input
                                                            value={specimen.note || ''}
                                                            onChange={event => updateSpecimen(
                                                                specimen.localId,
                                                                { note: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Results
                                        </h3>
                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                            Include only rows confirmed against the original report. Qualitative, comparator, textual, and absent results are supported.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addResult}
                                        className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                    >
                                        Add result
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {draft.results.map((result, index) => {
                                        const included = includedResultIds.has(result.localId);
                                        const pageNumber = result.source?.pageNumber;
                                        return (
                                            <article
                                                key={result.localId}
                                                className={`rounded-xl border p-3 transition-colors ${included
                                                    ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/40'
                                                    : 'border-slate-200 bg-slate-100 opacity-70 dark:border-slate-800 dark:bg-slate-950/20'
                                                }`}
                                            >
                                                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                                    <label className="flex cursor-pointer items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={included}
                                                            onChange={() => toggleResult(result.localId)}
                                                        />
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                            Result {index + 1}: {result.testName || 'Untitled'}
                                                        </span>
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        {pageNumber && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSourcePage(pageNumber)}
                                                                className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-[10px] text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300"
                                                            >
                                                                View page {pageNumber}
                                                            </button>
                                                        )}
                                                        <span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${included
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                        }`}>
                                                            {included ? 'Included' : 'Excluded'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                    <label className="sm:col-span-2">
                                                        <span className={labelClass}>Test name</span>
                                                        <input
                                                            value={result.testName}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { testName: event.target.value },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>LOINC</span>
                                                        <input
                                                            value={result.loincCode || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { loincCode: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Status</span>
                                                        <select
                                                            value={result.status || 'unknown'}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                {
                                                                    status: event.target.value as ReviewedObservationDraft['status'],
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        >
                                                            {RESULT_STATUSES.map(status => (
                                                                <option key={status} value={status}>
                                                                    {fieldLabel(status)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Value</span>
                                                        <input
                                                            value={result.valueText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { valueText: nullableText(event.target.value) },
                                                            )}
                                                            placeholder="5.7, <5, Negative, text…"
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Unit</span>
                                                        <input
                                                            value={result.unitText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { unitText: nullableText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Reference range</span>
                                                        <input
                                                            value={result.referenceRangeText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                {
                                                                    referenceRangeText: nullableText(event.target.value),
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Interpretation flag</span>
                                                        <input
                                                            value={result.interpretationText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                {
                                                                    interpretationText: nullableText(event.target.value),
                                                                },
                                                            )}
                                                            placeholder="High, low, abnormal…"
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label className="sm:col-span-2">
                                                        <span className={labelClass}>Absent-result reason</span>
                                                        <input
                                                            value={result.absentReasonText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                {
                                                                    absentReasonText: nullableText(event.target.value),
                                                                },
                                                            )}
                                                            placeholder="Use when no result value exists"
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Clinical date</span>
                                                        <input
                                                            value={result.clinicalDate || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                {
                                                                    clinicalDate: nullableText(event.target.value),
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Issued date-time</span>
                                                        <input
                                                            value={result.issuedAt || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { issuedAt: nullableText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Specimen</span>
                                                        <select
                                                            value={result.specimenLocalId || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                {
                                                                    specimenLocalId: optionalText(event.target.value),
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        >
                                                            <option value="">Not linked</option>
                                                            {(draft.specimens || []).map(specimen => (
                                                                <option
                                                                    key={specimen.localId}
                                                                    value={specimen.localId}
                                                                >
                                                                    {specimen.typeText || specimen.localId}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Source page</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={result.source?.pageNumber || ''}
                                                            onChange={event => updateResultSource(
                                                                result.localId,
                                                                {
                                                                    pageNumber: Number(event.target.value) > 0
                                                                        ? Number(event.target.value)
                                                                        : undefined,
                                                                },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Section</span>
                                                        <input
                                                            value={result.source?.section || ''}
                                                            onChange={event => updateResultSource(
                                                                result.localId,
                                                                { section: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Method</span>
                                                        <input
                                                            value={result.methodText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { methodText: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className={labelClass}>Body site</span>
                                                        <input
                                                            value={result.bodySiteText || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { bodySiteText: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label className="sm:col-span-2 lg:col-span-4">
                                                        <span className={labelClass}>Source excerpt</span>
                                                        <textarea
                                                            value={result.source?.excerpt || ''}
                                                            onChange={event => updateResultSource(
                                                                result.localId,
                                                                { excerpt: optionalText(event.target.value) },
                                                            )}
                                                            rows={2}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                    <label className="sm:col-span-2 lg:col-span-4">
                                                        <span className={labelClass}>Notes</span>
                                                        <input
                                                            value={result.note || ''}
                                                            onChange={event => updateResult(
                                                                result.localId,
                                                                { note: optionalText(event.target.value) },
                                                            )}
                                                            className={inputClass}
                                                        />
                                                    </label>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Review evidence and graph validation
                                </h3>
                                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Included</p>
                                        <p className="mt-1 text-xl font-bold">{includedResultIds.size}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Excluded</p>
                                        <p className="mt-1 text-xl font-bold">{Math.max(0, excludedCount)}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Edits</p>
                                        <p className="mt-1 text-xl font-bold">
                                            {(evidence?.reportChanges?.length || 0)
                                                + resultChangeCount
                                                + specimenChangeCount}
                                        </p>
                                    </div>
                                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Graph</p>
                                        <p className={`mt-1 text-sm font-bold ${prepared.value?.validation.valid
                                            ? 'text-emerald-600'
                                            : 'text-red-600'
                                        }`}>
                                            {prepared.value?.validation.valid
                                                ? 'Ready'
                                                : 'Blocked'}
                                        </p>
                                    </div>
                                </div>

                                <label className="mt-3 block">
                                    <span className={labelClass}>Review / correction reason</span>
                                    <textarea
                                        value={reviewReason}
                                        onChange={event => setReviewReason(event.target.value)}
                                        rows={2}
                                        className={inputClass}
                                    />
                                </label>

                                {(prepared.error || validationIssues.length > 0) && (
                                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                                        <p className="font-bold">The report graph cannot be confirmed yet.</p>
                                        <ul className="mt-2 list-disc space-y-1 pl-5">
                                            {prepared.error && <li>{prepared.error}</li>}
                                            {validationIssues.map((issue, index) => (
                                                <li key={`${issue.code}-${index}`}>
                                                    {issue.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {parsingWarnings.length > 0 && (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                                        <p className="font-bold">Review warnings</p>
                                        <ul className="mt-2 list-disc space-y-1 pl-5">
                                            {[...new Set(parsingWarnings.map(warning => warning.message))]
                                                .map(message => <li key={message}>{message}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {commitError && (
                                    <div
                                        role="alert"
                                        className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                                    >
                                        {commitError}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
                    <p className="max-w-3xl text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        Confirmation saves one connected report graph atomically. It does not diagnose the patient, contact a laboratory, or execute care.
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={cancelReview}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Discard review
                        </button>
                        <button
                            type="button"
                            onClick={confirmReview}
                            disabled={
                                isSaving
                                || !seed.sourceAvailable
                                || !prepared.value?.validation.valid
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CheckIcon className="h-4 w-4" />
                            {isSaving
                                ? 'Saving graph…'
                                : 'Confirm report graph'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default DiagnosticReportReviewWorkspace;
