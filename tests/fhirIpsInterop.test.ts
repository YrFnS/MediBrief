import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    createClinicalProvenance,
    createPatientClinicalRecord,
    createRecordSource,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildIpsDocument,
    FHIR_SYSTEMS,
    IPS_PROFILES,
    IPS_SECTIONS,
    parseIpsImport,
    serializeIpsBundle,
    validateIpsDocumentBundle,
} from '../features/fhir';

const NOW = '2026-08-14T12:00:00.000Z';
const patientId = 'synthetic-patient-ips';

const provenance = createClinicalProvenance({
    source: createRecordSource({
        kind: 'manual',
        description: 'Synthetic P1 interoperability fixture',
    }),
    now: NOW,
    actor: 'test-suite',
});

const base = (id: string, resourceType: string) => ({
    id,
    patientId,
    resourceType,
    verificationStatus: 'confirmed' as const,
    recordedAt: NOW,
    provenance,
    amendments: [],
});

const syntheticRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId,
        displayName: 'Noura Hassan',
        now: NOW,
        dateOfBirth: { value: '1994-05-21', precision: 'day' },
        administrativeSex: 'female',
        preferredLanguage: 'en',
    });
    record.profile.identifiers.push({
        system: 'urn:oid:2.16.840.1.113883.3.933.1',
        value: 'SYNTHETIC-IPS-001',
        type: 'Medical record number',
        use: 'official',
    });
    record.profile.contacts.push({
        system: 'phone',
        value: '+0000000000',
        use: 'mobile',
    });

    record.resources.conditions.push({
        ...base('condition-active', 'Condition'),
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
        onset: { value: '2022', precision: 'year' },
    });
    record.resources.conditions.push({
        ...base('condition-resolved', 'Condition'),
        resourceType: 'Condition',
        code: { text: 'Resolved ankle sprain' },
        clinicalStatus: 'resolved',
        onset: { value: '2020-02', precision: 'month' },
        abatement: { value: '2020-03', precision: 'month' },
    });
    record.resources.conditions.push({
        ...base('condition-family', 'Condition'),
        resourceType: 'Condition',
        code: { text: 'Family history only — must not export' },
        clinicalStatus: 'active',
        assertion: {
            polarity: 'affirmed',
            certainty: 'certain',
            temporality: 'current',
            experiencer: 'family',
        },
    });
    record.resources.conditions.push({
        ...base('condition-candidate', 'Condition'),
        resourceType: 'Condition',
        verificationStatus: 'candidate',
        code: { text: 'Unreviewed candidate — must not export' },
        clinicalStatus: 'active',
    });

    record.resources.allergies.push({
        ...base('allergy-penicillin', 'AllergyIntolerance'),
        resourceType: 'AllergyIntolerance',
        substance: {
            text: 'Penicillin',
            coding: [{
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '7980',
                display: 'Penicillin',
            }],
        },
        clinicalStatus: 'active',
        criticality: 'high',
        categories: ['medication'],
        reactions: [{
            manifestation: [{ text: 'Rash' }],
            severity: 'moderate',
        }],
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
            route: { text: 'Oral route' },
            frequency: 'once daily',
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
        referenceRanges: [{
            low: {
                value: 0.5,
                unit: 'mg/dL',
                system: FHIR_SYSTEMS.ucum,
                code: 'mg/dL',
            },
            high: {
                value: 1.1,
                unit: 'mg/dL',
                system: FHIR_SYSTEMS.ucum,
                code: 'mg/dL',
            },
        }],
        effective: { value: '2026-08-10', precision: 'day' },
        specimenId: 'specimen-serum',
        diagnosticReportId: 'report-metabolic',
        performer: ['Synthetic laboratory performer'],
        issuedAt: '2026-08-10T10:30:00.000Z',
    });

    record.resources.observations.push({
        ...base('observation-heart-rate', 'Observation'),
        resourceType: 'Observation',
        status: 'final',
        category: [{
            text: 'Vital Signs',
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'vital-signs',
                display: 'Vital Signs',
            }],
        }],
        code: {
            text: 'Heart rate',
            coding: [{
                system: FHIR_SYSTEMS.loinc,
                code: '8867-4',
                display: 'Heart rate',
            }],
        },
        value: {
            type: 'quantity',
            quantity: {
                original: {
                    value: 72,
                    unit: '/min',
                    system: FHIR_SYSTEMS.ucum,
                    code: '/min',
                },
            },
        },
        referenceRanges: [],
        effective: { value: '2026-08-11', precision: 'day' },
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
        category: [{
            text: 'Laboratory',
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'laboratory',
                display: 'Laboratory',
            }],
        }],
        effectivePeriod: {
            start: { value: '2026-08-10', precision: 'day' },
            end: { value: '2026-08-10', precision: 'day' },
        },
        issuedAt: '2026-08-10T10:30:00.000Z',
        resultIds: ['observation-creatinine'],
        specimenIds: ['specimen-serum'],
        documentIds: [],
        performer: ['Synthetic laboratory performer'],
        conclusion: 'Synthetic normal creatinine result.',
    });

    record.resources.procedures.push({
        ...base('procedure-appendectomy', 'Procedure'),
        resourceType: 'Procedure',
        status: 'completed',
        code: {
            text: 'Appendectomy',
            coding: [{
                system: 'http://snomed.info/sct',
                code: '80146002',
                display: 'Appendectomy',
            }],
        },
        performed: { value: '2015', precision: 'year' },
    });

    record.resources.immunizations.push({
        ...base('immunization-influenza', 'Immunization'),
        resourceType: 'Immunization',
        status: 'completed',
        vaccineCode: {
            text: 'Influenza vaccine',
            coding: [{
                system: 'http://hl7.org/fhir/sid/cvx',
                code: '140',
                display: 'Influenza, seasonal, injectable, preservative free',
            }],
        },
        occurrence: { value: '2025-10-02', precision: 'day' },
    });

    record.updatedAt = NOW;
    return record;
};

const sectionCodes = (bundle: ReturnType<typeof buildIpsDocument>['bundle']) => {
    const composition = bundle.entry[0].resource as unknown as {
        section?: Array<{ code?: { coding?: Array<{ code?: string }> } }>;
    };
    return new Set((composition.section || []).flatMap(section =>
        section.code?.coding?.flatMap(coding => coding.code ? [coding.code] : []) || []));
};

describe('FHIR R4 IPS export', () => {
    it('builds a document Bundle with required IPS sections and no candidate leakage', () => {
        const record = syntheticRecord();
        const result = buildIpsDocument(record, NOW);

        expect(result.report.validation.valid).toBe(true);
        expect(result.bundle.type).toBe('document');
        expect(result.bundle.meta.profile).toContain(IPS_PROFILES.bundle);
        expect(result.bundle.entry[0].resource.resourceType).toBe('Composition');
        expect(result.bundle.entry[1].resource.resourceType).toBe('Patient');

        const codes = sectionCodes(result.bundle);
        [
            IPS_SECTIONS.problems.code,
            IPS_SECTIONS.allergies.code,
            IPS_SECTIONS.medicationSummary.code,
            IPS_SECTIONS.immunizations.code,
            IPS_SECTIONS.procedures.code,
            IPS_SECTIONS.results.code,
            IPS_SECTIONS.vitalSigns.code,
            IPS_SECTIONS.pastProblems.code,
        ].forEach(code => expect(codes.has(code)).toBe(true));

        const serialized = serializeIpsBundle(result.bundle);
        expect(serialized).not.toContain('Unreviewed candidate — must not export');
        expect(serialized).not.toContain('Family history only — must not export');
        expect(serialized).toContain('Essential hypertension');
        expect(serialized).toContain('Amlodipine 5 mg tablet');
        expect(serialized).toContain('Creatinine [Mass/volume] in Serum or Plasma');
        expect(serialized).toContain('Heart rate');
        expect(result.report.excludedCounts['vital-sign-structured-deferred'])
            .toBe(1);
        const exportedVitalResource = result.bundle.entry.find(entry =>
            entry.resource.resourceType === 'Observation'
            && JSON.stringify(entry.resource).includes('8867-4'));
        expect(exportedVitalResource).toBeUndefined();
        expect(result.report.excludedCounts.candidate).toBe(1);
        expect(result.report.excludedCounts['non-patient-applicable-assertion']).toBe(1);

        if (process.env.MEDIBRIEF_IPS_FIXTURE) {
            writeFileSync(
                process.env.MEDIBRIEF_IPS_FIXTURE,
                serialized,
                'utf8',
            );
        }
    });

    it('uses unavailable rather than claiming known absence for empty required sections', () => {
        const record = createPatientClinicalRecord({
            patientId: 'empty-confirmed-record',
            displayName: 'Synthetic Empty Record',
            now: NOW,
        });
        const { bundle } = buildIpsDocument(record, NOW);
        const composition = bundle.entry[0].resource as unknown as {
            section: Array<{
                code: { coding: Array<{ code: string }> };
                emptyReason?: { coding?: Array<{ code?: string }> };
                text: { div: string };
            }>;
        };
        const required = composition.section.filter(section => [
            IPS_SECTIONS.problems.code,
            IPS_SECTIONS.allergies.code,
            IPS_SECTIONS.medicationSummary.code,
        ].includes(section.code.coding[0].code));

        expect(required).toHaveLength(3);
        required.forEach(section => {
            expect(section.emptyReason?.coding?.[0]?.code).toBe('unavailable');
            expect(section.text.div).toContain('does not establish clinical absence');
        });
    });
});

describe('FHIR R4 IPS import', () => {
    it('round-trips supported resources as candidates without replacing the patient profile', () => {
        const exported = buildIpsDocument(syntheticRecord(), NOW);
        const preview = parseIpsImport(
            serializeIpsBundle(exported.bundle),
            'different-local-patient',
            '2026-08-14T13:00:00.000Z',
        );

        expect(preview.validation.valid).toBe(true);
        expect(preview.patient?.displayName).toBe('Noura Hassan');
        expect(preview.candidates.length).toBeGreaterThan(0);
        expect(preview.candidates.every(candidate =>
            candidate.patientId === 'different-local-patient'
            && candidate.verificationStatus === 'candidate')).toBe(true);
        expect(preview.candidates.some(candidate =>
            String(candidate.resourceType) === 'PatientProfile')).toBe(false);
        expect(preview.candidates.some(candidate =>
            candidate.resourceType === 'Medication')).toBe(true);
        expect(preview.candidates.some(candidate =>
            candidate.resourceType === 'DiagnosticReport')).toBe(true);
    });

    it('rejects a document Bundle that omits required IPS sections', () => {
        const { bundle } = buildIpsDocument(syntheticRecord(), NOW);
        const clone = JSON.parse(JSON.stringify(bundle));
        clone.entry[0].resource.section = [];

        const validation = validateIpsDocumentBundle(clone);
        expect(validation.valid).toBe(false);
        expect(validation.errors.filter(issue =>
            issue.code === 'required-section')).toHaveLength(3);

        const preview = parseIpsImport(clone, patientId, NOW);
        expect(preview.candidates).toHaveLength(0);
    });
});
