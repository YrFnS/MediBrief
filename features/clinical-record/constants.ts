export const CLINICAL_RECORD_SCHEMA_VERSION = 1 as const;

export const CLINICAL_RECORD_STORAGE_KEY = 'medibrief-clinical-record-v1';

export const CLINICAL_RECORD_EXPORT_FORMAT = 'medibrief-clinical-record';

export const CLINICAL_RECORD_EXPORT_VERSION = 1 as const;

export const MEDIBRIEF_BACKUP_FORMAT = 'medibrief-backup';

export const MEDIBRIEF_BACKUP_VERSION = 2 as const;

export const LEGACY_MEDIBRIEF_BACKUP_VERSION = '4.2' as const;

export const LEGACY_MEDIBRIEF_SOURCE_SYSTEM = 'medibrief-legacy-v4.2';

export const UNKNOWN_CLINICAL_DATE = {
    value: null,
    precision: 'unknown',
} as const;
