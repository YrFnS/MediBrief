import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    DrugsIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../../patient-management/usePatientStore';
import { validateLicensedSnomedInput } from '../licensedCoding';
import {
    buildTerminologyCoverage,
    collectTerminologySuggestions,
    isTerminologyReviewable,
    mergeCoding,
} from '../normalization';
import { TERMINOLOGY_SYSTEMS, TERMINOLOGY_URIS } from '../registry';
import { validateSourceRxNormInput } from '../sourceCoding';
import type {
    LicensedSnomedInput,
    SourceRxNormInput,
    TerminologySuggestion,
} from '../types';

const appendTag = (tags: string[] | undefined, tag: string): string[] =>
    [...new Set([...(tags || []), tag])];

const suggestionTitle = (suggestion: TerminologySuggestion): string => {
    if (suggestion.kind === 'code') {
        return `${suggestion.coding.display || suggestion.coding.code} (${suggestion.coding.code})`;
    }
    const quantity = suggestion.normalizedQuantity;
    return `${quantity.value} ${quantity.unit || quantity.code || ''}`.trim();
};

const CoverageCard: React.FC<{
    label: string;
    value: string;
    detail: string;
}> = ({ label, value, detail }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {label}
        </p>
        <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
            {value}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            {detail}
        </p>
    </div>
);

const TerminologySystemCard: React.FC<{
    systemId: keyof typeof TERMINOLOGY_SYSTEMS;
}> = ({ systemId }) => {
    const system = TERMINOLOGY_SYSTEMS[systemId];
    return (
        <details className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <summary className="cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-100">
                {system.name} · {system.lookupMode.replaceAll('-', ' ')}
            </summary>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                {system.description}
            </p>
            <p className="mt-2 border-l-2 border-amber-300 pl-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-800 dark:text-amber-200">
                {system.boundary}
            </p>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-400">
                {system.licenseNotice}
            </p>
        </details>
    );
};

const TerminologyCenter: React.FC = () => {
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[state.activePatientId],
    );
    const record = useClinicalRecordStore(
        state => state.records[activePatientId],
    );
    const clinicalActions = useClinicalRecordStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);

    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [rxMedicationId, setRxMedicationId] = useState('');
    const [rxCui, setRxCui] = useState('');
    const [rxDisplay, setRxDisplay] = useState('');
    const [rxSource, setRxSource] = useState('');
    const [rxReviewed, setRxReviewed] = useState(false);

    const [snomedTarget, setSnomedTarget] = useState('');
    const [snomedCode, setSnomedCode] = useState('');
    const [snomedDisplay, setSnomedDisplay] = useState('');
    const [snomedVersion, setSnomedVersion] = useState('');
    const [snomedAcknowledged, setSnomedAcknowledged] = useState(false);

    const suggestions = useMemo(
        () => record ? collectTerminologySuggestions(record) : [],
        [record],
    );
    const coverage = useMemo(
        () => record ? buildTerminologyCoverage(record) : null,
        [record],
    );
    const medications = useMemo(
        () => record?.resources.medications.filter(medication =>
            isTerminologyReviewable(medication)
            && !medication.medication.coding?.some(coding =>
                coding.system === TERMINOLOGY_URIS.rxnorm)) || [],
        [record],
    );
    const snomedResources = useMemo(() => {
        if (!record) return [];
        return [
            ...record.resources.conditions
                .filter(isTerminologyReviewable)
                .map(resource => ({
                type: 'Condition' as const,
                id: resource.id,
                label: resource.code.text,
            })),
            ...record.resources.allergies
                .filter(isTerminologyReviewable)
                .map(resource => ({
                type: 'AllergyIntolerance' as const,
                id: resource.id,
                label: resource.substance.text,
            })),
            ...record.resources.procedures
                .filter(isTerminologyReviewable)
                .map(resource => ({
                type: 'Procedure' as const,
                id: resource.id,
                label: resource.code.text,
            })),
        ];
    }, [record]);

    const auditMapping = (
        details: string,
        metadata: Record<string, unknown>,
    ) => auditActions.logEvent(
        'TERMINOLOGY_MAPPING_REVIEWED',
        activePatientId,
        details,
        'USER',
        metadata,
    );

    const applySuggestion = (suggestion: TerminologySuggestion) => {
        if (!record || suggestion.resourceType !== 'Observation') return;
        const observation = record.resources.observations.find(item =>
            item.id === suggestion.resourceId);
        if (!observation || !isTerminologyReviewable(observation)) {
            setError('The observation is no longer available for terminology review.');
            return;
        }

        let result: { ok: boolean; message?: string };
        if (suggestion.kind === 'code') {
            result = clinicalActions.amendResource(
                activePatientId,
                'Observation',
                observation.id,
                {
                    code: mergeCoding(observation.code, suggestion.coding),
                    tags: appendTag(observation.tags, 'terminology-reviewed'),
                },
                {
                    reason:
                        'Human-reviewed LOINC mapping applied in the MediBrief terminology center. Original source text was preserved.',
                },
            );
        } else {
            if (observation.value?.type !== 'quantity') {
                setError('The observation no longer contains a quantity value.');
                return;
            }
            result = clinicalActions.amendResource(
                activePatientId,
                'Observation',
                observation.id,
                {
                    value: {
                        type: 'quantity',
                        quantity: {
                            ...observation.value.quantity,
                            normalized: suggestion.normalizedQuantity,
                            normalizationWarning: suggestion.warnings.join(' '),
                        },
                    },
                    tags: appendTag(observation.tags, 'terminology-reviewed'),
                },
                {
                    reason:
                        'Human-reviewed UCUM mapping applied in the MediBrief terminology center. Original value and unit were preserved.',
                },
            );
        }

        if (!result.ok) {
            setError(result.message || 'The terminology mapping could not be applied.');
            return;
        }
        setError(null);
        setStatus(`${suggestion.system.toUpperCase()} mapping applied after review.`);
        auditMapping(
            `Applied a reviewed ${suggestion.system.toUpperCase()} terminology mapping.`,
            {
                resourceType: suggestion.resourceType,
                resourceId: suggestion.resourceId,
                target: suggestion.target,
                method: suggestion.method,
                sourceText: suggestion.sourceText,
                mapping: suggestion.kind === 'code'
                    ? suggestion.coding
                    : suggestion.normalizedQuantity,
                conversionApplied: suggestion.kind === 'quantity'
                    ? suggestion.conversionApplied
                    : false,
            },
        );
    };

    const applySourceRxNorm = () => {
        if (!record || !rxMedicationId) {
            setError('Select a local medication record first.');
            return;
        }
        const input: SourceRxNormInput = {
            medicationId: rxMedicationId,
            rxcui: rxCui,
            display: rxDisplay,
            sourceDescription: rxSource,
            sourceReviewed: rxReviewed,
        };
        const validation = validateSourceRxNormInput(input);
        if (!validation.valid || !validation.coding) {
            setError(validation.errors.join(' '));
            return;
        }
        const medication = record.resources.medications.find(item =>
            item.id === rxMedicationId);
        if (!medication || !isTerminologyReviewable(medication)) {
            setError('The selected medication is no longer available for terminology review.');
            return;
        }
        const result = clinicalActions.amendResource(
            activePatientId,
            'Medication',
            medication.id,
            {
                medication: mergeCoding(medication.medication, validation.coding),
                tags: appendTag(medication.tags, 'terminology-reviewed'),
            },
            {
                reason:
                    `User supplied a reviewed RxNorm identifier from: ${rxSource.trim()}. MediBrief did not search for or independently verify the concept.`,
            },
        );
        if (!result.ok) {
            setError(result.message || 'The source-provided medication coding could not be applied.');
            return;
        }
        setError(null);
        setStatus('Source-provided medication coding applied after review.');
        auditMapping('Applied a source-provided RxNorm medication coding.', {
            resourceType: 'Medication',
            resourceId: medication.id,
            sourceText: medication.medication.text,
            rxcui: validation.coding.code,
            display: validation.coding.display,
            sourceDescription: rxSource.trim(),
            terminologyConceptVerifiedByMediBrief: false,
        });
        setRxMedicationId('');
        setRxCui('');
        setRxDisplay('');
        setRxSource('');
        setRxReviewed(false);
    };

    const applyLicensedSnomed = () => {
        if (!record || !snomedTarget) {
            setError('Select a local condition, allergy, or procedure first.');
            return;
        }
        const [rawResourceType, resourceId] = snomedTarget.split(':');
        const allowedResourceTypes: LicensedSnomedInput['resourceType'][] = [
            'Condition',
            'AllergyIntolerance',
            'Procedure',
        ];
        if (!allowedResourceTypes.includes(
            rawResourceType as LicensedSnomedInput['resourceType'],
        ) || !resourceId) {
            setError('The selected terminology target is invalid.');
            return;
        }
        const resourceType = rawResourceType as LicensedSnomedInput['resourceType'];
        const validation = validateLicensedSnomedInput({
            resourceType,
            resourceId,
            code: snomedCode,
            display: snomedDisplay,
            versionUri: snomedVersion,
            licenseAcknowledged: snomedAcknowledged,
        });
        if (!validation.valid || !validation.coding) {
            setError(validation.errors.join(' '));
            return;
        }

        const amendment = {
            reason:
                'User supplied a SNOMED CT coding from an acknowledged external licensed source. MediBrief did not verify terminology content or licensing.',
        };
        let result: { ok: boolean; message?: string };
        if (resourceType === 'Condition') {
            const resource = record.resources.conditions.find(item =>
                item.id === resourceId);
            if (!resource || !isTerminologyReviewable(resource)) {
                setError('The selected condition is unavailable for terminology review.');
                return;
            }
            result = clinicalActions.amendResource(
                activePatientId,
                'Condition',
                resourceId,
                {
                    code: mergeCoding(resource.code, validation.coding),
                    tags: appendTag(resource.tags, 'terminology-reviewed'),
                },
                amendment,
            );
        } else if (resourceType === 'AllergyIntolerance') {
            const resource = record.resources.allergies.find(item =>
                item.id === resourceId);
            if (!resource || !isTerminologyReviewable(resource)) {
                setError('The selected allergy is unavailable for terminology review.');
                return;
            }
            result = clinicalActions.amendResource(
                activePatientId,
                'AllergyIntolerance',
                resourceId,
                {
                    substance: mergeCoding(resource.substance, validation.coding),
                    tags: appendTag(resource.tags, 'terminology-reviewed'),
                },
                amendment,
            );
        } else {
            const resource = record.resources.procedures.find(item =>
                item.id === resourceId);
            if (!resource || !isTerminologyReviewable(resource)) {
                setError('The selected procedure is unavailable for terminology review.');
                return;
            }
            result = clinicalActions.amendResource(
                activePatientId,
                'Procedure',
                resourceId,
                {
                    code: mergeCoding(resource.code, validation.coding),
                    tags: appendTag(resource.tags, 'terminology-reviewed'),
                },
                amendment,
            );
        }

        if (!result.ok) {
            setError(result.message || 'The SNOMED CT coding could not be applied.');
            return;
        }
        setError(null);
        setStatus('Externally licensed SNOMED CT coding applied after review.');
        auditMapping('Applied a user-supplied SNOMED CT coding.', {
            resourceType,
            resourceId,
            code: validation.coding.code,
            display: validation.coding.display,
            version: validation.coding.version,
            source: 'external-licensed',
            terminologyContentVerifiedByMediBrief: false,
            deploymentLicenseVerifiedByMediBrief: false,
        });
        setSnomedTarget('');
        setSnomedCode('');
        setSnomedDisplay('');
        setSnomedVersion('');
        setSnomedAcknowledged(false);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="fixed left-3 top-32 z-[55] inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-xl backdrop-blur-md transition-colors hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:text-teal-300"
                aria-label="Open terminology review center"
            >
                <ShieldCheckIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Terminology</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="terminology-center-title"
                        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-teal-600 p-2 text-white">
                                    <ShieldCheckIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2
                                        id="terminology-center-title"
                                        className="font-display text-lg font-bold text-slate-950 dark:text-white"
                                    >
                                        Terminology review center
                                    </h2>
                                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                        Review exact LOINC and UCUM candidates, attach a medication identifier from a reviewed source, or attach a SNOMED CT code from a licensed external source. No coding is applied automatically.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                                aria-label="Close terminology review center"
                            >
                                <XCircleIcon className="h-6 w-6" />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 md:p-6">
                            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs leading-relaxed text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-100">
                                <strong>Selected local patient:</strong>{' '}
                                {activePatient?.name || activePatientId}. Terminology mappings amend the selected local record and preserve original source text and values in amendment history.
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

                            {!record || !coverage ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    Initialize the selected patient’s structured record before reviewing terminology mappings.
                                </div>
                            ) : (
                                <>
                                    <section>
                                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                            Current coding coverage
                                        </h3>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <CoverageCard
                                                label="LOINC observations"
                                                value={`${coverage.observationsWithLoinc}/${coverage.observations}`}
                                                detail={`${coverage.unresolvedObservationCodes} observation label${coverage.unresolvedObservationCodes === 1 ? '' : 's'} remain outside the reviewed exact-alias subset.`}
                                            />
                                            <CoverageCard
                                                label="UCUM quantities"
                                                value={`${coverage.quantitiesWithUcum}/${coverage.quantityObservations}`}
                                                detail={`${coverage.unrecognizedQuantityUnits} source unit${coverage.unrecognizedQuantityUnits === 1 ? '' : 's'} are not recognized and remain unchanged.`}
                                            />
                                            <CoverageCard
                                                label="Medication identifiers"
                                                value={`${coverage.medicationsWithRxNorm}/${coverage.medications}`}
                                                detail="Identifiers are accepted only from a stated reviewed source; MediBrief does not search for or select them."
                                            />
                                            <CoverageCard
                                                label="SNOMED CT resources"
                                                value={`${coverage.resourcesWithSnomedCt}/${coverage.conditionAllergyProcedureResources}`}
                                                detail="SNOMED CT content is not bundled; only externally licensed codes may be attached."
                                            />
                                        </div>
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                                    Deterministic LOINC and UCUM candidates
                                                </h3>
                                                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                                    Candidates require exact reviewed aliases. Generic labels and unknown units are refused rather than guessed.
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                                                {suggestions.length} pending
                                            </span>
                                        </div>
                                        {suggestions.length === 0 ? (
                                            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                                No reviewed exact-match terminology candidates are available for the selected record.
                                            </p>
                                        ) : (
                                            <div className="mt-4 space-y-3">
                                                {suggestions.map(suggestion => (
                                                    <article
                                                        key={suggestion.id}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"
                                                    >
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div>
                                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                                    {suggestion.system.toUpperCase()} · {suggestion.target}
                                                                </p>
                                                                <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
                                                                    {suggestionTitle(suggestion)}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                                                    Source: “{suggestion.sourceText}”
                                                                </p>
                                                                <p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                                                    {suggestion.rationale}
                                                                </p>
                                                                <ul className="mt-2 space-y-1 text-[10px] text-amber-700 dark:text-amber-200">
                                                                    {suggestion.warnings.map(warning => (
                                                                        <li key={warning}>• {warning}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => applySuggestion(suggestion)}
                                                                className="min-h-11 flex-shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-teal-500"
                                                            >
                                                                Apply reviewed mapping
                                                            </button>
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="flex items-start gap-3">
                                            <DrugsIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                                    Attach a source-provided medication identifier
                                                </h3>
                                                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                                    MediBrief does not search for medication concepts. Enter an RxCUI and display only when they already appear in a reviewed clinical source, imported record, or separately governed terminology workflow.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Local medication record
                                                <select
                                                    value={rxMedicationId}
                                                    onChange={event => setRxMedicationId(event.target.value)}
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                >
                                                    <option value="">Select medication</option>
                                                    {medications.map(medication => (
                                                        <option key={medication.id} value={medication.id}>
                                                            {medication.medication.text}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                RxCUI from reviewed source
                                                <input
                                                    value={rxCui}
                                                    onChange={event => setRxCui(event.target.value)}
                                                    inputMode="numeric"
                                                    placeholder="Numeric identifier"
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                />
                                            </label>
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Display term from reviewed source
                                                <input
                                                    value={rxDisplay}
                                                    onChange={event => setRxDisplay(event.target.value)}
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                />
                                            </label>
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Source description
                                                <input
                                                    value={rxSource}
                                                    onChange={event => setRxSource(event.target.value)}
                                                    placeholder="Imported record, pharmacy list, terminology review…"
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                />
                                            </label>
                                        </div>
                                        <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={rxReviewed}
                                                onChange={event => setRxReviewed(event.target.checked)}
                                                className="mt-0.5 h-4 w-4"
                                            />
                                            I reviewed the identifier and display against the stated source. I understand that MediBrief does not verify the concept or the clinical appropriateness of the medication.
                                        </label>
                                        <button
                                            type="button"
                                            onClick={applySourceRxNorm}
                                            className="mt-4 min-h-11 rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-blue-500"
                                        >
                                            Apply source-provided coding
                                        </button>
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                            Attach externally licensed SNOMED CT coding
                                        </h3>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                            MediBrief does not include a SNOMED CT browser or code set. This form only records a code and display supplied from a separately licensed source.
                                        </p>
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Local resource
                                                <select
                                                    value={snomedTarget}
                                                    onChange={event => setSnomedTarget(event.target.value)}
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                >
                                                    <option value="">Select resource</option>
                                                    {snomedResources.map(resource => (
                                                        <option
                                                            key={`${resource.type}:${resource.id}`}
                                                            value={`${resource.type}:${resource.id}`}
                                                        >
                                                            {resource.type}: {resource.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Concept identifier
                                                <input
                                                    value={snomedCode}
                                                    onChange={event => setSnomedCode(event.target.value)}
                                                    inputMode="numeric"
                                                    placeholder="Numeric SNOMED CT identifier"
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                />
                                            </label>
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Display term from licensed source
                                                <input
                                                    value={snomedDisplay}
                                                    onChange={event => setSnomedDisplay(event.target.value)}
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                />
                                            </label>
                                            <label className="text-xs text-slate-600 dark:text-slate-300">
                                                Edition/version URI
                                                <input
                                                    value={snomedVersion}
                                                    onChange={event => setSnomedVersion(event.target.value)}
                                                    placeholder="http://snomed.info/sct/{module}/version/{YYYYMMDD}"
                                                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                                />
                                            </label>
                                        </div>
                                        <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={snomedAcknowledged}
                                                onChange={event => setSnomedAcknowledged(event.target.checked)}
                                                className="mt-0.5 h-4 w-4"
                                            />
                                            I confirm that this code and display came from a SNOMED CT source licensed for this deployment. I understand that MediBrief does not verify the code, clinical meaning, edition, or license.
                                        </label>
                                        <button
                                            type="button"
                                            onClick={applyLicensedSnomed}
                                            className="mt-4 min-h-11 rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                        >
                                            Apply licensed external coding
                                        </button>
                                    </section>

                                    <section>
                                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                                            Registry and licensing boundaries
                                        </h3>
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                            <TerminologySystemCard systemId="loinc" />
                                            <TerminologySystemCard systemId="ucum" />
                                            <TerminologySystemCard systemId="rxnorm" />
                                            <TerminologySystemCard systemId="snomed-ct" />
                                        </div>
                                    </section>
                                </>
                            )}

                            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                                    <div>
                                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                                            Terminology is not clinical validation
                                        </h3>
                                        <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                                            A code improves semantic interoperability only when it represents the source correctly. It does not prove diagnosis, allergy status, medication appropriateness, result accuracy, patient identity, source authenticity, or record completeness. Every mapping remains a human-reviewed amendment with preserved source truth.
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

export default TerminologyCenter;
