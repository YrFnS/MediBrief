import {
    FHIR_R4_VERSION,
    IPS_PACKAGE,
} from './ipsConstants';
import type {
    FhirDocumentBundle,
    FhirR4Resource,
} from './ipsTypes';
import { validateIpsDocumentBundle } from './ipsValidation';
import type { ReceiverExchangeProfile } from './receiverProfiles';
import type {
    ReceiverValidationIssue,
    ReceiverValidationReport,
    ReceiverValidationSeverity,
} from './receiverValidationTypes';
import {
    createLocalReviewedTerminologyAdapter,
    createTerminologyResult,
    terminologyRequestFingerprint,
    type TerminologyCodeValidationRequest,
    type TerminologyCodeValidationResult,
    type TerminologyValidationAdapter,
} from '../terminology/adapters';

const unique = (values: string[]): string[] => [...new Set(values)];

const profilesOf = (resource: FhirR4Resource): string[] =>
    Array.isArray(resource.meta?.profile)
        ? resource.meta!.profile!.filter((profile): profile is string =>
            typeof profile === 'string' && Boolean(profile.trim()))
        : [];

const resourceCounts = (
    bundle: FhirDocumentBundle,
): Record<string, number> => {
    const counts: Record<string, number> = {};
    bundle.entry.forEach(entry => {
        const type = entry.resource.resourceType;
        counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
};

const issue = (
    issues: ReceiverValidationIssue[],
    severity: ReceiverValidationSeverity,
    category: ReceiverValidationIssue['category'],
    code: string,
    path: string,
    message: string,
): void => {
    issues.push({ severity, category, code, path, message });
};

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Collects only coded tuples. It deliberately does not copy patient IDs,
 * narrative, note text, source excerpts, document contents, or resource
 * objects into the terminology adapter boundary.
 */
export const collectBundleTerminologyRequests = (
    bundle: FhirDocumentBundle,
): TerminologyCodeValidationRequest[] => {
    const requests = new Map<string, TerminologyCodeValidationRequest>();
    const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (!isObject(value)) return;

        if (typeof value.system === 'string'
            && typeof value.code === 'string'
            && value.system.trim()
            && value.code.trim()) {
            const request: TerminologyCodeValidationRequest = {
                system: value.system.trim(),
                code: value.code.trim(),
                ...(typeof value.version === 'string' && value.version.trim()
                    ? { version: value.version.trim() }
                    : {}),
                ...(typeof value.display === 'string' && value.display.trim()
                    ? { display: value.display.trim() }
                    : {}),
            };
            requests.set(terminologyRequestFingerprint(request), request);
        }

        Object.values(value).forEach(visit);
    };
    visit(bundle);
    return [...requests.values()];
};

const profileMatch = (
    actual: string[],
    accepted: string[],
): boolean => actual.some(profile => accepted.includes(profile));

const checkReceiverProfiles = (
    bundle: FhirDocumentBundle,
    receiver: ReceiverExchangeProfile,
    issues: ReceiverValidationIssue[],
): void => {
    const bundleProfiles = profilesOf(bundle);
    if (!profileMatch(bundleProfiles, receiver.acceptedBundleProfiles)) {
        issue(
            issues,
            'error',
            'profile',
            'receiver-bundle-profile',
            'Bundle.meta.profile',
            `The Bundle does not declare a profile accepted by ${receiver.name}.`,
        );
    }

    const composition = bundle.entry[0]?.resource;
    if (composition?.resourceType === 'Composition'
        && !profileMatch(
            profilesOf(composition),
            receiver.acceptedCompositionProfiles,
        )) {
        issue(
            issues,
            'error',
            'profile',
            'receiver-composition-profile',
            'Bundle.entry[0].resource.meta.profile',
            `The Composition does not declare a profile accepted by ${receiver.name}.`,
        );
    }

    Object.entries(receiver.requiredProfilesByResourceType)
        .forEach(([resourceType, requiredProfiles]) => {
            const resources = resourceType === 'Bundle'
                ? [bundle as FhirR4Resource]
                : bundle.entry
                    .map(entry => entry.resource)
                    .filter(resource => resource.resourceType === resourceType);
            if (resources.length === 0) return;
            resources.forEach((resource, index) => {
                if (profileMatch(profilesOf(resource), requiredProfiles)) return;
                issue(
                    issues,
                    'error',
                    'profile',
                    'receiver-required-profile',
                    resourceType === 'Bundle'
                        ? 'Bundle.meta.profile'
                        : `Bundle.entry.resource[${resourceType}:${index}].meta.profile`,
                    `${resourceType} does not declare a profile required by the receiver contract.`,
                );
            });
        });

    const advertisedTypes = new Set(receiver.advertisedResourceTypes);
    if (advertisedTypes.size > 0) {
        unique(bundle.entry.map(entry => entry.resource.resourceType))
            .filter(type => !['Composition'].includes(type))
            .forEach(type => {
                if (advertisedTypes.has(type)) return;
                issue(
                    issues,
                    receiver.enforceAdvertisedResourceProfiles
                        ? 'error'
                        : 'warning',
                    receiver.enforceAdvertisedResourceProfiles
                        ? 'resource-support'
                        : 'capability-uncertainty',
                    'resource-type-not-advertised',
                    `Bundle.entry.resource[${type}]`,
                    `${receiver.name} does not advertise ${type}; document acceptance is not established.`,
                );
            });
    }

    Object.entries(receiver.advertisedProfilesByResourceType)
        .forEach(([type, advertisedProfiles]) => {
            if (advertisedProfiles.length === 0) return;
            bundle.entry
                .map(entry => entry.resource)
                .filter(resource => resource.resourceType === type)
                .forEach((resource, index) => {
                    if (profileMatch(profilesOf(resource), advertisedProfiles)) {
                        return;
                    }
                    issue(
                        issues,
                        receiver.enforceAdvertisedResourceProfiles
                            ? 'error'
                            : 'warning',
                        receiver.enforceAdvertisedResourceProfiles
                            ? 'profile'
                            : 'capability-uncertainty',
                        'advertised-profile-mismatch',
                        `Bundle.entry.resource[${type}:${index}].meta.profile`,
                        `${type} does not match a profile advertised by the receiver.`,
                    );
                });
        });
};

const terminologyIssueSeverity = (
    result: TerminologyCodeValidationResult,
    receiver: ReceiverExchangeProfile,
): ReceiverValidationSeverity => {
    if (result.status === 'invalid') return 'error';
    if (result.status === 'indeterminate') {
        return receiver.terminologyPolicy.indeterminateCode;
    }
    return result.warnings.length > 0 ? 'warning' : 'information';
};

const adapterCoversSystem = (
    adapter: TerminologyValidationAdapter,
    system: string,
): boolean => adapter.supportedSystems === 'configured'
    || adapter.supportedSystems.includes(system);

export const validateIpsForReceiver = async ({
    bundle,
    receiver,
    terminologyAdapter = createLocalReviewedTerminologyAdapter(),
    generatedAt = new Date().toISOString(),
}: {
    bundle: FhirDocumentBundle;
    receiver: ReceiverExchangeProfile;
    terminologyAdapter?: TerminologyValidationAdapter;
    generatedAt?: string;
}): Promise<ReceiverValidationReport> => {
    const issues: ReceiverValidationIssue[] = [];
    const ipsValidation = validateIpsDocumentBundle(bundle);
    ipsValidation.errors.forEach(validationIssue => issue(
        issues,
        'error',
        'structure',
        validationIssue.code,
        validationIssue.path,
        validationIssue.message,
    ));
    ipsValidation.warnings.forEach(validationIssue => issue(
        issues,
        'warning',
        'structure',
        validationIssue.code,
        validationIssue.path,
        validationIssue.message,
    ));

    if (receiver.fhirVersion !== FHIR_R4_VERSION) {
        issue(
            issues,
            'error',
            'receiver-contract',
            'fhir-version-mismatch',
            'receiver.fhirVersion',
            `The receiver declares FHIR ${receiver.fhirVersion}; MediBrief exports ${FHIR_R4_VERSION}.`,
        );
    }
    if (receiver.ipsPackage !== IPS_PACKAGE) {
        issue(
            issues,
            'error',
            'receiver-contract',
            'ips-package-mismatch',
            'receiver.ipsPackage',
            `The receiver contract targets ${receiver.ipsPackage}; this export targets ${IPS_PACKAGE}.`,
        );
    }
    if (receiver.supportsJson === false) {
        issue(
            issues,
            'error',
            'format',
            'json-not-advertised',
            'receiver.supportsJson',
            'The receiver does not advertise JSON or application/fhir+json.',
        );
    } else if (receiver.supportsJson === 'unknown') {
        issue(
            issues,
            'warning',
            'capability-uncertainty',
            'json-support-unknown',
            'receiver.supportsJson',
            'The receiver’s JSON support is not declared.',
        );
    }

    const serialized = JSON.stringify(bundle);
    const bundleBytes = new TextEncoder().encode(serialized).byteLength;
    if (receiver.maxBundleBytes !== undefined
        && bundleBytes > receiver.maxBundleBytes) {
        issue(
            issues,
            'error',
            'size-limit',
            'bundle-byte-limit',
            'Bundle',
            `The Bundle is ${bundleBytes} bytes; the receiver limit is ${receiver.maxBundleBytes}.`,
        );
    }
    if (receiver.maxBundleEntries !== undefined
        && bundle.entry.length > receiver.maxBundleEntries) {
        issue(
            issues,
            'error',
            'size-limit',
            'bundle-entry-limit',
            'Bundle.entry',
            `The Bundle has ${bundle.entry.length} entries; the receiver limit is ${receiver.maxBundleEntries}.`,
        );
    }

    checkReceiverProfiles(bundle, receiver, issues);
    receiver.capabilityWarnings.forEach((warning, index) => issue(
        issues,
        'warning',
        'capability-uncertainty',
        'capability-declaration-gap',
        `receiver.capabilityWarnings[${index}]`,
        warning,
    ));

    const terminologyRequests = collectBundleTerminologyRequests(bundle);
    const terminologyResults: TerminologyCodeValidationResult[] = [];
    for (const request of terminologyRequests) {
        const receiverAllowsSystem = !receiver.terminologyPolicy.allowedSystems
            || receiver.terminologyPolicy.allowedSystems.includes(
                request.system,
            );
        if (!receiverAllowsSystem) {
            terminologyResults.push(createTerminologyResult({
                adapterId: terminologyAdapter.id,
                status: 'indeterminate',
                request,
                message:
                    'The terminology system is not allowed by the receiver contract. No network request was made.',
                externalRequest: false,
            }));
            issue(
                issues,
                receiver.terminologyPolicy.unknownSystem,
                'terminology',
                'terminology-system-not-allowed',
                `coding[${request.system}|${request.code}]`,
                'The terminology system is not allowed by the receiver contract.',
            );
            continue;
        }

        if (!adapterCoversSystem(terminologyAdapter, request.system)) {
            terminologyResults.push(createTerminologyResult({
                adapterId: terminologyAdapter.id,
                status: 'indeterminate',
                request,
                message:
                    'The selected terminology adapter does not cover this system. No network request was made.',
                externalRequest: false,
            }));
            issue(
                issues,
                receiver.terminologyPolicy.unknownSystem,
                'terminology',
                'terminology-system-not-covered',
                `coding[${request.system}|${request.code}]`,
                'The selected terminology adapter does not cover this terminology system.',
            );
            continue;
        }

        let validationResult: TerminologyCodeValidationResult;
        try {
            validationResult = await terminologyAdapter.validateCode(request);
        } catch {
            validationResult = {
                adapterId: terminologyAdapter.id,
                status: 'indeterminate',
                system: request.system,
                code: request.code,
                ...(request.version ? { version: request.version } : {}),
                ...(request.display
                    ? { requestedDisplay: request.display }
                    : {}),
                message:
                    'The terminology adapter failed unexpectedly; validity is unknown.',
                warnings: [],
                checkedAt: generatedAt,
                externalRequest: terminologyAdapter.externalRequest,
                requestFingerprint: terminologyRequestFingerprint(request),
            };
        }
        terminologyResults.push(validationResult);
        const severity = terminologyIssueSeverity(
            validationResult,
            receiver,
        );
        if (severity !== 'information') {
            issue(
                issues,
                severity,
                'terminology',
                `terminology-${validationResult.status}`,
                `coding[${request.system}|${request.code}]`,
                validationResult.message,
            );
        }
        validationResult.warnings.forEach((warning, index) => issue(
            issues,
            'warning',
            'terminology',
            'terminology-display-warning',
            `coding[${request.system}|${request.code}].warning[${index}]`,
            warning,
        ));
    }

    const hasErrors = issues.some(entry => entry.severity === 'error');
    const hasCapabilityUncertainty = issues.some(entry =>
        entry.category === 'capability-uncertainty');
    const hasWarnings = issues.some(entry => entry.severity === 'warning');
    const state = hasErrors
        ? 'not-ready' as const
        : hasCapabilityUncertainty
            ? 'indeterminate' as const
            : hasWarnings
                ? 'ready-with-warnings' as const
                : 'ready' as const;

    return {
        schemaVersion: '1',
        generatedAt,
        state,
        receiver,
        ipsValidation,
        issues,
        terminologyResults,
        summary: {
            bundleEntries: bundle.entry.length,
            bundleBytes,
            resourceTypes: resourceCounts(bundle),
            terminologyChecks: terminologyResults.length,
            terminologyValid: terminologyResults.filter(result =>
                result.status === 'valid').length,
            terminologyInvalid: terminologyResults.filter(result =>
                result.status === 'invalid').length,
            terminologyIndeterminate: terminologyResults.filter(result =>
                result.status === 'indeterminate').length,
        },
        readyForManualTransfer:
            state === 'ready' || state === 'ready-with-warnings',
        transferAuthorized: false,
        receiverAcceptanceEstablished: false,
        clinicalValidationEstablished: false,
        networkActivity: terminologyResults.some(result =>
            result.externalRequest)
            ? 'coded-terminology-only'
            : 'none',
        limitations: [
            ...receiver.limitations,
            'Receiver validation compares computable declarations and the generated document only. It does not perform transport, authentication, consent, patient-identity matching, source-authenticity verification, or end-to-end receiver testing.',
            'Ready for manual transfer is an engineering compatibility result, not permission to disclose health information.',
            'Terminology validation does not establish clinical truth or appropriate use of a code in context.',
        ],
    };
};
