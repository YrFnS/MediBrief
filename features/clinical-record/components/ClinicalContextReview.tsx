import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    CheckIcon,
    EyeIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import { getOpenMedContextEvidence } from '../../openmed/contextEvidence';
import type { OpenMedContextResult } from '../../openmed/contextTypes';
import { selectCandidateResources } from '../selectors';
import type {
    ClinicalAssertionContext,
    SourceDocumentReference,
} from '../types';
import type { PatientClinicalResource } from '../resourceUtils';
import { useClinicalRecordStore } from '../useClinicalRecordStore';
import DocumentSourcePreview from './DocumentSourcePreview';

interface ClinicalContextReviewProps {
    patientId: string;
}

interface ContextCandidate {
    resource: PatientClinicalResource;
    context: OpenMedContextResult;
}

const DEFAULT_ASSERTION: ClinicalAssertionContext = {
    polarity: 'unknown',
    certainty: 'unknown',
    temporality: 'unknown',
    experiencer: 'unknown',
};

const labelFor = (resource: PatientClinicalResource): string => {
    switch (resource.resourceType) {
        case 'Condition': return resource.code.text;
        case 'Medication': return resource.medication.text;
        case 'AllergyIntolerance': return resource.substance.text;
        case 'Observation': return resource.code.text;
        case 'Encounter': return resource.type?.text || `${resource.encounterClass} encounter`;
        case 'DiagnosticReport': return resource.code.text;
        case 'Specimen': return resource.type?.text || 'Specimen';
        case 'Procedure': return resource.code.text;
        case 'Immunization': return resource.vaccineCode.text;
        case 'Appointment': return resource.title || resource.description || 'Appointment';
        case 'ClinicalTask': return resource.title;
        case 'CarePlan': return resource.title;
        case 'DocumentReference': return resource.title || resource.fileName;
        case 'ClinicalNote': return resource.title;
    }
};

const assertionFor = (resource: PatientClinicalResource): ClinicalAssertionContext => ({
    ...DEFAULT_ASSERTION,
    ...(resource.assertion || {}),
});

const display = (value: string): string =>
    value.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

const contextCandidatesFrom = (
    candidates: PatientClinicalResource[],
): ContextCandidate[] => candidates.reduce<ContextCandidate[]>((items, resource) => {
    const context = getOpenMedContextEvidence(resource);
    if (context) items.push({ resource, context });
    return items;
}, []);

const EvidenceValue: React.FC<{
    label: string;
    value: string;
    advisory?: boolean;
}> = ({ label, value, advisory = false }) => (
    <div className={`rounded-xl border px-3 py-2 ${advisory
        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'
        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'
    }`}>
        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {label}
        </p>
        <p className={`mt-1 text-xs font-bold ${advisory
            ? 'text-amber-800 dark:text-amber-200'
            : 'text-slate-800 dark:text-slate-100'
        }`}>
            {display(value)}
        </p>
    </div>
);

const ClinicalContextReview: React.FC<ClinicalContextReviewProps> = ({
    patientId,
}) => {
    const record = useClinicalRecordStore(state => state.records[patientId]);
    const actions = useClinicalRecordStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    const candidates = useMemo(
        () => contextCandidatesFrom(selectCandidateResources(record)),
        [record],
    );

    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<ClinicalAssertionContext>(DEFAULT_ASSERTION);
    const [baseline, setBaseline] = useState<ClinicalAssertionContext>(DEFAULT_ASSERTION);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);
    const [previewSource, setPreviewSource] = useState<SourceDocumentReference | null>(null);

    const selected = candidates.find(item => item.resource.id === selectedId)
        || candidates[0]
        || null;

    useEffect(() => {
        setSelectedId(current => current && candidates.some(item => item.resource.id === current)
            ? current
            : candidates[0]?.resource.id || null);
        if (candidates.length === 0) setIsOpen(false);
    }, [candidates]);

    useEffect(() => {
        if (!selected) return;
        const next = assertionFor(selected.resource);
        setDraft(next);
        setBaseline(next);
        setReason('');
        setError(null);
        setSavedMessage(null);
    }, [selected?.resource.id, selected?.resource.provenance.updatedAt]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isOpen]);

    if (candidates.length === 0) return null;

    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

    const saveContext = () => {
        if (!selected || !dirty) return;
        setError(null);
        setSavedMessage(null);
        const result = (actions.amendResource as any)(
            patientId,
            selected.resource.resourceType,
            selected.resource.id,
            { assertion: draft },
            {
                reason: reason.trim()
                    || 'Corrected advisory OpenMed assertion context during source review',
            },
        );
        if (!result.ok) {
            setError(result.message || 'The assertion context could not be updated.');
            return;
        }
        setBaseline(draft);
        setSavedMessage(
            'Context correction saved. The clinical fact is still a candidate and must be confirmed or rejected in the main review queue.',
        );
        auditActions.logEvent(
            'CLINICAL_RESOURCE_AMENDED',
            patientId,
            `Reviewed OpenMed context for candidate: ${labelFor(selected.resource)}`,
            'USER',
            {
                resourceId: selected.resource.id,
                resourceType: selected.resource.resourceType,
                contextEngine: selected.context.engine,
            },
        );
    };

    const openSource = () => {
        const source = selected?.resource.provenance.source.document;
        if (!selected || !source) return;
        setPreviewSource(source);
        auditActions.logEvent(
            'CLINICAL_SOURCE_VIEWED',
            patientId,
            `Viewed source for OpenMed context candidate: ${labelFor(selected.resource)}`,
            'USER',
            { resourceId: selected.resource.id, documentId: source.documentId },
        );
    };

    const setAxis = <K extends keyof ClinicalAssertionContext>(
        key: K,
        value: ClinicalAssertionContext[K],
    ) => setDraft(current => ({ ...current, [key]: value }));

    return (
        <>
            <div className="border-b border-cyan-200 bg-cyan-50 px-3 py-2 dark:border-cyan-900/50 dark:bg-cyan-950/20">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <ActivityIcon className="h-4 w-4 flex-shrink-0 text-cyan-700 dark:text-cyan-300" />
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-cyan-900 dark:text-cyan-100">
                                {candidates.length} OpenMed context {candidates.length === 1 ? 'annotation needs' : 'annotations need'} review
                            </p>
                            <p className="hidden text-[10px] text-cyan-700 dark:text-cyan-300 sm:block">
                                Negation, certainty, temporality, experiencer, and medication instructions are advisory evidence—not confirmed facts.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="flex-shrink-0 rounded-lg bg-cyan-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-cyan-600"
                    >
                        Review context
                    </button>
                </div>
            </div>

            {isOpen && selected && (
                <div className="fixed inset-0 z-[82] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
                    <div className="flex h-[92dvh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                        <aside className="hidden w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60 md:flex">
                            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">
                                    Context evidence queue
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    {candidates.length} pending candidates
                                </h2>
                            </div>
                            <div className="flex-1 space-y-2 overflow-y-auto p-3">
                                {candidates.map(item => (
                                    <button
                                        key={item.resource.id}
                                        type="button"
                                        onClick={() => setSelectedId(item.resource.id)}
                                        className={`w-full rounded-xl border p-3 text-left transition-all ${item.resource.id === selected.resource.id
                                            ? 'border-cyan-300 bg-white shadow-sm dark:border-cyan-700 dark:bg-slate-800'
                                            : 'border-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                                                {item.resource.resourceType}
                                            </span>
                                            <span className="text-[9px] font-mono text-slate-400">
                                                {item.context.cues.length} cue{item.context.cues.length === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                            {labelFor(item.resource)}
                                        </p>
                                        <p className="mt-2 truncate text-[9px] text-slate-400">
                                            {item.context.section?.label || 'No recognized section'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </aside>

                        <main className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">
                                        OpenMed context review · candidate only
                                    </p>
                                    <h2 className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
                                        {labelFor(selected.resource)}
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                                    aria-label="Close OpenMed context review"
                                >
                                    <XCircleIcon className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                <div className="mx-auto max-w-4xl space-y-5">
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                            <p>
                                                These values were produced by deterministic OpenMed clinical-context helpers. They assist review, but they do not confirm the diagnosis, medication, patient attribution, or clinical status. The main candidate review remains the only confirmation/rejection workflow.
                                            </p>
                                        </div>
                                    </div>

                                    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    Source span
                                                </p>
                                                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    “{selected.context.text}”
                                                </p>
                                                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                    Characters {selected.context.start}–{selected.context.end} · {selected.context.engine}{selected.context.engineVersion ? ` ${selected.context.engineVersion}` : ''} · bridge {selected.context.bridgeVersion}
                                                </p>
                                            </div>
                                            {selected.resource.provenance.source.document && (
                                                <button
                                                    type="button"
                                                    onClick={openSource}
                                                    className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                    View source
                                                </button>
                                            )}
                                        </div>
                                    </section>

                                    <section className="space-y-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                                Suggested assertion and your review
                                            </h3>
                                            <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                                OpenMed defaults some axes when no scoped cue exists. A default is not proof; change any value that is not supported by the source.
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-4">
                                            <EvidenceValue label="OpenMed polarity" value={selected.context.assertion.polarity} advisory={selected.context.cues.every(cue => cue.category !== 'negation')} />
                                            <EvidenceValue label="OpenMed certainty" value={selected.context.assertion.certainty} advisory={selected.context.cues.every(cue => cue.category !== 'uncertainty')} />
                                            <EvidenceValue label="OpenMed temporality" value={selected.context.assertion.temporality} advisory={!selected.context.section && selected.context.cues.every(cue => !['historical', 'hypothetical'].includes(cue.category))} />
                                            <EvidenceValue label="OpenMed experiencer" value={selected.context.assertion.experiencer} advisory={selected.context.experiencerEvidence.source === 'default'} />
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <label>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Polarity</span>
                                                <select
                                                    value={draft.polarity}
                                                    onChange={event => setAxis('polarity', event.target.value as ClinicalAssertionContext['polarity'])}
                                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                >
                                                    {['affirmed', 'negated', 'unknown'].map(value => <option key={value} value={value}>{display(value)}</option>)}
                                                </select>
                                            </label>
                                            <label>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Certainty</span>
                                                <select
                                                    value={draft.certainty}
                                                    onChange={event => setAxis('certainty', event.target.value as ClinicalAssertionContext['certainty'])}
                                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                >
                                                    {['certain', 'uncertain', 'unknown'].map(value => <option key={value} value={value}>{display(value)}</option>)}
                                                </select>
                                            </label>
                                            <label>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Temporality</span>
                                                <select
                                                    value={draft.temporality}
                                                    onChange={event => setAxis('temporality', event.target.value as ClinicalAssertionContext['temporality'])}
                                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                >
                                                    {['current', 'historical', 'hypothetical', 'unknown'].map(value => <option key={value} value={value}>{display(value)}</option>)}
                                                </select>
                                            </label>
                                            <label>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Experiencer</span>
                                                <select
                                                    value={draft.experiencer}
                                                    onChange={event => setAxis('experiencer', event.target.value as ClinicalAssertionContext['experiencer'])}
                                                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                >
                                                    {['patient', 'family', 'other', 'unknown'].map(value => <option key={value} value={value}>{display(value)}</option>)}
                                                </select>
                                            </label>
                                        </div>
                                    </section>

                                    <section className="grid gap-4 lg:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Scoped cues</h3>
                                            {selected.context.cues.length > 0 ? (
                                                <div className="mt-3 space-y-2">
                                                    {selected.context.cues.map(cue => (
                                                        <div key={`${cue.start}-${cue.end}-${cue.category}`} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">“{cue.text}”</span>
                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">{cue.category}</span>
                                                            </div>
                                                            <p className="mt-1 text-[9px] text-slate-400">Characters {cue.start}–{cue.end} · {cue.direction}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="mt-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                                                    No scoped context cue was recorded. The suggested values are defaults and require especially careful review.
                                                </p>
                                            )}
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Section and experiencer evidence</h3>
                                            <dl className="mt-3 space-y-2 text-xs">
                                                <div className="flex justify-between gap-3"><dt className="text-slate-500">Section</dt><dd className="text-right font-semibold">{selected.context.section?.label || 'Not recognized'}</dd></div>
                                                <div className="flex justify-between gap-3"><dt className="text-slate-500">Experiencer source</dt><dd className="text-right font-semibold">{display(selected.context.experiencerEvidence.source)}</dd></div>
                                                <div className="flex justify-between gap-3"><dt className="text-slate-500">Experiencer cue</dt><dd className="text-right font-semibold">{selected.context.experiencerEvidence.cue || 'None'}</dd></div>
                                                <div className="flex justify-between gap-3"><dt className="text-slate-500">Evaluated</dt><dd className="text-right font-semibold">{new Date(selected.context.evaluatedAt).toLocaleString()}</dd></div>
                                            </dl>
                                        </div>
                                    </section>

                                    {selected.context.medicationSig && (
                                        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                                            <h3 className="text-xs font-bold text-violet-900 dark:text-violet-100">Parsed medication instructions</h3>
                                            <p className="mt-1 text-[10px] leading-relaxed text-violet-700 dark:text-violet-300">
                                                Parsed locally from characters {selected.context.medicationSig.windowStart}–{selected.context.medicationSig.windowEnd}. These attributes populate a candidate dosage only and must be checked against the source.
                                            </p>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                {[
                                                    ['Raw window', selected.context.medicationSig.raw],
                                                    ['Dose', selected.context.medicationSig.dose !== undefined ? `${selected.context.medicationSig.dose} ${selected.context.medicationSig.unit || ''}`.trim() : 'Unknown'],
                                                    ['Route', selected.context.medicationSig.route || 'Unknown'],
                                                    ['Frequency', selected.context.medicationSig.frequencyPerDay !== undefined ? `${selected.context.medicationSig.frequencyPerDay} per day` : 'Unknown'],
                                                    ['As needed', selected.context.medicationSig.asNeeded ? 'Yes' : 'No'],
                                                    ['Duration', selected.context.medicationSig.durationDays !== undefined ? `${selected.context.medicationSig.durationDays} days` : 'Unknown'],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="rounded-xl border border-violet-200 bg-white px-3 py-2 dark:border-violet-900 dark:bg-slate-950">
                                                        <p className="text-[9px] font-bold uppercase tracking-wider text-violet-500">{label}</p>
                                                        <p className="mt-1 break-words text-xs font-semibold text-slate-800 dark:text-slate-100">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            {selected.context.medicationSig.missing.length > 0 && (
                                                <p className="mt-3 text-[10px] text-violet-700 dark:text-violet-300">
                                                    Unresolved fields: {selected.context.medicationSig.missing.join(', ')}.
                                                </p>
                                            )}
                                        </section>
                                    )}

                                    <label className="block">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Context correction reason</span>
                                        <textarea
                                            value={reason}
                                            onChange={event => setReason(event.target.value)}
                                            rows={2}
                                            placeholder="Optional; saved with the amendment history."
                                            className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                    </label>

                                    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
                                    {savedMessage && <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{savedMessage}</div>}
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    Save corrections here, then use the main candidate review to confirm or reject the fact.
                                </p>
                                <button
                                    type="button"
                                    onClick={saveContext}
                                    disabled={!dirty}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-cyan-700/15 hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    Save context correction
                                </button>
                            </div>
                        </main>
                    </div>
                </div>
            )}

            {previewSource && (
                <DocumentSourcePreview
                    patientId={patientId}
                    source={previewSource}
                    onClose={() => setPreviewSource(null)}
                />
            )}
        </>
    );
};

export default ClinicalContextReview;
