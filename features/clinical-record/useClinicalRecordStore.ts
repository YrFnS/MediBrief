import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { indexedDBStorage } from '../../services/storage';
import {
    CLINICAL_RECORD_SCHEMA_VERSION,
    CLINICAL_RECORD_STORAGE_KEY,
} from './constants';
import {
    createPatientClinicalRecord,
    type CreatePatientClinicalRecordInput,
} from './factories';
import {
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
} from './schemas';
import type {
    ClinicalAmendment,
    ClinicalRecordResource,
    ClinicalResourceType,
    PatientClinicalRecord,
    PatientProfileRecord,
    ReviewMetadata,
} from './types';
import {
    createTimelineEntry,
    findDuplicateCandidate,
    findResourceInRecord,
    flattenPatientResources,
    getResourceCollectionKey,
    matchesClinicalResourceQuery,
    sortTimelineEntries,
    type ClinicalResourceQuery,
    type ClinicalTimelineEntry,
    type PatientClinicalResource,
    type PatientClinicalResourceType,
} from './resourceUtils';

export interface ClinicalRecordState {
    records: Record<string, PatientClinicalRecord>;
}

export type ClinicalResourceOfType<
    TType extends PatientClinicalResourceType,
> = Extract<PatientClinicalResource, { resourceType: TType }>;

export type AnyClinicalResourceOfType<
    TType extends ClinicalResourceType,
> = Extract<ClinicalRecordResource, { resourceType: TType }>;

export type ClinicalResourceUpdates<
    TType extends PatientClinicalResourceType,
> = Partial<Omit<
    ClinicalResourceOfType<TType>,
    | 'id'
    | 'patientId'
    | 'resourceType'
    | 'verificationStatus'
    | 'recordedAt'
    | 'provenance'
    | 'amendments'
>>;

export type PatientProfileUpdates = Partial<Omit<
    PatientProfileRecord,
    | 'id'
    | 'patientId'
    | 'resourceType'
    | 'verificationStatus'
    | 'recordedAt'
    | 'provenance'
    | 'amendments'
>>;

export interface ClinicalReviewInput {
    reviewedAt?: string;
    reviewedBy?: string;
    reason?: string;
}

export interface ClinicalAmendmentInput {
    amendedAt?: string;
    amendedBy?: string;
    reason?: string;
}

export interface AddClinicalResourceOptions {
    allowDuplicateCandidate?: boolean;
}

export interface TimelineQueryOptions {
    resourceTypes?: ClinicalResourceType[];
    verificationStatuses?: ClinicalRecordResource['verificationStatus'][];
    includeProfile?: boolean;
    includeUnknownDates?: boolean;
    from?: string;
    to?: string;
}

export type ClinicalWriteStatus =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'duplicate'
    | 'not-found'
    | 'patient-not-found'
    | 'conflict'
    | 'invalid-transition'
    | 'protected-record'
    | 'unchanged';

export interface ClinicalWriteResult<
    T extends ClinicalRecordResource = ClinicalRecordResource,
> {
    ok: boolean;
    status: ClinicalWriteStatus;
    resource?: T;
    resourceId?: string;
    duplicateOf?: string;
    message?: string;
}

export interface ClinicalRecordActions {
    actions: {
        initializePatientRecord: (
            input: CreatePatientClinicalRecordInput,
        ) => PatientClinicalRecord;
        replacePatientRecord: (
            record: PatientClinicalRecord,
        ) => PatientClinicalRecord;
        deletePatientRecord: (patientId: string) => boolean;
        getPatientRecord: (
            patientId: string,
        ) => PatientClinicalRecord | undefined;
        getResource: <TType extends ClinicalResourceType>(
            patientId: string,
            resourceType: TType,
            resourceId: string,
        ) => AnyClinicalResourceOfType<TType> | undefined;
        findResources: (
            query?: ClinicalResourceQuery,
        ) => ClinicalRecordResource[];
        getTimeline: (
            patientId: string,
            options?: TimelineQueryOptions,
        ) => ClinicalTimelineEntry[];
        updatePatientProfile: (
            patientId: string,
            updates: PatientProfileUpdates,
            amendment?: ClinicalAmendmentInput,
        ) => ClinicalWriteResult<PatientProfileRecord>;
        addResource: <T extends PatientClinicalResource>(
            resource: T,
            options?: AddClinicalResourceOptions,
        ) => ClinicalWriteResult<T>;
        amendResource: <TType extends PatientClinicalResourceType>(
            patientId: string,
            resourceType: TType,
            resourceId: string,
            updates: ClinicalResourceUpdates<TType>,
            amendment?: ClinicalAmendmentInput,
        ) => ClinicalWriteResult<ClinicalResourceOfType<TType>>;
        deleteResource: <TType extends PatientClinicalResourceType>(
            patientId: string,
            resourceType: TType,
            resourceId: string,
        ) => ClinicalWriteResult<ClinicalResourceOfType<TType>>;
        confirmCandidate: <TType extends PatientClinicalResourceType>(
            patientId: string,
            resourceType: TType,
            resourceId: string,
            review?: ClinicalReviewInput,
        ) => ClinicalWriteResult<ClinicalResourceOfType<TType>>;
        rejectCandidate: <TType extends PatientClinicalResourceType>(
            patientId: string,
            resourceType: TType,
            resourceId: string,
            review?: ClinicalReviewInput,
        ) => ClinicalWriteResult<ClinicalResourceOfType<TType>>;
        markResourceEnteredInError: <
            TType extends PatientClinicalResourceType,
        >(
            patientId: string,
            resourceType: TType,
            resourceId: string,
            amendment: ClinicalAmendmentInput,
        ) => ClinicalWriteResult<ClinicalResourceOfType<TType>>;
    };
}

export type ClinicalRecordStore = ClinicalRecordState & ClinicalRecordActions;

interface PersistedClinicalRecordState {
    records: Record<string, PatientClinicalRecord>;
}

const IMMUTABLE_RESOURCE_FIELDS = new Set([
    'id',
    'patientId',
    'resourceType',
    'verificationStatus',
    'recordedAt',
    'provenance',
    'amendments',
]);

const cloneForHistory = <T>(value: T): T => {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
};

const valuesEqual = (left: unknown, right: unknown): boolean =>
    JSON.stringify(left) === JSON.stringify(right);

const collectChanges = (
    current: ClinicalRecordResource,
    updates: Record<string, unknown>,
): {
    safeUpdates: Record<string, unknown>;
    changedFields: string[];
    previousValues: Record<string, unknown>;
} => {
    const safeUpdates: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const previousValues: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, nextValue]) => {
        if (IMMUTABLE_RESOURCE_FIELDS.has(key)) return;

        const previousValue =
            (current as unknown as Record<string, unknown>)[key];
        if (valuesEqual(previousValue, nextValue)) return;

        safeUpdates[key] = cloneForHistory(nextValue);
        changedFields.push(key);
        previousValues[key] = cloneForHistory(previousValue);
    });

    return { safeUpdates, changedFields, previousValues };
};

const createAmendment = ({
    changedFields,
    previousValues,
    input,
    fallbackReason,
}: {
    changedFields: string[];
    previousValues: Record<string, unknown>;
    input?: ClinicalAmendmentInput;
    fallbackReason?: string;
}): ClinicalAmendment => {
    const reason = input?.reason || fallbackReason;

    return {
        id: uuidv4(),
        amendedAt: input?.amendedAt || new Date().toISOString(),
        ...(input?.amendedBy ? { amendedBy: input.amendedBy } : {}),
        ...(reason ? { reason } : {}),
        changedFields,
        previousValues,
    };
};

const updateResourceWithHistory = <T extends ClinicalRecordResource>(
    resource: T,
    updates: Record<string, unknown>,
    amendment?: ClinicalAmendmentInput,
    fallbackReason?: string,
): { resource: T; changed: boolean } => {
    const { safeUpdates, changedFields, previousValues } =
        collectChanges(resource, updates);

    if (changedFields.length === 0) {
        return { resource, changed: false };
    }

    const historyEntry = createAmendment({
        changedFields,
        previousValues,
        input: amendment,
        fallbackReason,
    });

    const nextResource = {
        ...resource,
        ...safeUpdates,
        provenance: {
            ...resource.provenance,
            updatedAt: historyEntry.amendedAt,
            ...(historyEntry.amendedBy
                ? { updatedBy: historyEntry.amendedBy }
                : {}),
        },
        amendments: [...resource.amendments, historyEntry],
    } as T;

    return {
        resource: parseClinicalRecordResource(nextResource) as T,
        changed: true,
    };
};

const replaceResourceInRecord = (
    record: PatientClinicalRecord,
    resource: PatientClinicalResource,
    updatedAt: string,
): PatientClinicalRecord => {
    const collectionKey = getResourceCollectionKey(resource.resourceType);
    const collection =
        record.resources[collectionKey] as PatientClinicalResource[];

    return parsePatientClinicalRecord({
        ...record,
        resources: {
            ...record.resources,
            [collectionKey]: collection.map(current =>
                current.id === resource.id ? resource : current,
            ),
        },
        updatedAt,
    });
};

const addResourceToRecord = (
    record: PatientClinicalRecord,
    resource: PatientClinicalResource,
    updatedAt: string,
): PatientClinicalRecord => {
    const collectionKey = getResourceCollectionKey(resource.resourceType);
    const collection =
        record.resources[collectionKey] as PatientClinicalResource[];

    return parsePatientClinicalRecord({
        ...record,
        resources: {
            ...record.resources,
            [collectionKey]: [...collection, resource],
        },
        updatedAt,
    });
};

const removeResourceFromRecord = (
    record: PatientClinicalRecord,
    resource: PatientClinicalResource,
    updatedAt: string,
): PatientClinicalRecord => {
    const collectionKey = getResourceCollectionKey(resource.resourceType);
    const collection =
        record.resources[collectionKey] as PatientClinicalResource[];

    return parsePatientClinicalRecord({
        ...record,
        resources: {
            ...record.resources,
            [collectionKey]: collection.filter(
                current => current.id !== resource.id,
            ),
        },
        updatedAt,
    });
};

const parsePersistedRecords = (
    input: unknown,
): Record<string, PatientClinicalRecord> => {
    if (input === undefined || input === null) return {};
    if (typeof input !== 'object' || Array.isArray(input)) {
        throw new Error(
            'Clinical record persistence payload must contain a record map.',
        );
    }

    const parsedRecords: Record<string, PatientClinicalRecord> = {};
    Object.entries(input as Record<string, unknown>).forEach(
        ([patientId, rawRecord]) => {
            const parsed = parsePatientClinicalRecord(rawRecord);
            if (parsed.patientId !== patientId) {
                throw new Error(
                    `Clinical record key mismatch for patient ${patientId}.`,
                );
            }
            parsedRecords[patientId] = parsed;
        },
    );
    return parsedRecords;
};

const makeReviewMetadata = (
    input?: ClinicalReviewInput,
): ReviewMetadata => ({
    reviewedAt: input?.reviewedAt || new Date().toISOString(),
    ...(input?.reviewedBy ? { reviewedBy: input.reviewedBy } : {}),
    ...(input?.reason ? { reason: input.reason } : {}),
});

const transitionCandidate = (
    resource: PatientClinicalResource,
    target: 'confirmed' | 'rejected',
    review?: ClinicalReviewInput,
): PatientClinicalResource => {
    const reviewMetadata = makeReviewMetadata(review);
    const historyEntry = createAmendment({
        changedFields: ['verificationStatus'],
        previousValues: {
            verificationStatus: resource.verificationStatus,
        },
        input: {
            amendedAt: reviewMetadata.reviewedAt,
            amendedBy: reviewMetadata.reviewedBy,
            reason: reviewMetadata.reason,
        },
        fallbackReason:
            target === 'confirmed'
                ? 'Candidate confirmed'
                : 'Candidate rejected',
    });

    const baseProvenance = {
        ...resource.provenance,
        updatedAt: reviewMetadata.reviewedAt,
        ...(reviewMetadata.reviewedBy
            ? { updatedBy: reviewMetadata.reviewedBy }
            : {}),
    };

    let provenance;
    if (target === 'confirmed') {
        const {
            rejection: _rejection,
            ...withoutRejection
        } = baseProvenance;
        provenance = {
            ...withoutRejection,
            confirmation: reviewMetadata,
        };
    } else {
        const {
            confirmation: _confirmation,
            ...withoutConfirmation
        } = baseProvenance;
        provenance = {
            ...withoutConfirmation,
            rejection: reviewMetadata,
        };
    }

    return parseClinicalRecordResource({
        ...resource,
        verificationStatus: target,
        provenance,
        amendments: [...resource.amendments, historyEntry],
    }) as PatientClinicalResource;
};

const markEnteredInError = (
    resource: PatientClinicalResource,
    amendment: ClinicalAmendmentInput,
): PatientClinicalResource => {
    const historyEntry = createAmendment({
        changedFields: ['verificationStatus'],
        previousValues: {
            verificationStatus: resource.verificationStatus,
        },
        input: amendment,
        fallbackReason: 'Marked entered in error',
    });

    return parseClinicalRecordResource({
        ...resource,
        verificationStatus: 'entered-in-error',
        provenance: {
            ...resource.provenance,
            updatedAt: historyEntry.amendedAt,
            ...(historyEntry.amendedBy
                ? { updatedBy: historyEntry.amendedBy }
                : {}),
        },
        amendments: [...resource.amendments, historyEntry],
    }) as PatientClinicalResource;
};

const mutationTimestamp = (): string => new Date().toISOString();

export const useClinicalRecordStore = create<ClinicalRecordStore>()(
    persist<ClinicalRecordStore, [], [], PersistedClinicalRecordState>(
        (set, get) => ({
            records: {},
            actions: {
                initializePatientRecord: input => {
                    const existing = get().records[input.patientId];
                    if (existing) return existing;

                    const record = parsePatientClinicalRecord(
                        createPatientClinicalRecord(input),
                    );
                    set(state => ({
                        records: {
                            ...state.records,
                            [record.patientId]: record,
                        },
                    }));
                    return record;
                },

                replacePatientRecord: record => {
                    const parsed = parsePatientClinicalRecord(record);
                    set(state => ({
                        records: {
                            ...state.records,
                            [parsed.patientId]: parsed,
                        },
                    }));
                    return parsed;
                },

                deletePatientRecord: patientId => {
                    if (!get().records[patientId]) return false;

                    set(state => {
                        const records = { ...state.records };
                        delete records[patientId];
                        return { records };
                    });
                    return true;
                },

                getPatientRecord: patientId =>
                    get().records[patientId],

                getResource: <TType extends ClinicalResourceType>(
                    patientId: string,
                    resourceType: TType,
                    resourceId: string,
                ): AnyClinicalResourceOfType<TType> | undefined => {
                    const record = get().records[patientId];
                    const resource = record
                        ? findResourceInRecord(
                            record,
                            resourceType,
                            resourceId,
                        )
                        : undefined;
                    return resource as
                        | AnyClinicalResourceOfType<TType>
                        | undefined;
                },

                findResources: (query = {}) => {
                    const records = query.patientId
                        ? [get().records[query.patientId]].filter(
                            Boolean,
                        ) as PatientClinicalRecord[]
                        : Object.values(get().records);

                    const includeProfile =
                        query.includeProfile
                        || query.resourceTypes?.includes('PatientProfile')
                        || false;

                    return records
                        .flatMap(record =>
                            flattenPatientResources(
                                record,
                                includeProfile,
                            ),
                        )
                        .filter(resource =>
                            matchesClinicalResourceQuery(
                                resource,
                                query,
                            ),
                        );
                },

                getTimeline: (patientId, options = {}) => {
                    const record = get().records[patientId];
                    if (!record) return [];

                    const query: ClinicalResourceQuery = {
                        patientId,
                        ...(options.resourceTypes
                            ? {
                                resourceTypes:
                                    options.resourceTypes,
                            }
                            : {}),
                        verificationStatuses:
                            options.verificationStatuses
                            || ['confirmed'],
                        includeProfile:
                            options.includeProfile || false,
                        ...((options.from || options.to)
                            ? {
                                date: {
                                    ...(options.from
                                        ? { from: options.from }
                                        : {}),
                                    ...(options.to
                                        ? { to: options.to }
                                        : {}),
                                    includeUnknown:
                                        options.includeUnknownDates
                                        || false,
                                },
                            }
                            : {}),
                    };

                    const entries = flattenPatientResources(
                        record,
                        query.includeProfile,
                    )
                        .filter(resource =>
                            matchesClinicalResourceQuery(
                                resource,
                                query,
                            ),
                        )
                        .map(createTimelineEntry);

                    return sortTimelineEntries(
                        options.includeUnknownDates === false
                            ? entries.filter(
                                entry =>
                                    !entry.usesRecordedAtFallback,
                            )
                            : entries,
                    );
                },

                updatePatientProfile: (
                    patientId,
                    updates,
                    amendment,
                ) => {
                    const record = get().records[patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const mutation = updateResourceWithHistory(
                        record.profile,
                        updates as Record<string, unknown>,
                        amendment,
                        'Patient profile amended',
                    );
                    if (!mutation.changed) {
                        return {
                            ok: true,
                            status: 'unchanged',
                            resource: record.profile,
                            resourceId: record.profile.id,
                        };
                    }

                    const profile =
                        mutation.resource as PatientProfileRecord;
                    const nextRecord =
                        parsePatientClinicalRecord({
                            ...record,
                            profile,
                            updatedAt: mutationTimestamp(),
                        });

                    set(state => ({
                        records: {
                            ...state.records,
                            [patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'updated',
                        resource: profile,
                        resourceId: profile.id,
                    };
                },

                addResource: <T extends PatientClinicalResource>(
                    resource: T,
                    options: AddClinicalResourceOptions = {},
                ): ClinicalWriteResult<T> => {
                    const record =
                        get().records[resource.patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const parsed =
                        parseClinicalRecordResource(resource);
                    if (parsed.resourceType === 'PatientProfile') {
                        return {
                            ok: false,
                            status: 'conflict',
                            message:
                                'Patient profiles must be updated through updatePatientProfile.',
                        };
                    }
                    const typedResource =
                        parsed as PatientClinicalResource;

                    const existingId =
                        flattenPatientResources(record).find(
                            current =>
                                current.id === typedResource.id,
                        );
                    if (existingId) {
                        return {
                            ok: false,
                            status: 'conflict',
                            resourceId: typedResource.id,
                            message:
                                'A clinical resource with this ID already exists for the patient.',
                        };
                    }

                    if (
                        !options.allowDuplicateCandidate
                        && typedResource.verificationStatus
                            === 'candidate'
                    ) {
                        const duplicate =
                            findDuplicateCandidate(
                                flattenPatientResources(
                                    record,
                                ) as PatientClinicalResource[],
                                typedResource,
                            );
                        if (duplicate) {
                            return {
                                ok: true,
                                status: 'duplicate',
                                resource:
                                    duplicate as typeof resource,
                                resourceId: duplicate.id,
                                duplicateOf: duplicate.id,
                                message:
                                    'An equivalent candidate from the same source is already stored.',
                            };
                        }
                    }

                    const nextRecord = addResourceToRecord(
                        record,
                        typedResource,
                        mutationTimestamp(),
                    );
                    set(state => ({
                        records: {
                            ...state.records,
                            [resource.patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'created',
                        resource:
                            typedResource as typeof resource,
                        resourceId: typedResource.id,
                    };
                },

                amendResource: <
                    TType extends PatientClinicalResourceType,
                >(
                    patientId: string,
                    resourceType: TType,
                    resourceId: string,
                    updates: ClinicalResourceUpdates<TType>,
                    amendment?: ClinicalAmendmentInput,
                ): ClinicalWriteResult<
                    ClinicalResourceOfType<TType>
                > => {
                    const record = get().records[patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const current = findResourceInRecord(
                        record,
                        resourceType,
                        resourceId,
                    );
                    if (
                        !current
                        || current.resourceType
                            === 'PatientProfile'
                    ) {
                        return {
                            ok: false,
                            status: 'not-found',
                            message:
                                'Clinical resource was not found.',
                        };
                    }
                    const typedCurrent =
                        current as ClinicalResourceOfType<TType>;

                    if (
                        typedCurrent.verificationStatus === 'rejected'
                        || typedCurrent.verificationStatus
                            === 'entered-in-error'
                    ) {
                        return {
                            ok: false,
                            status: 'protected-record',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                            message:
                                'Rejected and entered-in-error resources are retained as review history and cannot be amended.',
                        };
                    }

                    const mutation =
                        updateResourceWithHistory(
                            typedCurrent,
                            updates as Record<string, unknown>,
                            amendment,
                            'Clinical resource amended',
                        );
                    if (!mutation.changed) {
                        return {
                            ok: true,
                            status: 'unchanged',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                        };
                    }

                    const nextResource =
                        mutation.resource as ClinicalResourceOfType<TType>;
                    const nextRecord =
                        replaceResourceInRecord(
                            record,
                            nextResource,
                            mutationTimestamp(),
                        );

                    set(state => ({
                        records: {
                            ...state.records,
                            [patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'updated',
                        resource: nextResource,
                        resourceId: nextResource.id,
                    };
                },

                deleteResource: <
                    TType extends PatientClinicalResourceType,
                >(
                    patientId: string,
                    resourceType: TType,
                    resourceId: string,
                ): ClinicalWriteResult<
                    ClinicalResourceOfType<TType>
                > => {
                    const record = get().records[patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const current = findResourceInRecord(
                        record,
                        resourceType,
                        resourceId,
                    );
                    if (
                        !current
                        || current.resourceType
                            === 'PatientProfile'
                    ) {
                        return {
                            ok: false,
                            status: 'not-found',
                            message:
                                'Clinical resource was not found.',
                        };
                    }
                    const typedCurrent =
                        current as ClinicalResourceOfType<TType>;

                    if (
                        typedCurrent.verificationStatus
                            === 'confirmed'
                        || typedCurrent.verificationStatus
                            === 'rejected'
                        || typedCurrent.verificationStatus
                            === 'entered-in-error'
                    ) {
                        return {
                            ok: false,
                            status: 'protected-record',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                            message:
                                'Reviewed clinical history cannot be hard-deleted. Confirmed records should be marked entered in error instead.',
                        };
                    }

                    const nextRecord =
                        removeResourceFromRecord(
                            record,
                            typedCurrent,
                            mutationTimestamp(),
                        );
                    set(state => ({
                        records: {
                            ...state.records,
                            [patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'deleted',
                        resource: typedCurrent,
                        resourceId: typedCurrent.id,
                    };
                },

                confirmCandidate: <
                    TType extends PatientClinicalResourceType,
                >(
                    patientId: string,
                    resourceType: TType,
                    resourceId: string,
                    review?: ClinicalReviewInput,
                ): ClinicalWriteResult<
                    ClinicalResourceOfType<TType>
                > => {
                    const record = get().records[patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const current = findResourceInRecord(
                        record,
                        resourceType,
                        resourceId,
                    );
                    if (
                        !current
                        || current.resourceType
                            === 'PatientProfile'
                    ) {
                        return {
                            ok: false,
                            status: 'not-found',
                            message:
                                'Clinical resource was not found.',
                        };
                    }
                    const typedCurrent =
                        current as ClinicalResourceOfType<TType>;

                    if (
                        typedCurrent.verificationStatus
                            !== 'candidate'
                    ) {
                        return {
                            ok: false,
                            status: 'invalid-transition',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                            message:
                                'Only candidate resources can be confirmed.',
                        };
                    }

                    const nextResource =
                        transitionCandidate(
                            typedCurrent,
                            'confirmed',
                            review,
                        ) as ClinicalResourceOfType<TType>;
                    const nextRecord =
                        replaceResourceInRecord(
                            record,
                            nextResource,
                            mutationTimestamp(),
                        );

                    set(state => ({
                        records: {
                            ...state.records,
                            [patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'updated',
                        resource: nextResource,
                        resourceId: nextResource.id,
                    };
                },

                rejectCandidate: <
                    TType extends PatientClinicalResourceType,
                >(
                    patientId: string,
                    resourceType: TType,
                    resourceId: string,
                    review?: ClinicalReviewInput,
                ): ClinicalWriteResult<
                    ClinicalResourceOfType<TType>
                > => {
                    const record = get().records[patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const current = findResourceInRecord(
                        record,
                        resourceType,
                        resourceId,
                    );
                    if (
                        !current
                        || current.resourceType
                            === 'PatientProfile'
                    ) {
                        return {
                            ok: false,
                            status: 'not-found',
                            message:
                                'Clinical resource was not found.',
                        };
                    }
                    const typedCurrent =
                        current as ClinicalResourceOfType<TType>;

                    if (
                        typedCurrent.verificationStatus
                            !== 'candidate'
                    ) {
                        return {
                            ok: false,
                            status: 'invalid-transition',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                            message:
                                'Only candidate resources can be rejected.',
                        };
                    }

                    const nextResource =
                        transitionCandidate(
                            typedCurrent,
                            'rejected',
                            review,
                        ) as ClinicalResourceOfType<TType>;
                    const nextRecord =
                        replaceResourceInRecord(
                            record,
                            nextResource,
                            mutationTimestamp(),
                        );

                    set(state => ({
                        records: {
                            ...state.records,
                            [patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'updated',
                        resource: nextResource,
                        resourceId: nextResource.id,
                    };
                },

                markResourceEnteredInError: <
                    TType extends PatientClinicalResourceType,
                >(
                    patientId: string,
                    resourceType: TType,
                    resourceId: string,
                    amendment: ClinicalAmendmentInput,
                ): ClinicalWriteResult<
                    ClinicalResourceOfType<TType>
                > => {
                    const record = get().records[patientId];
                    if (!record) {
                        return {
                            ok: false,
                            status: 'patient-not-found',
                            message:
                                'Patient record was not found.',
                        };
                    }

                    const current = findResourceInRecord(
                        record,
                        resourceType,
                        resourceId,
                    );
                    if (
                        !current
                        || current.resourceType
                            === 'PatientProfile'
                    ) {
                        return {
                            ok: false,
                            status: 'not-found',
                            message:
                                'Clinical resource was not found.',
                        };
                    }
                    const typedCurrent =
                        current as ClinicalResourceOfType<TType>;

                    if (
                        typedCurrent.verificationStatus
                            === 'entered-in-error'
                    ) {
                        return {
                            ok: true,
                            status: 'unchanged',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                        };
                    }
                    if (!amendment.reason?.trim()) {
                        return {
                            ok: false,
                            status: 'invalid-transition',
                            resource: typedCurrent,
                            resourceId: typedCurrent.id,
                            message:
                                'A reason is required when marking a clinical resource entered in error.',
                        };
                    }

                    const nextResource =
                        markEnteredInError(
                            typedCurrent,
                            amendment,
                        ) as ClinicalResourceOfType<TType>;
                    const nextRecord =
                        replaceResourceInRecord(
                            record,
                            nextResource,
                            mutationTimestamp(),
                        );

                    set(state => ({
                        records: {
                            ...state.records,
                            [patientId]: nextRecord,
                        },
                    }));
                    return {
                        ok: true,
                        status: 'updated',
                        resource: nextResource,
                        resourceId: nextResource.id,
                    };
                },
            },
        }),
        {
            name: CLINICAL_RECORD_STORAGE_KEY,
            version: CLINICAL_RECORD_SCHEMA_VERSION,
            storage: createJSONStorage(
                () => indexedDBStorage,
            ),
            partialize: (
                state,
            ): PersistedClinicalRecordState => ({
                records: state.records,
            }),
            migrate: (
                persistedState,
                persistedVersion,
            ): PersistedClinicalRecordState => {
                if (
                    persistedVersion
                    !== CLINICAL_RECORD_SCHEMA_VERSION
                ) {
                    throw new Error(
                        `Unsupported clinical record persistence version ${persistedVersion}. `
                        + `Expected ${CLINICAL_RECORD_SCHEMA_VERSION}.`,
                    );
                }

                const persisted =
                    persistedState as Partial<PersistedClinicalRecordState>;
                return {
                    records:
                        parsePersistedRecords(
                            persisted.records,
                        ),
                };
            },
            merge: (
                persistedState,
                currentState,
            ) => {
                const persisted =
                    persistedState as Partial<PersistedClinicalRecordState>;

                return {
                    ...currentState,
                    records:
                        parsePersistedRecords(
                            persisted.records,
                        ),
                    actions: currentState.actions,
                };
            },
            skipHydration: true,
        },
    ),
);
