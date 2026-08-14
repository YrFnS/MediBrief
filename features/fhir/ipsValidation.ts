import {
    IPS_DOCUMENT_TYPE,
    IPS_PROFILES,
    REQUIRED_IPS_SECTION_CODES,
} from './ipsConstants';
import type {
    FhirComposition,
    FhirCompositionSection,
    FhirDocumentBundle,
    FhirR4Resource,
    IpsValidationIssue,
    IpsValidationResult,
} from './ipsTypes';

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const codingCode = (value: unknown): string | undefined => {
    if (!isObject(value)) return undefined;
    const coding = asArray(value.coding).find(item =>
        isObject(item) && typeof item.code === 'string');
    return isObject(coding) && typeof coding.code === 'string'
        ? coding.code
        : undefined;
};

const includesProfile = (resource: FhirR4Resource, profile: string): boolean =>
    Array.isArray(resource.meta?.profile)
    && resource.meta!.profile!.includes(profile);

const isNarrative = (value: unknown): boolean => {
    if (!isObject(value)) return false;
    return typeof value.status === 'string'
        && typeof value.div === 'string'
        && value.div.includes('xmlns="http://www.w3.org/1999/xhtml"');
};

const collectReferences = (
    value: unknown,
    path = '',
    output: Array<{ path: string; reference: string }> = [],
): Array<{ path: string; reference: string }> => {
    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            collectReferences(item, `${path}[${index}]`, output));
        return output;
    }
    if (!isObject(value)) return output;

    Object.entries(value).forEach(([key, item]) => {
        const nextPath = path ? `${path}.${key}` : key;
        if (key === 'reference' && typeof item === 'string') {
            output.push({ path: nextPath, reference: item });
        } else {
            collectReferences(item, nextPath, output);
        }
    });
    return output;
};

const addIssue = (
    list: IpsValidationIssue[],
    severity: IpsValidationIssue['severity'],
    code: string,
    path: string,
    message: string,
): void => {
    list.push({ severity, code, path, message });
};

const validateSection = (
    section: FhirCompositionSection,
    index: number,
    errors: IpsValidationIssue[],
    warnings: IpsValidationIssue[],
): void => {
    const path = `Bundle.entry[0].resource.section[${index}]`;
    const code = codingCode(section.code);
    if (!code) {
        addIssue(errors, 'error', 'section-code-required', `${path}.code`,
            'Every IPS section must carry its section code.');
    }
    if (!isNarrative(section.text)) {
        addIssue(errors, 'error', 'section-narrative-required', `${path}.text`,
            'Every included IPS section must contain generated XHTML narrative.');
    }

    const entries = Array.isArray(section.entry) ? section.entry : [];
    if (entries.length === 0 && !section.emptyReason) {
        addIssue(warnings, 'warning', 'empty-section-reason', path,
            'An empty section should provide emptyReason or be omitted when optional.');
    }
    if (entries.length > 0 && section.emptyReason) {
        addIssue(warnings, 'warning', 'section-entry-and-empty-reason', path,
            'A populated section should not also claim an empty reason.');
    }
    if (section.mode !== 'snapshot') {
        addIssue(warnings, 'warning', 'section-mode', `${path}.mode`,
            'MediBrief IPS exports use snapshot sections.');
    }
};

export const validateIpsDocumentBundle = (
    payload: unknown,
): IpsValidationResult => {
    const errors: IpsValidationIssue[] = [];
    const warnings: IpsValidationIssue[] = [];

    if (!isObject(payload) || payload.resourceType !== 'Bundle') {
        addIssue(errors, 'error', 'bundle-required', 'Bundle',
            'The payload must be a FHIR Bundle resource.');
        return {
            valid: false,
            errors,
            warnings,
            summary: {
                entries: 0,
                sections: 0,
                requiredSectionsPresent: 0,
                unresolvedReferences: 0,
            },
        };
    }

    const bundle = payload as unknown as FhirDocumentBundle;
    if (bundle.type !== 'document') {
        addIssue(errors, 'error', 'document-bundle-required', 'Bundle.type',
            'An IPS must use Bundle.type = document.');
    }
    if (!bundle.identifier?.system || !bundle.identifier.value) {
        addIssue(errors, 'error', 'bundle-identifier-required', 'Bundle.identifier',
            'A document Bundle identifier must contain both system and value.');
    }
    if (!bundle.timestamp || Number.isNaN(Date.parse(bundle.timestamp))) {
        addIssue(errors, 'error', 'bundle-timestamp-required', 'Bundle.timestamp',
            'A document Bundle requires a valid assembly timestamp.');
    }
    if (!includesProfile(bundle, IPS_PROFILES.bundle)) {
        addIssue(errors, 'error', 'ips-bundle-profile', 'Bundle.meta.profile',
            `Bundle.meta.profile must declare ${IPS_PROFILES.bundle}.`);
    }

    const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
    if (entries.length < 2) {
        addIssue(errors, 'error', 'bundle-entry-count', 'Bundle.entry',
            'An IPS Bundle requires at least a Composition and Patient entry.');
    }

    const fullUrls = new Set<string>();
    entries.forEach((entry, index) => {
        const path = `Bundle.entry[${index}]`;
        if (!entry?.fullUrl) {
            addIssue(errors, 'error', 'fullurl-required', `${path}.fullUrl`,
                'Every IPS Bundle entry requires fullUrl.');
        } else if (fullUrls.has(entry.fullUrl)) {
            addIssue(errors, 'error', 'fullurl-unique', `${path}.fullUrl`,
                `Duplicate fullUrl ${entry.fullUrl}.`);
        } else {
            fullUrls.add(entry.fullUrl);
        }
        if (!entry?.resource?.resourceType) {
            addIssue(errors, 'error', 'entry-resource-required', `${path}.resource`,
                'Every document entry must contain a FHIR resource.');
        }
    });

    const firstResource = entries[0]?.resource;
    if (firstResource?.resourceType !== 'Composition') {
        addIssue(errors, 'error', 'composition-first', 'Bundle.entry[0].resource',
            'The first resource in a document Bundle must be Composition.');
    }
    const compositionCount = entries.filter(entry =>
        entry.resource?.resourceType === 'Composition').length;
    if (compositionCount !== 1) {
        addIssue(errors, 'error', 'single-composition', 'Bundle.entry',
            'An IPS Bundle must contain exactly one Composition, as its first entry.');
    }

    const composition = firstResource?.resourceType === 'Composition'
        ? firstResource as FhirComposition
        : undefined;
    const sections = composition?.section || [];
    if (composition) {
        if (!includesProfile(composition, IPS_PROFILES.composition)) {
            addIssue(errors, 'error', 'ips-composition-profile',
                'Bundle.entry[0].resource.meta.profile',
                `Composition.meta.profile must declare ${IPS_PROFILES.composition}.`);
        }
        if (composition.status !== 'final') {
            addIssue(errors, 'error', 'composition-final',
                'Bundle.entry[0].resource.status',
                'A generated MediBrief IPS must be a final Composition.');
        }
        if (codingCode(composition.type) !== IPS_DOCUMENT_TYPE.code) {
            addIssue(errors, 'error', 'ips-document-type',
                'Bundle.entry[0].resource.type',
                `IPS Composition.type must include LOINC ${IPS_DOCUMENT_TYPE.code}.`);
        }
        if (!composition.identifier?.system || !composition.identifier.value) {
            addIssue(errors, 'error', 'composition-identifier',
                'Bundle.entry[0].resource.identifier',
                'Composition.identifier must contain system and value.');
        }
        if (!composition.subject?.reference) {
            addIssue(errors, 'error', 'composition-subject',
                'Bundle.entry[0].resource.subject',
                'IPS Composition requires a patient subject reference.');
        }
        if (!Array.isArray(composition.author)
            || composition.author.length === 0
            || !composition.author.every(author => author.reference)) {
            addIssue(errors, 'error', 'composition-author',
                'Bundle.entry[0].resource.author',
                'IPS Composition requires at least one resolvable author reference.');
        }
        if (!composition.date || Number.isNaN(Date.parse(composition.date))) {
            addIssue(errors, 'error', 'composition-date',
                'Bundle.entry[0].resource.date',
                'IPS Composition requires a valid date.');
        }
        if (!composition.title?.trim()) {
            addIssue(errors, 'error', 'composition-title',
                'Bundle.entry[0].resource.title',
                'IPS Composition requires a title.');
        }
        sections.forEach((section, index) =>
            validateSection(section, index, errors, warnings));
    }

    const sectionCodes = new Set(sections.map(section => codingCode(section.code))
        .filter((code): code is string => Boolean(code)));
    REQUIRED_IPS_SECTION_CODES.forEach(code => {
        if (!sectionCodes.has(code)) {
            addIssue(errors, 'error', 'required-section',
                'Bundle.entry[0].resource.section',
                `Required IPS section ${code} is missing.`);
        }
    });

    const resources = entries.map(entry => entry.resource);
    if (!resources.some(resource => resource.resourceType === 'Patient')) {
        addIssue(errors, 'error', 'patient-entry', 'Bundle.entry',
            'An IPS document must include its Patient subject resource.');
    }

    const allReferences = collectReferences(composition || {});
    let unresolvedReferences = 0;
    allReferences.forEach(({ path, reference }) => {
        if (reference.startsWith('#')) return;
        if (!fullUrls.has(reference)) {
            unresolvedReferences += 1;
            addIssue(errors, 'error', 'composition-reference-resolution', path,
                `Composition reference ${reference} is not included in the Bundle.`);
        }
    });

    resources.slice(1).forEach((resource, resourceIndex) => {
        collectReferences(resource).forEach(({ path, reference }) => {
            if (!reference.startsWith('urn:uuid:')) return;
            if (!fullUrls.has(reference)) {
                unresolvedReferences += 1;
                addIssue(errors, 'error', 'bundle-reference-resolution',
                    `Bundle.entry[${resourceIndex + 1}].resource.${path}`,
                    `Document-local reference ${reference} is unresolved.`);
            }
        });
    });

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
            entries: entries.length,
            sections: sections.length,
            requiredSectionsPresent: REQUIRED_IPS_SECTION_CODES
                .filter(code => sectionCodes.has(code)).length,
            unresolvedReferences,
        },
    };
};
