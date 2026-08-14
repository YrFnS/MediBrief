import { describe, expect, it } from 'vitest';
import {
    createClinicalProvenance,
    createPatientClinicalRecord,
    createRecordSource,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildIpsDocument,
    collectBundleTerminologyRequests,
    GENERIC_IPS_RECEIVER_PROFILE,
    IPS_PROFILES,
    receiverProfileFromCapabilityStatement,
    REVIEWED_CODING_IPS_RECEIVER_PROFILE,
    validateIpsForReceiver,
    type ReceiverExchangeProfile,
} from '../features/fhir';

const NOW = '2026-08-14T20:00:00.000Z';
const PATIENT_ID = 'synthetic-receiver-patient';

const syntheticRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: PATIENT_ID,
        displayName: 'Synthetic Receiver Patient',
        dateOfBirth: { value: '1990-01-01', precision: 'day' },
        administrativeSex: 'unknown',
        preferredLanguage: 'en',
        now: NOW,
    });
    record.resources.conditions.push({
        id: 'receiver-condition',
        patientId: PATIENT_ID,
        resourceType: 'Condition',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance: createClinicalProvenance({
            source: createRecordSource({
                kind: 'manual',
                description: 'Synthetic receiver-validation fixture',
            }),
            now: NOW,
            actor: 'test-suite',
        }),
        amendments: [],
        code: {
            text: 'Essential hypertension',
            coding: [{
                system: 'http://snomed.info/sct',
                version: 'http://snomed.info/sct/900000000000207008/version/20250701',
                code: '59621000',
                display: 'Essential hypertension',
            }],
        },
        clinicalStatus: 'active',
        onset: { value: '2024', precision: 'year' },
    });
    record.updatedAt = NOW;
    return record;
};

const bundle = () => buildIpsDocument(syntheticRecord(), NOW).bundle;

const withProfile = (
    updates: Partial<ReceiverExchangeProfile>,
): ReceiverExchangeProfile => ({
    ...GENERIC_IPS_RECEIVER_PROFILE,
    ...updates,
});

describe('receiver-specific IPS validation', () => {
    it('returns a bounded ready-with-warnings result for the generic IPS contract', async () => {
        const report = await validateIpsForReceiver({
            bundle: bundle(),
            receiver: GENERIC_IPS_RECEIVER_PROFILE,
            generatedAt: NOW,
        });
        expect(report.state).toBe('ready-with-warnings');
        expect(report.readyForManualTransfer).toBe(true);
        expect(report.transferAuthorized).toBe(false);
        expect(report.receiverAcceptanceEstablished).toBe(false);
        expect(report.clinicalValidationEstablished).toBe(false);
        expect(report.networkActivity).toBe('none');
        expect(report.summary.terminologyChecks).toBeGreaterThan(0);
        expect(report.summary.terminologyIndeterminate).toBeGreaterThan(0);
    });

    it('fails the strict coding contract when local terminology evidence is indeterminate', async () => {
        const report = await validateIpsForReceiver({
            bundle: bundle(),
            receiver: REVIEWED_CODING_IPS_RECEIVER_PROFILE,
            generatedAt: NOW,
        });
        expect(report.state).toBe('not-ready');
        expect(report.readyForManualTransfer).toBe(false);
        expect(report.issues.some(entry =>
            entry.category === 'terminology'
            && entry.severity === 'error')).toBe(true);
    });

    it('detects receiver profile and size mismatches', async () => {
        const profileMismatch = await validateIpsForReceiver({
            bundle: bundle(),
            receiver: withProfile({
                id: 'profile-mismatch',
                acceptedBundleProfiles: [
                    'https://receiver.example/StructureDefinition/other-bundle',
                ],
            }),
            generatedAt: NOW,
        });
        expect(profileMismatch.state).toBe('not-ready');
        expect(profileMismatch.issues.some(entry =>
            entry.code === 'receiver-bundle-profile')).toBe(true);

        const sizeMismatch = await validateIpsForReceiver({
            bundle: bundle(),
            receiver: withProfile({
                id: 'size-mismatch',
                maxBundleEntries: 1,
                maxBundleBytes: 50,
            }),
            generatedAt: NOW,
        });
        expect(sizeMismatch.state).toBe('not-ready');
        expect(sizeMismatch.issues.some(entry =>
            entry.code === 'bundle-entry-limit')).toBe(true);
        expect(sizeMismatch.issues.some(entry =>
            entry.code === 'bundle-byte-limit')).toBe(true);
    });

    it('collects coded tuples without copying patient or source content', () => {
        const document = bundle();
        const requests = collectBundleTerminologyRequests(document);
        const serialized = JSON.stringify(requests);
        expect(requests.length).toBeGreaterThan(0);
        expect(serialized).not.toContain(PATIENT_ID);
        expect(serialized).not.toContain('Synthetic Receiver Patient');
        expect(serialized).not.toContain('provenance');
        expect(serialized).not.toContain('narrative');
        expect(requests.every(request =>
            Object.keys(request).every(key => [
                'system',
                'code',
                'version',
                'display',
                'valueSetUrl',
            ].includes(key)))).toBe(true);
    });
});

describe('CapabilityStatement receiver profile derivation', () => {
    const capabilityStatement = () => ({
        resourceType: 'CapabilityStatement',
        id: 'browser-receiver',
        url: 'https://receiver.example/fhir/CapabilityStatement/ips',
        version: '2026.1',
        title: 'Browser Receiver',
        status: 'active',
        kind: 'instance',
        fhirVersion: '4.0.1',
        format: ['application/fhir+json'],
        document: [{
            mode: 'consumer',
            profile: IPS_PROFILES.bundle,
        }],
        rest: [{
            mode: 'server',
            resource: [
                { type: 'Bundle', profile: IPS_PROFILES.bundle },
                { type: 'Composition', profile: IPS_PROFILES.composition },
                { type: 'Patient', profile: IPS_PROFILES.patient },
                { type: 'Device' },
                { type: 'Condition', profile: IPS_PROFILES.condition },
            ],
        }],
    });

    it('derives a local comparison profile without contacting the declared endpoint', async () => {
        const parsed = receiverProfileFromCapabilityStatement(
            capabilityStatement(),
        );
        expect(parsed.errors).toHaveLength(0);
        expect(parsed.profile?.id).toBe(
            'capability-browser-receiver-2026-1',
        );
        expect(parsed.profile?.sourceReference).toBe(
            'https://receiver.example/fhir/CapabilityStatement/ips',
        );
        expect(parsed.profile?.sourceKind).toBe('capability-statement');

        const report = await validateIpsForReceiver({
            bundle: bundle(),
            receiver: parsed.profile!,
            generatedAt: NOW,
        });
        expect(report.networkActivity).toBe('none');
        expect(report.transferAuthorized).toBe(false);
    });

    it('fails closed for malformed or incompatible declarations', async () => {
        expect(receiverProfileFromCapabilityStatement({
            resourceType: 'Bundle',
        }).errors).toContain(
            'The selected JSON must be a FHIR CapabilityStatement.',
        );

        const incompatible = capabilityStatement();
        incompatible.fhirVersion = '5.0.0';
        const parsed = receiverProfileFromCapabilityStatement(incompatible);
        expect(parsed.warnings.some(warning =>
            warning.includes('MediBrief exports FHIR 4.0.1'))).toBe(true);
        const report = await validateIpsForReceiver({
            bundle: bundle(),
            receiver: parsed.profile!,
            generatedAt: NOW,
        });
        expect(report.state).toBe('not-ready');
        expect(report.issues.some(entry =>
            entry.code === 'fhir-version-mismatch')).toBe(true);
    });
});
