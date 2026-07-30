export const CLINICAL_RECORD_SCHEMA_VERSION = 1 as const;

export const CLINICAL_RECORD_STORAGE_KEY = 'medibrief-clinical-record-v1';

export const CLINICAL_RECORD_EXPORT_FORMAT = 'medibrief-clinical-record';

export const CLINICAL_RECORD_EXPORT_VERSION = 1 as const;

export const UNKNOWN_CLINICAL_DATE = {
    value: null,
    precision: 'unknown',
} as const;
