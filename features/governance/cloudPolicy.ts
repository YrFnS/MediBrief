export const CLOUD_PROCESSING_CONSENT_KEY =
    'medibrief_cloud_processing_consent_v1';
export const CLOUD_POLICY_BLOCKED_EVENT = 'medibrief:cloud-policy-blocked';
export const CLOUD_POLICY_CHANGED_EVENT = 'medibrief:cloud-policy-changed';
export const DEVELOPMENT_MODEL_OVERRIDE_KEY =
    'medibrief_dev_allow_unreviewed_clinical_model_v1';

export type ClinicalCloudTask =
    | 'general-assistance'
    | 'patient-record'
    | 'document-or-image';

export interface ReviewedClinicalModelProfile {
    modelId: string;
    provider: string;
    reviewedAt: string;
    reviewPackage: string;
    allowedTasks: ClinicalCloudTask[];
    limitations: string[];
}

/**
 * Fail-closed registry.
 *
 * An entry may only be added after the exact model ID and provider routing
 * profile has a recorded task-specific review package. Engineering tests or a
 * provider's generic benchmark are not sufficient. Until then, patient-record
 * and document/image requests stay local and are blocked before transmission.
 */
export const REVIEWED_CLINICAL_MODEL_REGISTRY: ReviewedClinicalModelProfile[] = [];

export type CloudPolicyBlockReason =
    | 'consent-required'
    | 'model-not-reviewed';

export interface CloudPolicyBlockedDetail {
    reason: CloudPolicyBlockReason;
    modelId: string;
    task: ClinicalCloudTask;
    message: string;
}

interface JsonRecord {
    [key: string]: unknown;
}

export interface CloudRequestClassification {
    modelId: string;
    task: ClinicalCloudTask;
    containsPatientSpecificEvidence: boolean;
    containsDocumentOrImage: boolean;
}

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

const asRecord = (value: unknown): JsonRecord | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as JsonRecord
        : null;

const collectStrings = (value: unknown, output: string[] = []): string[] => {
    if (typeof value === 'string') {
        output.push(value);
        return output;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectStrings(item, output));
        return output;
    }
    const object = asRecord(value);
    if (!object) return output;
    Object.values(object).forEach(item => collectStrings(item, output));
    return output;
};

const containsAttachment = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(containsAttachment);
    const object = asRecord(value);
    if (!object) return false;
    if (
        object.type === 'file'
        || object.type === 'image_url'
        || object.type === 'input_audio'
    ) {
        return true;
    }
    return Object.values(object).some(containsAttachment);
};

const PATIENT_EVIDENCE_MARKERS = [
    'MEDIBRIEF_GROUNDED_PATIENT_ANSWER_V1',
    'MEDIBRIEF_GROUNDED_PATIENT',
    'LOCAL PATIENT EVIDENCE',
    '*** BEGIN FILE CONTENT:',
    'Analyze this medical document',
    'Analyze this medical image',
    'patient-record evidence',
    'confirmed patient-record evidence',
];

export const classifyCloudRequestPayload = (
    payload: unknown,
): CloudRequestClassification => {
    const root = asRecord(payload);
    const modelId = typeof root?.model === 'string' ? root.model.trim() : '';
    const messages = root?.messages;
    const combinedText = collectStrings(messages).join('\n');
    const containsDocumentOrImage = containsAttachment(messages)
        || combinedText.includes('*** BEGIN FILE CONTENT:')
        || /analy[sz]e this medical (?:document|image)/i.test(combinedText);
    const containsPatientSpecificEvidence = PATIENT_EVIDENCE_MARKERS.some(
        marker => combinedText.includes(marker),
    );

    return {
        modelId,
        task: containsDocumentOrImage
            ? 'document-or-image'
            : containsPatientSpecificEvidence
                ? 'patient-record'
                : 'general-assistance',
        containsPatientSpecificEvidence,
        containsDocumentOrImage,
    };
};

export const isReviewedClinicalModel = (
    modelId: string,
    task: ClinicalCloudTask,
): boolean => REVIEWED_CLINICAL_MODEL_REGISTRY.some(profile =>
    profile.modelId === modelId && profile.allowedTasks.includes(task));

export const cloudProcessingConsentGranted = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(CLOUD_PROCESSING_CONSENT_KEY)
        === 'granted';
};

export const setCloudProcessingConsent = (granted: boolean): void => {
    if (typeof window === 'undefined') return;
    if (granted) {
        window.sessionStorage.setItem(CLOUD_PROCESSING_CONSENT_KEY, 'granted');
    } else {
        window.sessionStorage.removeItem(CLOUD_PROCESSING_CONSENT_KEY);
    }
    window.dispatchEvent(new CustomEvent(CLOUD_POLICY_CHANGED_EVENT, {
        detail: { granted },
    }));
};

const developmentOverrideEnabled = (): boolean => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return false;
    return window.localStorage.getItem(DEVELOPMENT_MODEL_OVERRIDE_KEY) === 'true';
};

export const evaluateCloudPolicy = ({
    classification,
    consentGranted,
    allowDevelopmentOverride = false,
}: {
    classification: CloudRequestClassification;
    consentGranted: boolean;
    allowDevelopmentOverride?: boolean;
}): CloudPolicyBlockedDetail | null => {
    if (!consentGranted) {
        return {
            reason: 'consent-required',
            modelId: classification.modelId,
            task: classification.task,
            message:
                'Cloud processing is disabled for this browser session. Open Safety & capabilities and explicitly enable cloud processing before sending any content to OpenRouter.',
        };
    }

    if (
        classification.task !== 'general-assistance'
        && !isReviewedClinicalModel(
            classification.modelId,
            classification.task,
        )
        && !allowDevelopmentOverride
    ) {
        return {
            reason: 'model-not-reviewed',
            modelId: classification.modelId,
            task: classification.task,
            message:
                'Patient-record and medical document/image requests are disabled because the selected model/provider profile has no task-specific MediBrief review package. No patient evidence was transmitted.',
        };
    }

    return null;
};

const urlForInput = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
};

const parseRequestPayload = (body: BodyInit | null | undefined): unknown => {
    if (typeof body !== 'string') return {};
    try {
        return JSON.parse(body) as unknown;
    } catch {
        return {};
    }
};

export const applyOpenRouterPrivacyRouting = (payload: unknown): unknown => {
    const root = asRecord(payload);
    if (!root) return payload;
    const provider = asRecord(root.provider) || {};
    return {
        ...root,
        provider: {
            ...provider,
            data_collection: 'deny',
            zdr: true,
            allow_fallbacks: false,
            require_parameters: true,
        },
    };
};

let policyGuardInstalled = false;

/**
 * Installs a browser-side policy boundary immediately before the network call.
 * This is intentionally independent of UI state and prompt wording at the call
 * site so an accidental future call path still fails closed.
 */
export const installClinicalCloudPolicyGuard = (): void => {
    if (typeof window === 'undefined' || policyGuardInstalled) return;
    policyGuardInstalled = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> => {
        if (urlForInput(input) !== OPENROUTER_CHAT_URL) {
            return originalFetch(input, init);
        }

        const payload = parseRequestPayload(init?.body);
        const classification = classifyCloudRequestPayload(payload);
        const blocked = evaluateCloudPolicy({
            classification,
            consentGranted: cloudProcessingConsentGranted(),
            allowDevelopmentOverride: developmentOverrideEnabled(),
        });

        if (blocked) {
            window.dispatchEvent(new CustomEvent<CloudPolicyBlockedDetail>(
                CLOUD_POLICY_BLOCKED_EVENT,
                { detail: blocked },
            ));
            throw new Error(blocked.message);
        }

        const guardedPayload = applyOpenRouterPrivacyRouting(payload);
        return originalFetch(input, {
            ...init,
            body: JSON.stringify(guardedPayload),
        });
    };
};
