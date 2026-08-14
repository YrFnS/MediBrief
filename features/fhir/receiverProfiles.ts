import {
    FHIR_R4_VERSION,
    IPS_PACKAGE,
    IPS_PROFILES,
} from './ipsConstants';

export type ReceiverProfileSourceKind =
    | 'built-in'
    | 'capability-statement';

export type ReceiverTerminologyDisposition = 'warning' | 'error';

export interface ReceiverTerminologyPolicy {
    unknownSystem: ReceiverTerminologyDisposition;
    indeterminateCode: ReceiverTerminologyDisposition;
    invalidCode: 'error';
    allowedSystems?: string[];
}

export interface ReceiverExchangeProfile {
    id: string;
    name: string;
    version: string;
    sourceKind: ReceiverProfileSourceKind;
    sourceReference: string;
    fhirVersion: string;
    ipsPackage: string;
    supportsJson: boolean | 'unknown';
    acceptedBundleProfiles: string[];
    acceptedCompositionProfiles: string[];
    requiredProfilesByResourceType: Record<string, string[]>;
    enforceAdvertisedResourceProfiles: boolean;
    advertisedResourceTypes: string[];
    advertisedProfilesByResourceType: Record<string, string[]>;
    maxBundleEntries?: number;
    maxBundleBytes?: number;
    terminologyPolicy: ReceiverTerminologyPolicy;
    capabilityWarnings: string[];
    limitations: string[];
}

export interface ReceiverProfileParseResult {
    profile?: ReceiverExchangeProfile;
    errors: string[];
    warnings: string[];
}

const GENERIC_REQUIRED_PROFILES: Record<string, string[]> = {
    Bundle: [IPS_PROFILES.bundle],
    Composition: [IPS_PROFILES.composition],
    Patient: [IPS_PROFILES.patient],
};

export const GENERIC_IPS_RECEIVER_PROFILE: ReceiverExchangeProfile = {
    id: 'generic-ips-2.0.1-consumer',
    name: 'Generic IPS 2.0.1 consumer',
    version: '1',
    sourceKind: 'built-in',
    sourceReference: 'MediBrief built-in receiver contract',
    fhirVersion: FHIR_R4_VERSION,
    ipsPackage: IPS_PACKAGE,
    supportsJson: true,
    acceptedBundleProfiles: [IPS_PROFILES.bundle],
    acceptedCompositionProfiles: [IPS_PROFILES.composition],
    requiredProfilesByResourceType: GENERIC_REQUIRED_PROFILES,
    enforceAdvertisedResourceProfiles: false,
    advertisedResourceTypes: [],
    advertisedProfilesByResourceType: {},
    terminologyPolicy: {
        unknownSystem: 'warning',
        indeterminateCode: 'warning',
        invalidCode: 'error',
    },
    capabilityWarnings: [],
    limitations: [
        'This profile represents the published IPS 2.0.1 document contract, not a specific deployed receiver.',
        'A passing report does not prove that a receiving organization will accept, store, display, or clinically interpret the document.',
    ],
};

export const REVIEWED_CODING_IPS_RECEIVER_PROFILE: ReceiverExchangeProfile = {
    ...GENERIC_IPS_RECEIVER_PROFILE,
    id: 'reviewed-coding-ips-2.0.1-consumer',
    name: 'IPS 2.0.1 consumer requiring reviewed coding evidence',
    sourceReference: 'MediBrief strict built-in receiver contract',
    terminologyPolicy: {
        unknownSystem: 'error',
        indeterminateCode: 'error',
        invalidCode: 'error',
    },
    limitations: [
        'This conservative contract requires every encountered coding to have deterministic local validation evidence.',
        'It is intentionally stricter than baseline IPS and can reject otherwise conformant documents whose codes require an external licensed terminology service.',
    ],
};

const HAPI_PUBLIC_R4_IPS_RESOURCE_TYPES = [
    'Composition',
    'Patient',
    'Device',
    'Condition',
    'AllergyIntolerance',
    'MedicationStatement',
    'MedicationRequest',
    'Immunization',
    'Procedure',
    'DiagnosticReport',
    'Specimen',
    'Observation',
];

/**
 * Pinned engineering contract for the public HAPI FHIR R4 test endpoint.
 *
 * This is deliberately not a production receiver profile. HAPI advertises a
 * general R4 server and transaction support, but not an IPS consumer document
 * profile. The resulting compatibility state therefore remains indeterminate
 * even when the generated IPS passes all computable local checks.
 */
export const HAPI_PUBLIC_R4_RECEIVER_PROFILE: ReceiverExchangeProfile = {
    ...GENERIC_IPS_RECEIVER_PROFILE,
    id: 'hapi-public-r4-test-server',
    name: 'HAPI FHIR Public R4 Test Server',
    version: '2026-08-15',
    sourceReference: 'https://hapi.fhir.org/baseR4/metadata',
    advertisedResourceTypes: HAPI_PUBLIC_R4_IPS_RESOURCE_TYPES,
    capabilityWarnings: [
        'The reviewed HAPI CapabilityStatement advertises a general FHIR R4 server and transaction support, but it does not establish an IPS consumer document profile or successful IPS rendering.',
        'The public test endpoint is mutable and can change independently of this pinned MediBrief contract; live capability drift must be reviewed before relying on a synthetic probe.',
    ],
    limitations: [
        'This is a public, non-production engineering endpoint. Never send real patient data, protected health information, confidential documents, or locally imported records.',
        'The server is available without receiver authentication and does not establish patient identity, consent, disclosure authorization, destination trust, or organizational acceptance.',
        'Public test data can be purged or replaced; successful storage does not establish durability, provenance preservation, clinical display, or downstream usability.',
        'The MediBrief live probe is manual-only and sends one hard-coded nonclinical Basic resource. It does not transmit the selected patient or the generated IPS document.',
    ],
};

export const RECEIVER_EXCHANGE_PROFILES: ReceiverExchangeProfile[] = [
    GENERIC_IPS_RECEIVER_PROFILE,
    REVIEWED_CODING_IPS_RECEIVER_PROFILE,
    HAPI_PUBLIC_R4_RECEIVER_PROFILE,
];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.flatMap(item =>
            typeof item === 'string' && item.trim()
                ? [item.trim()]
                : [])
        : [];

const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;

const unique = (values: string[]): string[] => [...new Set(values)];

const jsonFormat = (formats: string[]): boolean =>
    formats.some(format => [
        'json',
        'application/json',
        'application/fhir+json',
    ].includes(format.trim().toLowerCase()));

const resourceProfiles = (
    payload: Record<string, unknown>,
): {
    types: string[];
    profilesByType: Record<string, string[]>;
} => {
    const profilesByType: Record<string, string[]> = {};
    const types: string[] = [];
    const restEntries = Array.isArray(payload.rest) ? payload.rest : [];
    restEntries.forEach(restEntry => {
        if (!isObject(restEntry) || restEntry.mode !== 'server') return;
        const resources = Array.isArray(restEntry.resource)
            ? restEntry.resource
            : [];
        resources.forEach(resource => {
            if (!isObject(resource)) return;
            const type = text(resource.type);
            if (!type) return;
            types.push(type);
            const profiles = unique([
                ...(text(resource.profile) ? [text(resource.profile)!] : []),
                ...strings(resource.supportedProfile),
            ]);
            if (profiles.length > 0) {
                profilesByType[type] = unique([
                    ...(profilesByType[type] || []),
                    ...profiles,
                ]);
            }
        });
    });
    return {
        types: unique(types).sort(),
        profilesByType,
    };
};

const consumerDocumentProfiles = (
    payload: Record<string, unknown>,
): string[] => {
    const documents = Array.isArray(payload.document)
        ? payload.document
        : [];
    return unique(documents.flatMap(document => {
        if (!isObject(document) || document.mode !== 'consumer') return [];
        const profile = text(document.profile);
        return profile ? [profile] : [];
    }));
};

const profileCandidatesForType = (
    type: 'Bundle' | 'Composition',
    advertisedProfilesByResourceType: Record<string, string[]>,
    documentProfiles: string[],
): string[] => {
    const advertised = advertisedProfilesByResourceType[type] || [];
    const fromDocuments = documentProfiles.filter(profile => {
        const lower = profile.toLowerCase();
        return type === 'Bundle'
            ? lower.includes('bundle')
            : lower.includes('composition');
    });
    return unique([...advertised, ...fromDocuments]);
};

const slug = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72)
    || 'receiver';

/**
 * Converts computable receiver declarations into a local comparison profile.
 * It never contacts the endpoint declared by the CapabilityStatement and it
 * does not infer undocumented acceptance rules.
 */
export const receiverProfileFromCapabilityStatement = (
    input: unknown,
): ReceiverProfileParseResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!isObject(input) || input.resourceType !== 'CapabilityStatement') {
        return {
            errors: ['The selected JSON must be a FHIR CapabilityStatement.'],
            warnings,
        };
    }

    const fhirVersion = text(input.fhirVersion);
    if (!fhirVersion) {
        errors.push('CapabilityStatement.fhirVersion is required.');
    }
    const formats = strings(input.format);
    if (formats.length === 0) {
        errors.push('CapabilityStatement.format must declare at least one format.');
    }

    const name = text(input.title)
        || text(input.name)
        || text(input.id)
        || 'Imported receiver capability statement';
    const version = text(input.version) || 'unspecified';
    const implementation = isObject(input.implementation)
        ? input.implementation
        : undefined;
    const sourceReference = text(input.url)
        || text(implementation?.url)
        || `CapabilityStatement/${text(input.id) || 'uploaded'}`;
    const advertised = resourceProfiles(input);
    const documentProfiles = consumerDocumentProfiles(input);
    const bundleProfiles = profileCandidatesForType(
        'Bundle',
        advertised.profilesByType,
        documentProfiles,
    );
    const compositionProfiles = profileCandidatesForType(
        'Composition',
        advertised.profilesByType,
        documentProfiles,
    );

    if (documentProfiles.length === 0) {
        warnings.push(
            'The CapabilityStatement does not declare a consumer document profile. Document compatibility remains partly indeterminate.',
        );
    }
    if (bundleProfiles.length === 0) {
        warnings.push(
            'The receiver does not advertise a Bundle profile; the IPS Bundle profile is used only as a comparison fallback.',
        );
    }
    if (compositionProfiles.length === 0) {
        warnings.push(
            'The receiver does not advertise a Composition profile; the IPS Composition profile is used only as a comparison fallback.',
        );
    }
    if (fhirVersion && fhirVersion !== FHIR_R4_VERSION) {
        warnings.push(
            `The receiver declares FHIR ${fhirVersion}; MediBrief exports FHIR ${FHIR_R4_VERSION}.`,
        );
    }
    const supportsJson = formats.length > 0 ? jsonFormat(formats) : 'unknown';
    if (supportsJson === false) {
        warnings.push(
            'The receiver does not advertise JSON or application/fhir+json.',
        );
    }

    if (errors.length > 0) return { errors, warnings };

    const acceptedBundleProfiles = bundleProfiles.length > 0
        ? bundleProfiles
        : [IPS_PROFILES.bundle];
    const acceptedCompositionProfiles = compositionProfiles.length > 0
        ? compositionProfiles
        : [IPS_PROFILES.composition];

    return {
        errors: [],
        warnings,
        profile: {
            id: `capability-${slug(name)}-${slug(version)}`,
            name,
            version,
            sourceKind: 'capability-statement',
            sourceReference,
            fhirVersion: fhirVersion!,
            ipsPackage: IPS_PACKAGE,
            supportsJson,
            acceptedBundleProfiles,
            acceptedCompositionProfiles,
            requiredProfilesByResourceType: {
                Bundle: acceptedBundleProfiles,
                Composition: acceptedCompositionProfiles,
                ...(advertised.profilesByType.Patient
                    ? { Patient: advertised.profilesByType.Patient }
                    : {}),
            },
            enforceAdvertisedResourceProfiles: false,
            advertisedResourceTypes: advertised.types,
            advertisedProfilesByResourceType: advertised.profilesByType,
            terminologyPolicy: {
                unknownSystem: 'warning',
                indeterminateCode: 'warning',
                invalidCode: 'error',
            },
            capabilityWarnings: warnings,
            limitations: [
                'The comparison uses computable declarations only; narrative, local implementation policy, authentication, consent, and transport requirements require separate human review.',
                'The declared implementation URL is recorded as evidence only and is never contacted automatically.',
                'A CapabilityStatement reduces uncertainty but cannot guarantee receiver acceptance.',
            ],
        },
    };
};
