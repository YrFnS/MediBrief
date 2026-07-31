import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    RecordIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    PatientClinicalResource,
    SourceDocumentReference,
} from '../../clinical-record';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import {
    MANAGED_MANUAL_RESOURCE_OPTIONS,
    buildManualClinicalAmendment,
    buildManualClinicalResource,
    createInitialManualFormValues,
    getManualFieldDefinitions,
    isManagedManualResourceType,
    listManagedResourceSummaries,
    manualFormValuesFromResource,
    type ManagedManualResourceType,
    type ManualFieldDefinition,
    type ManualFormValue,
    type ManualFormValues,
    type ManualRecordIssue,
} from '../manualRecordManagement';
import {
    EmptyModuleState,
    MetricGrid,
    ModuleHeader,
    ModuleSearch,
    ModuleSelect,
    ProvenancePanel,
    ScopeTabs,
    StatusBadge,
} from './CoreModulePrimitives';
import { buildResourceProvenanceView } from '../coreModuleViewModels';

interface RecordManagementModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

type ManagementTab = 'create' | 'correct' | 'history';
type HistoryStatusFilter =
    | 'all'
    | 'candidate'
    | 'confirmed'
    | 'rejected'
    | 'entered-in-error';

const actorName = 'Local user';

const issueFor = (
    issues: ManualRecordIssue[],
    field: string,
): string[] => issues
    .filter(item => item.field === field || item.field.startsWith(`${field}.`))
    .map(item => item.message);

const ManualFields: React.FC<{
    definitions: ManualFieldDefinition[];
    values: ManualFormValues;
    issues: ManualRecordIssue[];
    onChange: (key: string, value: ManualFormValue) => void;
}> = ({ definitions, values, issues, onChange }) => (
    <div className="grid gap-4 md:grid-cols-2">
        {definitions.map(field => {
            const messages = issueFor(issues, field.key);
            const value = values[field.key]
                ?? (field.type === 'checkbox' ? false : '');
            const baseClass = `w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100 ${messages.length > 0
                ? 'border-red-400 focus:border-red-500 dark:border-red-700'
                : 'border-slate-200 focus:border-blue-400 dark:border-slate-700'
            }`;
            const preserved = field.key === 'preservedSections';

            return (
                <label
                    key={field.key}
                    className={`${field.wide ? 'md:col-span-2' : ''} ${field.type === 'checkbox' ? 'flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60' : 'block'}`}
                >
                    {field.type === 'checkbox' ? (
                        <>
                            <input
                                type="checkbox"
                                checked={value === true}
                                onChange={event => onChange(field.key, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="min-w-0">
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                                    {field.label}
                                </span>
                                {field.helper && (
                                    <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                        {field.helper}
                                    </span>
                                )}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="mb-1.5 block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {field.label}{field.required ? ' *' : ''}
                            </span>
                            {field.type === 'textarea' ? (
                                <textarea
                                    value={String(value)}
                                    onChange={event => onChange(field.key, event.target.value)}
                                    placeholder={field.placeholder}
                                    readOnly={preserved}
                                    rows={preserved ? 8 : 4}
                                    className={`${baseClass} resize-y ${preserved ? 'cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400' : ''}`}
                                />
                            ) : field.type === 'select' ? (
                                <select
                                    value={String(value)}
                                    onChange={event => onChange(field.key, event.target.value)}
                                    className={baseClass}
                                >
                                    {(field.options || []).map(item => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={field.type}
                                    value={String(value)}
                                    onChange={event => onChange(field.key, event.target.value)}
                                    placeholder={field.placeholder}
                                    className={baseClass}
                                />
                            )}
                            {field.helper && (
                                <span className="mt-1.5 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    {field.helper}
                                </span>
                            )}
                            {messages.map(message => (
                                <span
                                    key={message}
                                    className="mt-1 block text-[10px] font-semibold text-red-600 dark:text-red-300"
                                >
                                    {message}
                                </span>
                            ))}
                        </>
                    )}
                </label>
            );
        })}
    </div>
);

const FeedbackBanner: React.FC<{
    tone: 'success' | 'error';
    message: string;
}> = ({ tone, message }) => (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
        : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
    }`}>
        {message}
    </div>
);

const AmendmentHistory: React.FC<{
    resource: PatientClinicalResource;
}> = ({ resource }) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Amendment history
        </h3>
        {resource.amendments.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                No correction has been recorded. The original value remains the current version.
            </p>
        ) : (
            <div className="mt-3 space-y-2">
                {[...resource.amendments].reverse().map(amendment => (
                    <details
                        key={amendment.id}
                        className="group rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60"
                    >
                        <summary className="flex cursor-pointer list-none items-start gap-3 p-3">
                            <ChevronRightIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                                    {amendment.reason || 'Clinical record amended'}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                                    {new Date(amendment.amendedAt).toLocaleString()} · {amendment.amendedBy || 'Actor not recorded'}
                                </span>
                            </span>
                        </summary>
                        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
                            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
                                Changed fields
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {amendment.changedFields.map(field => (
                                    <span
                                        key={field}
                                        className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300"
                                    >
                                        {field}
                                    </span>
                                ))}
                            </div>
                            {amendment.previousValues && (
                                <>
                                    <p className="mt-3 text-[10px] font-mono uppercase tracking-wide text-slate-400">
                                        Previous values retained
                                    </p>
                                    <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-200">
                                        {JSON.stringify(amendment.previousValues, null, 2)}
                                    </pre>
                                </>
                            )}
                        </div>
                    </details>
                ))}
            </div>
        )}
    </section>
);

const RecordManagementModule: React.FC<RecordManagementModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const clinicalActions = useClinicalRecordStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    const [tab, setTab] = useState<ManagementTab>('create');
    const [createType, setCreateType] = useState<ManagedManualResourceType>('Condition');
    const [createValues, setCreateValues] = useState<ManualFormValues>(() =>
        createInitialManualFormValues('Condition', record, 'create'));
    const [createIssues, setCreateIssues] = useState<ManualRecordIssue[]>([]);
    const [createFeedback, setCreateFeedback] = useState<{
        tone: 'success' | 'error';
        message: string;
    } | null>(null);

    const [recordSearch, setRecordSearch] = useState('');
    const [recordTypeFilter, setRecordTypeFilter] = useState('all');
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
    const [amendValues, setAmendValues] = useState<ManualFormValues>({});
    const [amendReason, setAmendReason] = useState('');
    const [amendIssues, setAmendIssues] = useState<ManualRecordIssue[]>([]);
    const [amendFeedback, setAmendFeedback] = useState<{
        tone: 'success' | 'error';
        message: string;
    } | null>(null);
    const [errorReason, setErrorReason] = useState('');
    const [errorConfirmed, setErrorConfirmed] = useState(false);

    const [historySearch, setHistorySearch] = useState('');
    const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>('all');
    const [historyType, setHistoryType] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);

    const allSummaries = useMemo(
        () => listManagedResourceSummaries(record, true),
        [record],
    );
    const editableSummaries = useMemo(() => allSummaries.filter(item =>
        item.resource.resourceType !== 'PatientProfile'
        && item.resource.verificationStatus === 'confirmed'
        && isManagedManualResourceType(item.resource.resourceType)
        && (recordTypeFilter === 'all' || item.resourceType === recordTypeFilter)
        && (!recordSearch.trim() || item.searchText.includes(recordSearch.trim().toLowerCase()))
    ), [allSummaries, recordSearch, recordTypeFilter]);
    const selectedSummary = allSummaries.find(item =>
        item.id === selectedResourceId
        && item.resource.resourceType !== 'PatientProfile');
    const selectedResource = selectedSummary?.resource.resourceType !== 'PatientProfile'
        ? selectedSummary?.resource as PatientClinicalResource | undefined
        : undefined;

    const historySummaries = useMemo(() => allSummaries.filter(item =>
        (historyStatus === 'all' || item.verificationStatus === historyStatus)
        && (historyType === 'all' || item.resourceType === historyType)
        && (!historySearch.trim() || item.searchText.includes(historySearch.trim().toLowerCase()))
    ), [allSummaries, historySearch, historyStatus, historyType]);

    const candidateCount = allSummaries.filter(item =>
        item.verificationStatus === 'candidate').length;
    const enteredErrorCount = allSummaries.filter(item =>
        item.verificationStatus === 'entered-in-error').length;
    const amendedCount = allSummaries.filter(item =>
        item.amendmentCount > 0).length;

    useEffect(() => {
        setCreateValues(createInitialManualFormValues(createType, record, 'create'));
        setCreateIssues([]);
        setCreateFeedback(null);
    }, [createType, record.patientId]);

    useEffect(() => {
        if (
            selectedResource
            && isManagedManualResourceType(selectedResource.resourceType)
            && selectedResource.verificationStatus === 'confirmed'
        ) {
            setAmendValues(manualFormValuesFromResource(selectedResource));
            setAmendReason('');
            setErrorReason('');
            setErrorConfirmed(false);
            setAmendIssues([]);
            setAmendFeedback(null);
        } else if (selectedResourceId) {
            setSelectedResourceId(null);
        }
    }, [selectedResource?.id, selectedResource?.provenance.updatedAt, selectedResource?.verificationStatus]);

    const handleCreate = (): void => {
        const built = buildManualClinicalResource({
            record,
            resourceType: createType,
            values: createValues,
            actor: actorName,
        });
        if (!built.ok || !built.resource) {
            setCreateIssues(built.issues);
            setCreateFeedback({
                tone: 'error',
                message: 'The record was not saved. Review the highlighted clinical and relationship fields.',
            });
            return;
        }

        const write = clinicalActions.addResource(built.resource);
        if (!write.ok) {
            setCreateIssues([{ field: 'record', message: write.message || 'The record could not be saved.' }]);
            setCreateFeedback({ tone: 'error', message: write.message || 'The record could not be saved.' });
            return;
        }

        auditActions.logEvent(
            'CLINICAL_RESOURCE_CREATED',
            record.patientId,
            `Created confirmed ${built.resource.resourceType} record ${built.resource.id} through guided manual entry.`,
            'USER',
            {
                resourceId: built.resource.id,
                resourceType: built.resource.resourceType,
                source: 'record-management',
            },
        );
        setCreateIssues([]);
        setCreateValues(createInitialManualFormValues(createType, record, 'create'));
        setCreateFeedback({
            tone: 'success',
            message: 'The manual record was validated, confirmed, and saved with user provenance.',
        });
    };

    const handleAmend = (): void => {
        if (!selectedResource || !isManagedManualResourceType(selectedResource.resourceType)) return;
        if (!amendReason.trim()) {
            setAmendIssues([{ field: 'amendmentReason', message: 'A correction reason is required.' }]);
            setAmendFeedback({ tone: 'error', message: 'Explain why this confirmed record is being corrected.' });
            return;
        }

        const built = buildManualClinicalAmendment({
            record,
            resource: selectedResource,
            values: amendValues,
        });
        if (!built.ok || !built.updates) {
            setAmendIssues(built.issues);
            setAmendFeedback({
                tone: 'error',
                message: 'The correction was not saved. Review the highlighted fields and relationships.',
            });
            return;
        }

        const amend = clinicalActions.amendResource as unknown as (
            patientId: string,
            resourceType: PatientClinicalResource['resourceType'],
            resourceId: string,
            updates: Record<string, unknown>,
            amendment: { reason: string; amendedBy: string },
        ) => { ok: boolean; status: string; message?: string };
        const write = amend(
            record.patientId,
            selectedResource.resourceType,
            selectedResource.id,
            built.updates,
            { reason: amendReason.trim(), amendedBy: actorName },
        );
        if (!write.ok) {
            setAmendIssues([{ field: 'record', message: write.message || 'The correction could not be saved.' }]);
            setAmendFeedback({ tone: 'error', message: write.message || 'The correction could not be saved.' });
            return;
        }

        auditActions.logEvent(
            'CLINICAL_RESOURCE_AMENDED',
            record.patientId,
            `Amended confirmed ${selectedResource.resourceType} record ${selectedResource.id}.`,
            'USER',
            {
                resourceId: selectedResource.id,
                resourceType: selectedResource.resourceType,
                reason: amendReason.trim(),
            },
        );
        setAmendIssues([]);
        setAmendReason('');
        setAmendFeedback({
            tone: 'success',
            message: write.status === 'unchanged'
                ? 'No clinical values changed; the record remains unchanged.'
                : 'The correction was saved. Prior values and the reason remain in amendment history.',
        });
    };

    const handleEnteredInError = (): void => {
        if (!selectedResource) return;
        if (!errorReason.trim() || !errorConfirmed) {
            setAmendFeedback({
                tone: 'error',
                message: 'A reason and explicit acknowledgement are required before marking a record entered in error.',
            });
            return;
        }

        const mark = clinicalActions.markResourceEnteredInError as unknown as (
            patientId: string,
            resourceType: PatientClinicalResource['resourceType'],
            resourceId: string,
            amendment: { reason: string; amendedBy: string },
        ) => { ok: boolean; message?: string };
        const write = mark(
            record.patientId,
            selectedResource.resourceType,
            selectedResource.id,
            { reason: errorReason.trim(), amendedBy: actorName },
        );
        if (!write.ok) {
            setAmendFeedback({ tone: 'error', message: write.message || 'The record could not be marked entered in error.' });
            return;
        }

        auditActions.logEvent(
            'CLINICAL_RESOURCE_MARKED_ERROR',
            record.patientId,
            `Marked ${selectedResource.resourceType} record ${selectedResource.id} entered in error.`,
            'USER',
            {
                resourceId: selectedResource.id,
                resourceType: selectedResource.resourceType,
                reason: errorReason.trim(),
            },
        );
        setSelectedResourceId(null);
        setAmendFeedback(null);
        setErrorReason('');
        setErrorConfirmed(false);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Controlled record changes"
                    title="Record management"
                    description="Add validated manual records, correct confirmed records without erasing history, mark incorrect entries entered in error, and inspect every retained amendment."
                    candidateCount={candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        { label: 'Record resources', value: Math.max(0, allSummaries.length - 1) },
                        { label: 'With amendments', value: amendedCount },
                        { label: 'Entered in error', value: enteredErrorCount, emphasis: enteredErrorCount > 0 ? 'warning' : 'default' },
                        { label: 'Pending review', value: candidateCount, emphasis: candidateCount > 0 ? 'warning' : 'default' },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/25">
                    <div className="flex items-start gap-3">
                        <ShieldCheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
                        <div>
                            <h2 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                                History-preserving workflow
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                                Manual entries are saved as confirmed user-entered facts only after schema and relationship validation. Corrections require a reason and retain previous values. Reviewed records are never hard-deleted; incorrect records remain visible as entered-in-error history.
                            </p>
                        </div>
                    </div>
                </section>

                <ScopeTabs
                    value={tab}
                    onChange={value => setTab(value as ManagementTab)}
                    options={[
                        { value: 'create', label: 'Add record' },
                        { value: 'correct', label: 'Correct / invalidate' },
                        { value: 'history', label: 'History' },
                    ]}
                />

                {tab === 'create' && (
                    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                            <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Record type
                            </p>
                            <div className="mt-2 space-y-1">
                                {MANAGED_MANUAL_RESOURCE_OPTIONS.map(item => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => setCreateType(item.value)}
                                        className={`w-full rounded-xl border p-3 text-left transition-colors ${createType === item.value
                                            ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-900'
                                        }`}
                                    >
                                        <span className="block text-xs font-bold text-slate-900 dark:text-white">
                                            {item.label}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                            {item.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 text-[10px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Documents are added through the existing file-upload workflow so their local binary asset, storage ID, MIME type, and provenance remain connected.
                            </div>
                        </aside>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                        Guided manual entry
                                    </p>
                                    <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                                        {MANAGED_MANUAL_RESOURCE_OPTIONS.find(item => item.value === createType)?.label}
                                    </h2>
                                </div>
                                <StatusBadge tone="info">Confirmed user entry</StatusBadge>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                Required fields are marked with an asterisk. Leave unknown clinical dates blank; MediBrief records them as unknown instead of inserting today’s date.
                            </p>

                            {createFeedback && (
                                <div className="mt-4">
                                    <FeedbackBanner {...createFeedback} />
                                </div>
                            )}
                            {createIssues.some(item => item.field === 'record') && (
                                <div className="mt-3 space-y-1">
                                    {issueFor(createIssues, 'record').map(message => (
                                        <p key={message} className="text-xs font-semibold text-red-600 dark:text-red-300">
                                            {message}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="mt-5">
                                <ManualFields
                                    definitions={getManualFieldDefinitions(createType, record, 'create')}
                                    values={createValues}
                                    issues={createIssues}
                                    onChange={(key, value) => {
                                        setCreateValues(current => ({ ...current, [key]: value }));
                                        setCreateIssues(current => current.filter(item => item.field !== key));
                                        setCreateFeedback(null);
                                    }}
                                />
                            </div>
                            <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    Saving creates a new confirmed resource with manual-entry provenance. It does not modify an existing record.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                                >
                                    <RecordIcon className="h-4 w-4" />
                                    Validate and save
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {tab === 'correct' && (
                    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                        <aside className="min-h-[520px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                            <div className="space-y-3">
                                <ModuleSearch
                                    value={recordSearch}
                                    onChange={setRecordSearch}
                                    placeholder="Search confirmed records"
                                />
                                <ModuleSelect
                                    label="Resource type"
                                    value={recordTypeFilter}
                                    onChange={setRecordTypeFilter}
                                    options={[
                                        { value: 'all', label: 'All editable types' },
                                        ...MANAGED_MANUAL_RESOURCE_OPTIONS.map(item => ({ value: item.value, label: item.label })),
                                    ]}
                                />
                            </div>
                            <div className="mt-3 max-h-[680px] space-y-2 overflow-y-auto pr-1">
                                {editableSummaries.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                        No confirmed editable record matches these filters.
                                    </p>
                                ) : editableSummaries.map(item => (
                                    <button
                                        key={`${item.resourceType}-${item.id}`}
                                        type="button"
                                        onClick={() => setSelectedResourceId(item.id)}
                                        className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedResourceId === item.id
                                            ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                                            : 'border-slate-200 hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-900'
                                        }`}
                                    >
                                        <span className="flex items-start justify-between gap-2">
                                            <span className="min-w-0">
                                                <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">
                                                    {item.label}
                                                </span>
                                                <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-wide text-slate-400">
                                                    {item.resourceType} · {item.statusLabel}
                                                </span>
                                            </span>
                                            {item.amendmentCount > 0 && (
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                    {item.amendmentCount} edit{item.amendmentCount === 1 ? '' : 's'}
                                                </span>
                                            )}
                                        </span>
                                        <span className="mt-2 block text-[10px] text-slate-500 dark:text-slate-400">
                                            {item.clinicalDateLabel}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </aside>

                        {!selectedResource || !isManagedManualResourceType(selectedResource.resourceType) ? (
                            <EmptyModuleState
                                title="Select a confirmed record"
                                description="Choose a record to make a validated correction, inspect prior values, or mark the record entered in error."
                                caution="Candidates must be edited and reviewed in the candidate queue. Rejected and entered-in-error resources remain protected history."
                            />
                        ) : (
                            <div className="space-y-4">
                                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                                Correct confirmed {selectedResource.resourceType}
                                            </p>
                                            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                                                {selectedSummary?.label}
                                            </h2>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Record ID: {selectedResource.id}
                                            </p>
                                        </div>
                                        <StatusBadge tone="positive">Confirmed</StatusBadge>
                                    </div>

                                    {amendFeedback && (
                                        <div className="mt-4">
                                            <FeedbackBanner {...amendFeedback} />
                                        </div>
                                    )}

                                    <div className="mt-5">
                                        <ManualFields
                                            definitions={getManualFieldDefinitions(selectedResource.resourceType, record, 'amend')}
                                            values={amendValues}
                                            issues={amendIssues}
                                            onChange={(key, value) => {
                                                setAmendValues(current => ({ ...current, [key]: value }));
                                                setAmendIssues(current => current.filter(item => item.field !== key));
                                                setAmendFeedback(null);
                                            }}
                                        />
                                    </div>

                                    <label className="mt-5 block rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                                        <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                                            Correction reason *
                                        </span>
                                        <textarea
                                            value={amendReason}
                                            onChange={event => {
                                                setAmendReason(event.target.value);
                                                setAmendIssues(current => current.filter(item => item.field !== 'amendmentReason'));
                                            }}
                                            rows={3}
                                            placeholder="Explain why the confirmed record needs correction."
                                            className={`mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none dark:bg-slate-950 ${issueFor(amendIssues, 'amendmentReason').length > 0
                                                ? 'border-red-400 dark:border-red-700'
                                                : 'border-amber-300 focus:border-amber-500 dark:border-amber-800'
                                            }`}
                                        />
                                        {issueFor(amendIssues, 'amendmentReason').map(message => (
                                            <span key={message} className="mt-1 block text-[10px] font-semibold text-red-600 dark:text-red-300">
                                                {message}
                                            </span>
                                        ))}
                                    </label>

                                    <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                            The current version is updated only after full schema and relationship validation. Previous values remain attached to the resource.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleAmend}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                                        >
                                            <ShieldCheckIcon className="h-4 w-4" />
                                            Save correction
                                        </button>
                                    </div>

                                    <ProvenancePanel
                                        provenance={buildResourceProvenanceView(selectedResource)}
                                        onViewSource={selectedResource.provenance.source.document
                                            ? () => setSource(selectedResource.provenance.source.document!)
                                            : undefined}
                                    />
                                </section>

                                <AmendmentHistory resource={selectedResource} />

                                <section className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 dark:border-red-900/70 dark:bg-red-950/25">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-300" />
                                        <div>
                                            <h3 className="text-sm font-bold text-red-950 dark:text-red-100">
                                                Mark entered in error
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed text-red-800 dark:text-red-200">
                                                Use this when the record itself should not be treated as a patient fact. The resource is removed from confirmed views but retained permanently with the reason and prior history.
                                            </p>
                                        </div>
                                    </div>
                                    <textarea
                                        value={errorReason}
                                        onChange={event => setErrorReason(event.target.value)}
                                        rows={3}
                                        placeholder="Required reason for invalidating this record"
                                        className="mt-4 w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-red-800 dark:bg-slate-950"
                                    />
                                    <label className="mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-white/70 p-3 dark:border-red-900/50 dark:bg-slate-950/40">
                                        <input
                                            type="checkbox"
                                            checked={errorConfirmed}
                                            onChange={event => setErrorConfirmed(event.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600"
                                        />
                                        <span className="text-xs leading-relaxed text-red-800 dark:text-red-200">
                                            I understand this does not delete the record. It preserves the resource as entered-in-error history and removes it from confirmed patient summaries.
                                        </span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleEnteredInError}
                                        disabled={!errorReason.trim() || !errorConfirmed}
                                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <AlertTriangleIcon className="h-4 w-4" />
                                        Mark entered in error
                                    </button>
                                </section>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'history' && (
                    <div className="space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                                <ModuleSearch
                                    value={historySearch}
                                    onChange={setHistorySearch}
                                    placeholder="Search record history, source, status, or type"
                                />
                                <ModuleSelect
                                    label="Verification state"
                                    value={historyStatus}
                                    onChange={value => setHistoryStatus(value as HistoryStatusFilter)}
                                    options={[
                                        { value: 'all', label: 'All verification states' },
                                        { value: 'confirmed', label: 'Confirmed' },
                                        { value: 'candidate', label: 'Candidate' },
                                        { value: 'rejected', label: 'Rejected' },
                                        { value: 'entered-in-error', label: 'Entered in error' },
                                    ]}
                                />
                                <ModuleSelect
                                    label="Resource type"
                                    value={historyType}
                                    onChange={setHistoryType}
                                    options={[
                                        { value: 'all', label: 'All resource types' },
                                        ...Array.from(new Set(allSummaries.map(item => item.resourceType)))
                                            .sort()
                                            .map(value => ({ value, label: value })),
                                    ]}
                                />
                            </div>
                        </section>

                        {historySummaries.length === 0 ? (
                            <EmptyModuleState
                                title="No record history matches these filters"
                                description="Adjust the text, verification-state, or resource-type filters."
                            />
                        ) : (
                            <div className="space-y-3">
                                {historySummaries.map(item => (
                                    <details
                                        key={`${item.resourceType}-${item.id}`}
                                        className={`group overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950/80 ${item.verificationStatus === 'entered-in-error'
                                            ? 'border-red-300 dark:border-red-900/70'
                                            : item.verificationStatus === 'rejected'
                                                ? 'border-amber-300 dark:border-amber-900/70'
                                                : 'border-slate-200 dark:border-slate-800'
                                        }`}
                                    >
                                        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                            <DocumentTextIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                        {item.label}
                                                    </span>
                                                    <StatusBadge tone={item.verificationStatus === 'confirmed'
                                                        ? 'positive'
                                                        : item.verificationStatus === 'entered-in-error'
                                                            ? 'danger'
                                                            : 'warning'}>
                                                        {item.verificationStatus.replace(/-/g, ' ')}
                                                    </StatusBadge>
                                                    <StatusBadge>{item.resourceType}</StatusBadge>
                                                </span>
                                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                    {item.statusLabel} · {item.clinicalDateLabel} · {item.amendmentCount} amendment{item.amendmentCount === 1 ? '' : 's'}
                                                </span>
                                            </span>
                                            <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                        </summary>
                                        <div className="border-t border-slate-100 p-4 dark:border-slate-800 md:p-5">
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                {[
                                                    ['Resource ID', item.id],
                                                    ['Clinical date', item.clinicalDateLabel],
                                                    ['Stored', item.recordedLabel],
                                                    ['Source', item.sourceLabel],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                            {label}
                                                        </p>
                                                        <p className="mt-1 break-words text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                            {value}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>

                                            {item.resource.resourceType !== 'PatientProfile' && (
                                                <div className="mt-4">
                                                    <AmendmentHistory resource={item.resource as PatientClinicalResource} />
                                                </div>
                                            )}

                                            <ProvenancePanel
                                                provenance={buildResourceProvenanceView(item.resource)}
                                                onViewSource={item.resource.provenance.source.document
                                                    ? () => setSource(item.resource.provenance.source.document!)
                                                    : undefined}
                                            />
                                        </div>
                                    </details>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {source && (
                <DocumentSourcePreview
                    patientId={record.patientId}
                    source={source}
                    onClose={() => setSource(null)}
                />
            )}
        </div>
    );
};

export default RecordManagementModule;
