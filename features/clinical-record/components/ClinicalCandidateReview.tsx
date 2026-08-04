import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    CheckIcon,
    DocumentTextIcon,
    EyeIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import {
    getObservationDisplayValue,
    selectCandidateResources,
} from '../selectors';
import type {
    ClinicalCodeableConcept,
    ObservationRecord,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../types';
import type { PatientClinicalResource } from '../resourceUtils';
import { useClinicalRecordStore } from '../useClinicalRecordStore';
import DocumentSourcePreview from './DocumentSourcePreview';

interface ClinicalCandidateReviewProps {
    patientId: string;
}

interface CandidateDraft {
    label: string;
    value: string;
    unit: string;
    secondary: string;
    note: string;
}

const RESOURCE_LABELS: Record<PatientClinicalResource['resourceType'], string> = {
    Encounter: 'Encounter',
    Condition: 'Condition',
    AllergyIntolerance: 'Allergy',
    Medication: 'Medication',
    Observation: 'Observation',
    DiagnosticReport: 'Diagnostic report',
    Specimen: 'Specimen',
    Procedure: 'Procedure',
    Immunization: 'Immunization',
    Appointment: 'Appointment',
    ClinicalTask: 'Task',
    CarePlan: 'Care plan',
    DocumentReference: 'Document',
    ClinicalNote: 'Clinical note',
};

const conceptWithText = (
    concept: ClinicalCodeableConcept | undefined,
    text: string,
): ClinicalCodeableConcept => ({
    ...(concept || {}),
    text,
});

const primaryLabel = (resource: PatientClinicalResource): string => {
    switch (resource.resourceType) {
        case 'Encounter':
            return resource.type?.text
                || resource.reason?.[0]?.text
                || `${resource.encounterClass} encounter`;
        case 'Condition':
            return resource.code.text;
        case 'AllergyIntolerance':
            return resource.substance.text;
        case 'Medication':
            return resource.medication.text;
        case 'Observation':
            return resource.code.text;
        case 'DiagnosticReport':
            return resource.code.text;
        case 'Specimen':
            return resource.type?.text || 'Specimen';
        case 'Procedure':
            return resource.code.text;
        case 'Immunization':
            return resource.vaccineCode.text;
        case 'Appointment':
            return resource.title || resource.description || 'Appointment';
        case 'ClinicalTask':
            return resource.title;
        case 'CarePlan':
            return resource.title;
        case 'DocumentReference':
            return resource.title || resource.fileName;
        case 'ClinicalNote':
            return resource.title;
    }
};

const noteText = (resource: PatientClinicalResource): string => {
    switch (resource.resourceType) {
        case 'Condition':
        case 'AllergyIntolerance':
        case 'Medication':
        case 'Observation':
        case 'Specimen':
        case 'Procedure':
        case 'Immunization':
        case 'Appointment':
        case 'ClinicalTask':
        case 'CarePlan':
            return resource.note || '';
        default:
            return '';
    }
};

const secondaryText = (resource: PatientClinicalResource): string => {
    switch (resource.resourceType) {
        case 'Condition':
            return resource.clinicalStatus;
        case 'AllergyIntolerance':
            return resource.criticality;
        case 'Medication':
            return resource.dosageInstructions[0]?.text || '';
        case 'Encounter':
            return resource.location || '';
        case 'DiagnosticReport':
            return resource.conclusion || '';
        case 'Procedure':
            return resource.outcome?.text || '';
        case 'Immunization':
            return resource.lotNumber || '';
        case 'Appointment':
            return resource.description || '';
        case 'ClinicalTask':
            return resource.description || '';
        case 'CarePlan':
            return resource.description || '';
        case 'DocumentReference':
            return resource.description || '';
        case 'ClinicalNote':
            return resource.sections[0]?.text || '';
        default:
            return '';
    }
};

const observationDraft = (
    resource: ObservationRecord,
): Pick<CandidateDraft, 'value' | 'unit'> => {
    const display = getObservationDisplayValue(resource);
    if (!display) return { value: '', unit: '' };
    return {
        value: String(display.value),
        unit: display.unit,
    };
};

const createDraft = (resource: PatientClinicalResource): CandidateDraft => {
    const observation = resource.resourceType === 'Observation'
        ? observationDraft(resource)
        : { value: '', unit: '' };

    return {
        label: primaryLabel(resource),
        value: observation.value,
        unit: observation.unit,
        secondary: secondaryText(resource),
        note: noteText(resource),
    };
};

const withOptionalNote = (
    resource: PatientClinicalResource,
    patch: Record<string, unknown>,
    note: string,
): Record<string, unknown> => {
    switch (resource.resourceType) {
        case 'Condition':
        case 'AllergyIntolerance':
        case 'Medication':
        case 'Observation':
        case 'Specimen':
        case 'Procedure':
        case 'Immunization':
        case 'Appointment':
        case 'ClinicalTask':
        case 'CarePlan':
            return { ...patch, note: note.trim() || undefined };
        default:
            return patch;
    }
};

const observationValuePatch = (
    observation: ObservationRecord,
    draft: CandidateDraft,
): ObservationRecord['value'] | undefined => {
    if (!draft.value.trim()) return observation.value;

    const current = observation.value;
    if (current?.type === 'quantity') {
        const parsed = Number(draft.value.replace(/^[<>]=?/, '').trim());
        if (!Number.isFinite(parsed)) return current;
        const comparatorMatch = draft.value.trim().match(/^(<=|>=|<|>)/);
        return {
            type: 'quantity',
            quantity: {
                original: {
                    ...current.quantity.original,
                    value: parsed,
                    ...(draft.unit.trim()
                        ? { unit: draft.unit.trim() }
                        : {}),
                    ...(comparatorMatch
                        ? { comparator: comparatorMatch[1] as '<' | '<=' | '>=' | '>' }
                        : {}),
                },
            },
        };
    }
    if (current?.type === 'integer') {
        const parsed = Number.parseInt(draft.value, 10);
        return Number.isFinite(parsed) ? { type: 'integer', value: parsed } : current;
    }
    if (current?.type === 'boolean') {
        const normalized = draft.value.trim().toLowerCase();
        if (['yes', 'true', '1', 'positive'].includes(normalized)) {
            return { type: 'boolean', value: true };
        }
        if (['no', 'false', '0', 'negative'].includes(normalized)) {
            return { type: 'boolean', value: false };
        }
        return current;
    }
    if (current?.type === 'codeable-concept') {
        return {
            type: 'codeable-concept',
            concept: conceptWithText(current.concept, draft.value.trim()),
        };
    }
    return { type: 'string', text: draft.value.trim() };
};

const buildPatch = (
    resource: PatientClinicalResource,
    draft: CandidateDraft,
): Record<string, unknown> => {
    const label = draft.label.trim() || primaryLabel(resource);
    let patch: Record<string, unknown> = {};

    switch (resource.resourceType) {
        case 'Encounter':
            patch = {
                type: resource.type
                    ? conceptWithText(resource.type, label)
                    : { text: label },
                location: draft.secondary.trim() || undefined,
            };
            break;
        case 'Condition':
            patch = {
                code: conceptWithText(resource.code, label),
                clinicalStatus: draft.secondary || resource.clinicalStatus,
            };
            break;
        case 'AllergyIntolerance':
            patch = {
                substance: conceptWithText(resource.substance, label),
                criticality: draft.secondary || resource.criticality,
            };
            break;
        case 'Medication':
            patch = {
                medication: conceptWithText(resource.medication, label),
                dosageInstructions: draft.secondary.trim()
                    ? [
                        {
                            ...(resource.dosageInstructions[0] || {}),
                            text: draft.secondary.trim(),
                        },
                        ...resource.dosageInstructions.slice(1),
                    ]
                    : resource.dosageInstructions,
            };
            break;
        case 'Observation':
            patch = {
                code: conceptWithText(resource.code, label),
                value: observationValuePatch(resource, draft),
            };
            break;
        case 'DiagnosticReport':
            patch = {
                code: conceptWithText(resource.code, label),
                conclusion: draft.secondary.trim() || undefined,
            };
            break;
        case 'Specimen':
            patch = {
                type: resource.type
                    ? conceptWithText(resource.type, label)
                    : { text: label },
            };
            break;
        case 'Procedure':
            patch = {
                code: conceptWithText(resource.code, label),
                outcome: draft.secondary.trim()
                    ? conceptWithText(resource.outcome, draft.secondary.trim())
                    : resource.outcome,
            };
            break;
        case 'Immunization':
            patch = {
                vaccineCode: conceptWithText(resource.vaccineCode, label),
                lotNumber: draft.secondary.trim() || undefined,
            };
            break;
        case 'Appointment':
            patch = {
                title: label,
                description: draft.secondary.trim() || undefined,
            };
            break;
        case 'ClinicalTask':
            patch = {
                title: label,
                description: draft.secondary.trim() || undefined,
            };
            break;
        case 'CarePlan':
            patch = {
                title: label,
                description: draft.secondary.trim() || undefined,
            };
            break;
        case 'DocumentReference':
            patch = {
                title: label,
                description: draft.secondary.trim() || undefined,
            };
            break;
        case 'ClinicalNote':
            patch = {
                title: label,
                sections: resource.sections.length > 0
                    ? [
                        {
                            ...resource.sections[0],
                            text: draft.secondary,
                        },
                        ...resource.sections.slice(1),
                    ]
                    : [{ title: 'Note', text: draft.secondary }],
            };
            break;
    }

    return withOptionalNote(resource, patch, draft.note);
};

const secondaryField = (
    resource: PatientClinicalResource,
): { label: string; type: 'text' | 'textarea' | 'condition-status' | 'criticality' } | null => {
    switch (resource.resourceType) {
        case 'Condition':
            return { label: 'Clinical status', type: 'condition-status' };
        case 'AllergyIntolerance':
            return { label: 'Criticality', type: 'criticality' };
        case 'Medication':
            return { label: 'Dosage instructions', type: 'textarea' };
        case 'Encounter':
            return { label: 'Location', type: 'text' };
        case 'DiagnosticReport':
            return { label: 'Conclusion', type: 'textarea' };
        case 'Procedure':
            return { label: 'Outcome', type: 'text' };
        case 'Immunization':
            return { label: 'Lot number', type: 'text' };
        case 'Appointment':
        case 'ClinicalTask':
        case 'CarePlan':
        case 'DocumentReference':
            return { label: 'Details', type: 'textarea' };
        case 'ClinicalNote':
            return { label: 'First note section', type: 'textarea' };
        default:
            return null;
    }
};

const sourceLabel = (resource: PatientClinicalResource): string => {
    const source = resource.provenance.source;
    if (source.document) {
        const location = [
            source.document.fileName || 'Document',
            source.document.pageNumber ? `page ${source.document.pageNumber}` : '',
            source.document.section || '',
        ].filter(Boolean).join(' · ');
        return location;
    }
    if (source.externalSystem || source.externalId) {
        return [source.externalSystem, source.externalId].filter(Boolean).join(' · ');
    }
    return source.description || source.kind.replace(/-/g, ' ');
};

const contextBadges = (resource: PatientClinicalResource): string[] => {
    if (!resource.assertion) return [];
    return [
        resource.assertion.polarity,
        resource.assertion.certainty,
        resource.assertion.temporality,
        resource.assertion.experiencer,
    ];
};

const nextSelectedId = (
    candidates: PatientClinicalResource[],
    currentId: string | null,
): string | null => {
    if (currentId && candidates.some(candidate => candidate.id === currentId)) {
        return currentId;
    }
    return candidates[0]?.id || null;
};

const ClinicalCandidateReview: React.FC<ClinicalCandidateReviewProps> = ({
    patientId,
}) => {
    const record = useClinicalRecordStore(state => state.records[patientId]);
    const actions = useClinicalRecordStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    const candidates = useMemo(
        () => selectCandidateResources(record),
        [record],
    );

    const [isOpen, setIsOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<CandidateDraft | null>(null);
    const [baselineDraft, setBaselineDraft] = useState<CandidateDraft | null>(null);
    const [reviewReason, setReviewReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [previewSource, setPreviewSource] = useState<SourceDocumentReference | null>(null);

    const selected = candidates.find(candidate => candidate.id === selectedId)
        || candidates[0]
        || null;

    useEffect(() => {
        setSelectedId(current => nextSelectedId(candidates, current));
        if (candidates.length === 0) setIsOpen(false);
    }, [candidates]);

    useEffect(() => {
        if (!selected) {
            setDraft(null);
            setBaselineDraft(null);
            return;
        }
        const nextDraft = createDraft(selected);
        setDraft(nextDraft);
        setBaselineDraft(nextDraft);
        setReviewReason('');
        setError(null);
    }, [selected?.id, selected?.provenance.updatedAt]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    if (candidates.length === 0) return null;

    const isDirty = !!draft
        && !!baselineDraft
        && JSON.stringify(draft) !== JSON.stringify(baselineDraft);

    const saveDraft = (): PatientClinicalResource | null => {
        if (!selected || !draft) return selected;
        if (!isDirty) return selected;

        const result = (actions.amendResource as any)(
            patientId,
            selected.resourceType,
            selected.id,
            buildPatch(selected, draft),
            {
                reason: 'Edited during candidate review',
            },
        );

        if (!result.ok) {
            setError(result.message || 'The candidate could not be updated.');
            return null;
        }

        const updated = (result.resource || selected) as PatientClinicalResource;
        const nextDraft = createDraft(updated);
        setDraft(nextDraft);
        setBaselineDraft(nextDraft);
        auditActions.logEvent(
            'CLINICAL_RESOURCE_AMENDED',
            patientId,
            `Edited ${RESOURCE_LABELS[selected.resourceType]} candidate: ${primaryLabel(updated)}`,
            'USER',
            { resourceId: selected.id, resourceType: selected.resourceType },
        );
        return updated;
    };

    const confirmSelected = () => {
        if (!selected) return;
        setError(null);
        const reviewed = saveDraft();
        if (!reviewed) return;

        const result = (actions.confirmCandidate as any)(
            patientId,
            reviewed.resourceType,
            reviewed.id,
            {
                reason: reviewReason.trim() || 'Confirmed in candidate review',
            },
        );
        if (!result.ok) {
            setError(result.message || 'The candidate could not be confirmed.');
            return;
        }

        auditActions.logEvent(
            'CLINICAL_CANDIDATE_CONFIRMED',
            patientId,
            `Confirmed ${RESOURCE_LABELS[reviewed.resourceType]}: ${primaryLabel(reviewed)}`,
            'USER',
            { resourceId: reviewed.id, resourceType: reviewed.resourceType },
        );
    };

    const rejectSelected = () => {
        if (!selected) return;
        setError(null);
        const result = (actions.rejectCandidate as any)(
            patientId,
            selected.resourceType,
            selected.id,
            {
                reason: reviewReason.trim() || 'Rejected in candidate review',
            },
        );
        if (!result.ok) {
            setError(result.message || 'The candidate could not be rejected.');
            return;
        }

        auditActions.logEvent(
            'CLINICAL_CANDIDATE_REJECTED',
            patientId,
            `Rejected ${RESOURCE_LABELS[selected.resourceType]} candidate: ${primaryLabel(selected)}`,
            'USER',
            { resourceId: selected.id, resourceType: selected.resourceType },
        );
    };

    const openSource = () => {
        const source = selected?.provenance.source.document;
        if (!selected || !source) return;
        setPreviewSource(source);
        auditActions.logEvent(
            'CLINICAL_SOURCE_VIEWED',
            patientId,
            `Viewed source for ${RESOURCE_LABELS[selected.resourceType]} candidate: ${primaryLabel(selected)}`,
            'USER',
            { resourceId: selected.id, documentId: source.documentId },
        );
    };

    const secondary = selected ? secondaryField(selected) : null;
    const confidence = selected?.provenance.extraction?.confidence;

    return (
        <>
            <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <AlertTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-amber-900 dark:text-amber-100">
                                {candidates.length} clinical {candidates.length === 1 ? 'fact needs' : 'facts need'} review
                            </p>
                            <p className="hidden text-[10px] text-amber-700 dark:text-amber-300 sm:block">
                                Candidates do not appear in confirmed summaries until accepted.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(true)}
                        className="flex-shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-amber-500"
                    >
                        Review candidates
                    </button>
                </div>
            </div>

            {isOpen && selected && draft && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
                    <div className="flex h-[92dvh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                        <aside className="hidden w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60 md:flex">
                            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-600">
                                    Review queue
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                                    {candidates.length} pending
                                </h2>
                            </div>
                            <div className="flex-1 space-y-2 overflow-y-auto p-3">
                                {candidates.map(candidate => (
                                    <button
                                        key={candidate.id}
                                        onClick={() => setSelectedId(candidate.id)}
                                        className={`w-full rounded-xl border p-3 text-left transition-all ${candidate.id === selected.id
                                            ? 'border-amber-300 bg-white shadow-sm dark:border-amber-700 dark:bg-slate-800'
                                            : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600">
                                                {RESOURCE_LABELS[candidate.resourceType]}
                                            </span>
                                            {candidate.provenance.extraction?.confidence !== undefined && (
                                                <span className="text-[9px] font-mono text-slate-400">
                                                    {Math.round(candidate.provenance.extraction.confidence * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                            {primaryLabel(candidate)}
                                        </p>
                                        <p className="mt-2 truncate text-[9px] text-slate-400">
                                            {sourceLabel(candidate)}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </aside>

                        <main className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-600">
                                        Candidate review · {RESOURCE_LABELS[selected.resourceType]}
                                    </p>
                                    <h2 className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
                                        {primaryLabel(selected)}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                                    aria-label="Close candidate review"
                                >
                                    <XCircleIcon className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                                <div className="mx-auto max-w-3xl space-y-5">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {contextBadges(selected).map(badge => (
                                                <span
                                                    key={badge}
                                                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                >
                                                    {badge}
                                                </span>
                                            ))}
                                            {confidence !== undefined && (
                                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                                    Extraction confidence {Math.round(confidence * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-3 flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    Source
                                                </p>
                                                <p className="mt-1 break-words text-xs text-slate-600 dark:text-slate-300">
                                                    {sourceLabel(selected)}
                                                </p>
                                            </div>
                                            {selected.provenance.source.document && (
                                                <button
                                                    onClick={openSource}
                                                    className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                    View source
                                                </button>
                                            )}
                                        </div>
                                        {selected.provenance.source.document?.excerpt && (
                                            <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-white p-3 text-xs italic leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                {selected.provenance.source.document.excerpt}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="sm:col-span-2">
                                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                Clinical label
                                            </span>
                                            <input
                                                value={draft.label}
                                                onChange={event => setDraft(current => current
                                                    ? { ...current, label: event.target.value }
                                                    : current)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                            />
                                        </label>

                                        {selected.resourceType === 'Observation' && (
                                            <>
                                                <label>
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Original value
                                                    </span>
                                                    <input
                                                        value={draft.value}
                                                        onChange={event => setDraft(current => current
                                                            ? { ...current, value: event.target.value }
                                                            : current)}
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                </label>
                                                <label>
                                                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                        Original unit
                                                    </span>
                                                    <input
                                                        value={draft.unit}
                                                        onChange={event => setDraft(current => current
                                                            ? { ...current, unit: event.target.value }
                                                            : current)}
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                </label>
                                            </>
                                        )}

                                        {secondary?.type === 'condition-status' && (
                                            <label className="sm:col-span-2">
                                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    {secondary.label}
                                                </span>
                                                <select
                                                    value={draft.secondary}
                                                    onChange={event => setDraft(current => current
                                                        ? { ...current, secondary: event.target.value }
                                                        : current)}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                >
                                                    {['active', 'inactive', 'resolved', 'remission', 'unknown'].map(option => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}

                                        {secondary?.type === 'criticality' && (
                                            <label className="sm:col-span-2">
                                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    {secondary.label}
                                                </span>
                                                <select
                                                    value={draft.secondary}
                                                    onChange={event => setDraft(current => current
                                                        ? { ...current, secondary: event.target.value }
                                                        : current)}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                >
                                                    {['low', 'high', 'unable-to-assess'].map(option => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}

                                        {secondary && secondary.type !== 'condition-status' && secondary.type !== 'criticality' && (
                                            <label className="sm:col-span-2">
                                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    {secondary.label}
                                                </span>
                                                {secondary.type === 'textarea' ? (
                                                    <textarea
                                                        value={draft.secondary}
                                                        onChange={event => setDraft(current => current
                                                            ? { ...current, secondary: event.target.value }
                                                            : current)}
                                                        rows={4}
                                                        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                ) : (
                                                    <input
                                                        value={draft.secondary}
                                                        onChange={event => setDraft(current => current
                                                            ? { ...current, secondary: event.target.value }
                                                            : current)}
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                    />
                                                )}
                                            </label>
                                        )}

                                        {noteText(selected) !== '' || [
                                            'Condition',
                                            'AllergyIntolerance',
                                            'Medication',
                                            'Observation',
                                            'Specimen',
                                            'Procedure',
                                            'Immunization',
                                            'Appointment',
                                            'ClinicalTask',
                                            'CarePlan',
                                        ].includes(selected.resourceType) ? (
                                            <label className="sm:col-span-2">
                                                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    Review note
                                                </span>
                                                <textarea
                                                    value={draft.note}
                                                    onChange={event => setDraft(current => current
                                                        ? { ...current, note: event.target.value }
                                                        : current)}
                                                    rows={3}
                                                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                />
                                            </label>
                                        ) : null}
                                    </div>

                                    <label>
                                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Review reason or comment
                                        </span>
                                        <textarea
                                            value={reviewReason}
                                            onChange={event => setReviewReason(event.target.value)}
                                            rows={2}
                                            placeholder="Optional for confirmation; recommended when rejecting."
                                            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        />
                                    </label>

                                    {error && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={rejectSelected}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30"
                                    >
                                        <XCircleIcon className="h-4 w-4" />
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => {
                                            const saved = saveDraft();
                                            if (saved) setError(null);
                                        }}
                                        disabled={!isDirty}
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                    >
                                        Save edits
                                    </button>
                                </div>
                                <button
                                    onClick={confirmSelected}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/15 hover:bg-emerald-500"
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    Confirm fact
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

export default ClinicalCandidateReview;
