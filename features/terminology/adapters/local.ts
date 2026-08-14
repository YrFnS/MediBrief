import {
    LOINC_CONTENT_VERSION,
    LOINC_EXACT_ALIASES,
    TERMINOLOGY_URIS,
    findExactUcumCode,
} from '../registry';
import {
    createTerminologyResult,
    normalizeCodeValidationRequest,
} from './shared';
import type {
    TerminologyCodeValidationRequest,
    TerminologyCodeValidationResult,
    TerminologyValidationAdapter,
} from './types';

const localLoincByCode = new Map(
    LOINC_EXACT_ALIASES.map(definition => [
        definition.coding.code,
        definition,
    ]),
);

export const validateCodeWithLocalReviewedSubset = (
    input: TerminologyCodeValidationRequest,
): TerminologyCodeValidationResult => {
    const request = normalizeCodeValidationRequest(input);
    const adapterId = 'medibrief-local-reviewed-subset';

    if (!request.system || !request.code) {
        return createTerminologyResult({
            adapterId,
            status: 'invalid',
            request,
            message: 'A terminology system and code are required.',
            externalRequest: false,
        });
    }

    if (request.system === TERMINOLOGY_URIS.loinc) {
        const definition = localLoincByCode.get(request.code);
        if (!definition) {
            return createTerminologyResult({
                adapterId,
                status: 'indeterminate',
                request,
                message:
                    'The code is outside MediBrief’s deliberately small reviewed LOINC subset.',
                externalRequest: false,
            });
        }
        if (request.version && request.version !== LOINC_CONTENT_VERSION) {
            return createTerminologyResult({
                adapterId,
                status: 'indeterminate',
                request,
                preferredDisplay: definition.coding.display,
                message:
                    `The code is reviewed locally, but the requested LOINC version ${request.version} differs from ${LOINC_CONTENT_VERSION}.`,
                externalRequest: false,
            });
        }
        return createTerminologyResult({
            adapterId,
            status: 'valid',
            request,
            preferredDisplay: definition.coding.display,
            message:
                `The code is present in MediBrief’s reviewed LOINC ${LOINC_CONTENT_VERSION} subset.`,
            warnings: request.display
                && definition.coding.display
                && request.display !== definition.coding.display
                ? ['The supplied display differs from the reviewed local display.']
                : [],
            externalRequest: false,
        });
    }

    if (request.system === TERMINOLOGY_URIS.ucum) {
        const definition = findExactUcumCode(request.code);
        return definition
            ? createTerminologyResult({
                adapterId,
                status: 'valid',
                request,
                preferredDisplay: definition.display,
                message:
                    'The case-sensitive code is present in MediBrief’s reviewed UCUM subset.',
                externalRequest: false,
            })
            : createTerminologyResult({
                adapterId,
                status: 'indeterminate',
                request,
                message:
                    'The code is outside MediBrief’s reviewed UCUM subset. It was not guessed or case-folded.',
                externalRequest: false,
            });
    }

    if (request.system === TERMINOLOGY_URIS.rxnorm) {
        if (!/^[1-9]\d{0,11}$/.test(request.code)) {
            return createTerminologyResult({
                adapterId,
                status: 'invalid',
                request,
                message:
                    'RxCUI must be a positive numeric identifier of up to 12 digits.',
                externalRequest: false,
            });
        }
        return createTerminologyResult({
            adapterId,
            status: 'indeterminate',
            request,
            message:
                'The RxCUI is syntactically valid, but MediBrief does not bundle RxNorm content and cannot establish active concept status locally.',
            externalRequest: false,
        });
    }

    if (request.system === TERMINOLOGY_URIS.snomedCt) {
        if (!/^\d{6,18}$/.test(request.code)) {
            return createTerminologyResult({
                adapterId,
                status: 'invalid',
                request,
                message:
                    'Only a simple numeric SNOMED CT identifier is accepted; expressions require a separate governed workflow.',
                externalRequest: false,
            });
        }
        return createTerminologyResult({
            adapterId,
            status: 'indeterminate',
            request,
            message:
                'The identifier is syntactically plausible, but MediBrief does not distribute or validate SNOMED CT content locally.',
            warnings: request.version
                ? []
                : ['No SNOMED CT edition/version URI was supplied.'],
            externalRequest: false,
        });
    }

    return createTerminologyResult({
        adapterId,
        status: 'indeterminate',
        request,
        message:
            'The terminology system is not covered by MediBrief’s local reviewed subsets.',
        externalRequest: false,
    });
};

export const createLocalReviewedTerminologyAdapter = (): TerminologyValidationAdapter => ({
    id: 'medibrief-local-reviewed-subset',
    name: 'MediBrief local reviewed subset',
    mode: 'local-reviewed-subset',
    externalRequest: false,
    supportedSystems: [
        TERMINOLOGY_URIS.loinc,
        TERMINOLOGY_URIS.ucum,
        TERMINOLOGY_URIS.rxnorm,
        TERMINOLOGY_URIS.snomedCt,
    ],
    privacyBoundary:
        'Runs locally. No code, display, patient information, document content, or network request leaves the browser.',
    validateCode: async request =>
        validateCodeWithLocalReviewedSubset(request),
});
