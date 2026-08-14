import { describe, expect, it } from 'vitest';
import {
    createClinicalProvenance,
    createPatientClinicalRecord,
    createRecordSource,
    flattenPatientResources,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildIpsDocument,
    commitAtomicIpsImport,
    FHIR_SYSTEMS,
    IPS_PROFILES,
    MAX_PRESERVED_IPS_SOURCE_BYTES,
    prepareAtomicIpsImport,
    serializeIpsBundle,
    type AtomicIpsImportPreview,
} from '../features/fhir';
import {
    ENCRYPTED_SOURCE_STORAGE_PREFIX,
} from '../services/encryptedSourceStorage';

const NOW = '2026-08-15T08:00:00.000Z';
const IMPORTED_AT = '2026-08-15T09:00:00.000Z';
const TARGET_PATIENT_ID = 'local-target-patient';
const SOURCE_PATIENT_ID = 'source-document-patient';
const IDENTIFIER_SYSTEM = 'urn:oid:2.16.840.1.113883.3.933.1';
const IDENTIFIER_VALUE = 'ATOMIC-IPS-001';

const provenance = createClinicalProvenance({
    source: createRecordSource({
        kind: 'manual',
        description: 'Synthetic atomic IPS fixture',
    }),
    now: NOW,
    actor: 'test-suite',
});

const base = (id: string, resourceType: string) => ({
    id,
    patientId: SOURCE_PATIENT_ID,
    resourceType,
    verificationStatus: 'confirmed' as const,
    recordedAt: NOW,
    provenance,
    amendments: [],
});

const sourceRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: SOURCE_PATIENT_ID,
        displayName: 'Noura Hassan',
        now: NOW,
        dateOfBirth: { value: '1994-05-21', precision: 'day' },
        administrativeSex: 'female',
        preferredLanguage: 'en',
    });
    record.profile.identifiers.push({
        system: IDENTIFIER_SYSTEM,
        value: IDENTIFIER_VALUE,
        type: 'Medical record number',
        use: 'official',
    });

    record.resources.conditions.push({
        ...base('condition-hypertension', 'Condition'),
        resourceType: 'Condition',
        code: {
            text: 'Essential hypertension',
            coding: [{
                system: 'http://snomed.info/sct',
                code: '59621000',
                display: 'Essential hypertension',
            }],
        },
        clinicalStatus: 'active',
        onset: { value: '2024', precision: 'year' },
    });

    record.resources.medications.push({
        ...base('medication-amlodipine', 'Medication'),
        resourceType: 'Medication',
        kind: 'statement',
        medication: {
            text: 'Amlodipine 5 mg tablet',
            coding: [{
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '308135',
                display: 'Amlodipine 5 MG Oral Tablet',
            }],
        },
        status: 'active',
        dosageInstructions: [{
            text: 'Take 5 mg by mouth once daily',
            dose: {
                original: {
                    value: 5,
                    unit: 'mg',
                    system: FHIR_SYSTEMS.ucum,
                    code: 'mg',
                },
            },
        }],
        start: { value: '2024-01-03', precision: 'day' },
    });

    record.resources.specimens.push({
        ...base('specimen-serum', 'Specimen'),
        resourceType: 'Specimen',
        status: 'available',
        type: { text: 'Serum specimen' },
        collectedAt: { value: '2026-08-10', precision: 'day' },
    });

    record.resources.observations.push({
        ...base('observation-creatinine', 'Observation'),
        resourceType: 'Observation',
        status: 'final',
        category: [{
            text: 'Laboratory',
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'laboratory',
                display: 'Laboratory',
            }],
        }],
        code: {
            text: 'Creatinine [Mass/volume] in Serum or Plasma',
            coding: [{
                system: FHIR_SYSTEMS.loinc,
                code: '2160-0',
                display: 'Creatinine [Mass/volume] in Serum or Plasma',
            }],
        },
        value: {
            type: 'quantity',
            quantity: {
                original: {
                    value: 0.9,
                    unit: 'mg/dL',
                    system: FHIR_SYSTEMS.ucum,
                    code: 'mg/dL',
                },
            },
        },
        referenceRanges: [],
        effective: { value: '2026-08-10', precision: 'day' },
        specimenId: 'specimen-serum',
        diagnosticReportId: 'report-metabolic',
        issuedAt: '2026-08-10T10:30:00.000Z',
    });

    record.resources.diagnosticReports.push({
        ...base('report-metabolic', 'DiagnosticReport'),
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: {
            text: 'Basic metabolic panel',
            coding: [{
                system: FHIR_SYSTEMS.loinc,
                code: '51990-0',
                display: 'Basic metabolic panel',
            }],
        },
        effectivePeriod: {
            start: { value: '2026-08-10', precision: 'day' },
            end: { value: '2026-08-10', precision: 'day' },
        },
        issuedAt: '2026-08-10T10:30:00.000Z',
        resultIds: ['observation-creatinine'],
        specimenIds: ['specimen-serum'],
        documentIds: [],
        conclusion: 'Synthetic normal creatinine result.',
    });

    record.updatedAt = NOW;
    return record;
};

const targetRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: TARGET_PATIENT_ID,
        displayName: 'Noura Hassan',
        now: NOW,
        dateOfBirth: { value: '1994-05-21', precision: 'day' },
        administrativeSex: 'female',
        preferredLanguage: 'en',
    });
    record.profile.identifiers.push({
        system: IDENTIFIER_SYSTEM,
        value: IDENTIFIER_VALUE,
        type: 'Medical record number',
        use: 'official',
    });
    record.updatedAt = NOW;
    return record;
};

const documentBundle = () => buildIpsDocument(
    sourceRecord(),
    NOW,
).bundle;

const acknowledgement = (preview: AtomicIpsImportPreview) => ({
    confirmed: true,
    targetPatientId: TARGET_PATIENT_ID,
    sourceSha256: preview.source!.sha256,
    acknowledgedAt: '2026-08-15T09:05:00.000Z',
});

const prepare = async (
    raw: string,
    record = targetRecord(),
    importedAt = IMPORTED_AT,
) => prepareAtomicIpsImport({
    input: raw,
    targetRecord: record,
    importedAt,
    fileName: 'received-ips.json',
    mimeType: 'application/fhir+json',
});

describe('P1.3 atomic source-preserving IPS import', () => {
    it('maps only the Composition-reachable graph and preserves the exact received source', async () => {
        const bundle = documentBundle();
        const patientFullUrl = bundle.entry.find(entry =>
            entry.resource.resourceType === 'Patient')!.fullUrl;
        bundle.entry.push({
            fullUrl: 'urn:uuid:unrelated-condition',
            resource: {
                resourceType: 'Condition',
                id: 'unrelated-condition',
                meta: { profile: [IPS_PROFILES.condition] },
                clinicalStatus: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                        code: 'active',
                    }],
                },
                verificationStatus: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                        code: 'confirmed',
                    }],
                },
                code: { text: 'Unrelated condition must not be mapped' },
                subject: { reference: patientFullUrl },
            },
        });
        const raw = JSON.stringify(bundle, null, 2);

        const preview = await prepare(raw);

        expect(preview.validation.valid).toBe(true);
        expect(preview.commitReady).toBe(true);
        expect(preview.graph?.droppedEntryCount).toBe(1);
        expect(preview.graph?.droppedSupportedResourceTypes.Condition).toBe(1);
        expect(preview.candidates.some(candidate =>
            candidate.provenance.source.externalId
                === 'urn:uuid:unrelated-condition')).toBe(false);
        expect(preview.source?.text).toBe(raw);
        expect(preview.source?.byteLength).toBe(
            new TextEncoder().encode(raw).byteLength,
        );
        expect(preview.source?.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(preview.source?.id.startsWith(
            ENCRYPTED_SOURCE_STORAGE_PREFIX,
        )).toBe(true);
        expect(preview.candidates.every(candidate =>
            candidate.provenance.source.document?.documentId
                === preview.sourceDocumentId)).toBe(true);
    });

    it('requires exact-source identity acknowledgement and returns one validated replacement record', async () => {
        const current = targetRecord();
        const preview = await prepare(
            serializeIpsBundle(documentBundle()),
            current,
        );

        const blocked = commitAtomicIpsImport({
            currentRecord: current,
            preview,
            identityAcknowledgement: {
                ...acknowledgement(preview),
                confirmed: false,
            },
        });
        expect(blocked.status).toBe('identity-not-acknowledged');
        expect(flattenPatientResources(current)).toHaveLength(0);

        const committed = commitAtomicIpsImport({
            currentRecord: current,
            preview,
            identityAcknowledgement: acknowledgement(preview),
        });
        expect(committed.ok).toBe(true);
        expect(committed.status).toBe('committed');
        expect(committed.record).toBeDefined();
        expect(flattenPatientResources(current)).toHaveLength(0);

        const next = committed.record!;
        const source = next.resources.documents.find(document =>
            document.id === preview.sourceDocumentId);
        expect(source?.hash).toBe(`sha256:${preview.source?.sha256}`);
        expect(source?.storageId).toBe(preview.source?.id);
        expect(source?.verificationStatus).toBe('candidate');
        expect(JSON.parse(source!.description!).importId).toBe(
            preview.importId,
        );

        const candidates = flattenPatientResources(next)
            .filter(resource =>
                resource.resourceType !== 'DocumentReference');
        expect(candidates).toHaveLength(committed.createdCandidates);
        expect(candidates.every(resource =>
            resource.verificationStatus === 'candidate'
            && resource.provenance.source.document?.documentId
                === source?.id)).toBe(true);

        const report = next.resources.diagnosticReports[0];
        const result = next.resources.observations.find(observation =>
            report.resultIds.includes(observation.id));
        expect(result?.diagnosticReportId).toBe(report.id);
        expect(next.resources.specimens.some(specimen =>
            report.specimenIds.includes(specimen.id))).toBe(true);
    });

    it('fails closed when a reachable clinical resource belongs to another Bundle patient', async () => {
        const bundle = documentBundle();
        const condition = bundle.entry.find(entry =>
            entry.resource.resourceType === 'Condition')!;
        const otherPatientFullUrl = 'urn:uuid:other-bundle-patient';
        bundle.entry.push({
            fullUrl: otherPatientFullUrl,
            resource: {
                resourceType: 'Patient',
                id: 'other-bundle-patient',
                meta: { profile: [IPS_PROFILES.patient] },
                name: [{ text: 'Different Patient' }],
                birthDate: '1980-01-01',
                gender: 'unknown',
            },
        });
        (condition.resource as Record<string, unknown>).subject = {
            reference: otherPatientFullUrl,
        };

        const preview = await prepare(JSON.stringify(bundle));

        expect(preview.validation.valid).toBe(true);
        expect(preview.commitReady).toBe(false);
        expect(preview.candidates).toHaveLength(0);
        expect(preview.safetyIssues.some(issue =>
            issue.code === 'cross-patient-reference'
            && issue.severity === 'error')).toBe(true);
    });

    it('resolves referenced Medication content without guessing a concept', async () => {
        const bundle = documentBundle();
        const statementEntry = bundle.entry.find(entry =>
            entry.resource.resourceType === 'MedicationStatement')!;
        const statement = statementEntry.resource as Record<string, unknown>;
        const medicationCode = statement.medicationCodeableConcept;
        delete statement.medicationCodeableConcept;
        statement.medicationReference = {
            reference: 'urn:uuid:referenced-medication',
        };
        bundle.entry.push({
            fullUrl: 'urn:uuid:referenced-medication',
            resource: {
                resourceType: 'Medication',
                id: 'referenced-medication',
                code: medicationCode,
            },
        });

        const preview = await prepare(JSON.stringify(bundle));

        expect(preview.commitReady).toBe(true);
        const medication = preview.candidates.find(candidate =>
            candidate.resourceType === 'Medication');
        expect(medication?.resourceType).toBe('Medication');
        if (medication?.resourceType === 'Medication') {
            expect(medication.medication.text).toContain('Amlodipine');
            expect(medication.medication.coding?.[0]?.code).toBe('308135');
        }
        expect(preview.safetyIssues.some(issue =>
            issue.code === 'medication-reference-unresolved')).toBe(false);
    });

    it('invalidates a stale preview and treats the same preserved source as idempotent', async () => {
        const raw = serializeIpsBundle(documentBundle());
        const current = targetRecord();
        const preview = await prepare(raw, current);
        const staleRecord = {
            ...current,
            updatedAt: '2026-08-15T09:01:00.000Z',
        };
        expect(commitAtomicIpsImport({
            currentRecord: staleRecord,
            preview,
            identityAcknowledgement: acknowledgement(preview),
        }).status).toBe('record-changed');

        const first = commitAtomicIpsImport({
            currentRecord: current,
            preview,
            identityAcknowledgement: acknowledgement(preview),
        });
        expect(first.status).toBe('committed');

        const repeatedPreview = await prepare(
            raw,
            first.record!,
            '2026-08-15T10:00:00.000Z',
        );
        const repeated = commitAtomicIpsImport({
            currentRecord: first.record!,
            preview: repeatedPreview,
            identityAcknowledgement: acknowledgement(repeatedPreview),
        });
        expect(repeated.ok).toBe(true);
        expect(repeated.status).toBe('duplicate-source');
        expect(repeated.record).toBeUndefined();
    });

    it('links a source-preserving re-import to existing equivalent candidates instead of duplicating its graph', async () => {
        const bundle = documentBundle();
        const compact = JSON.stringify(bundle);
        const current = targetRecord();
        const firstPreview = await prepare(compact, current);
        const first = commitAtomicIpsImport({
            currentRecord: current,
            preview: firstPreview,
            identityAcknowledgement: acknowledgement(firstPreview),
        });
        expect(first.status).toBe('committed');

        const textuallyDifferentSource = JSON.stringify(bundle, null, 2);
        const secondPreview = await prepare(
            textuallyDifferentSource,
            first.record!,
            '2026-08-15T10:00:00.000Z',
        );
        expect(secondPreview.source?.sha256).not.toBe(
            firstPreview.source?.sha256,
        );
        const second = commitAtomicIpsImport({
            currentRecord: first.record!,
            preview: secondPreview,
            identityAcknowledgement: acknowledgement(secondPreview),
        });

        expect(second.status).toBe('committed');
        expect(second.createdCandidates).toBe(0);
        expect(second.duplicateCandidates).toBe(
            secondPreview.candidates.length,
        );
        expect(second.record?.resources.documents).toHaveLength(2);
        const secondDocument = second.record?.resources.documents.find(
            document => document.id === secondPreview.sourceDocumentId,
        );
        expect(secondDocument?.relatedResources).toHaveLength(
            new Set(secondPreview.candidates.map(candidate =>
                candidate.id)).size,
        );
        expect(secondDocument?.relatedResources.every(reference =>
            flattenPatientResources(first.record!).some(resource =>
                resource.id === reference.id))).toBe(true);
    });

    it('rejects sources above the protected evidence limit before commit', async () => {
        const raw = serializeIpsBundle(documentBundle())
            + ' '.repeat(MAX_PRESERVED_IPS_SOURCE_BYTES + 1);
        const preview = await prepare(raw);

        expect(preview.validation.valid).toBe(true);
        expect(preview.source).toBeUndefined();
        expect(preview.commitReady).toBe(false);
        expect(preview.safetyIssues.some(issue =>
            issue.code === 'source-size-limit')).toBe(true);
    });
});
