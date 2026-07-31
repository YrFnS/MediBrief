import { describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type ClinicalRecordResource,
} from '../features/clinical-record';
import {
    buildCompletePatientSummary,
    createCompletePatientSummaryHtml,
    createCompletePatientSummaryJson,
    searchPatientRecord,
} from '../features/personal-health-record';
import {
    FIXED_TIME,
    makeCondition,
    makeObservation,
    makePatientRecord,
    unknownClinicalDate,
} from './fixtures';

const confirmedBase = (id: string) => ({
    id,
    patientId: 'patient-1',
    verificationStatus: 'confirmed' as const,
    recordedAt: FIXED_TIME,
    assertion: {
        polarity: 'affirmed' as const,
        certainty: 'certain' as const,
        temporality: 'current' as const,
        experiencer: 'patient' as const,
    },
    provenance: {
        source: {
            kind: 'manual' as const,
            description: 'Record search fixture',
        },
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
        confirmation: {
            reviewedAt: FIXED_TIME,
            reviewedBy: 'test-user',
            reason: 'Confirmed test resource',
        },
    },
    amendments: [],
});

const add = (
    record: ReturnType<typeof makePatientRecord>,
    resource: ClinicalRecordResource,
): void => {
    switch (resource.resourceType) {
        case 'PatientProfile':
            record.profile = resource;
            return;
        case 'Encounter':
            record.resources.encounters.push(resource);
            return;
        case 'Condition':
            record.resources.conditions.push(resource);
            return;
        case 'AllergyIntolerance':
            record.resources.allergies.push(resource);
            return;
        case 'Medication':
            record.resources.medications.push(resource);
            return;
        case 'Observation':
            record.resources.observations.push(resource);
            return;
        case 'DiagnosticReport':
            record.resources.diagnosticReports.push(resource);
            return;
        case 'Specimen':
            record.resources.specimens.push(resource);
            return;
        case 'Procedure':
            record.resources.procedures.push(resource);
            return;
        case 'Immunization':
            record.resources.immunizations.push(resource);
            return;
        case 'Appointment':
            record.resources.appointments.push(resource);
            return;
        case 'ClinicalTask':
            record.resources.tasks.push(resource);
            return;
        case 'CarePlan':
            record.resources.carePlans.push(resource);
            return;
        case 'DocumentReference':
            record.resources.documents.push(resource);
            return;
        case 'ClinicalNote':
            record.resources.notes.push(resource);
            return;
    }
};

describe('record-wide search', () => {
    it('defaults to confirmed resources and searches deep structured note text', () => {
        const record = makePatientRecord();
        add(record, makeCondition({
            id: 'confirmed-asthma',
            verificationStatus: 'confirmed',
            text: 'Asthma',
        }));
        add(record, makeCondition({
            id: 'candidate-asthma',
            verificationStatus: 'candidate',
            text: 'Possible occupational asthma',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('note-1'),
            resourceType: 'ClinicalNote',
            status: 'final',
            noteType: 'visit-note',
            title: 'Respiratory follow-up',
            authoredAt: FIXED_TIME,
            sections: [{
                title: 'History',
                text: 'Persistent nocturnal cough after workplace exposure.',
            }],
            sourceDocumentIds: [],
        }));

        const defaultResults = searchPatientRecord(record, {
            query: 'asthma',
        });
        expect(defaultResults.items.map(item => item.id))
            .toEqual(['confirmed-asthma']);

        const noteResults = searchPatientRecord(record, {
            query: 'nocturnal workplace',
        });
        expect(noteResults.items).toHaveLength(1);
        expect(noteResults.items[0]).toMatchObject({
            id: 'note-1',
            resourceType: 'ClinicalNote',
            verificationStatus: 'confirmed',
        });

        const candidateResults = searchPatientRecord(record, {
            query: 'occupational asthma',
            verificationStatus: 'candidate',
        });
        expect(candidateResults.items.map(item => item.id))
            .toEqual(['candidate-asthma']);
    });

    it('keeps explicitly unknown dates searchable without presenting storage time as the event date', () => {
        const record = makePatientRecord();
        add(record, makeObservation({
            id: 'unknown-weight',
            code: 'Body weight',
            value: 70,
            unit: 'kg',
            effective: unknownClinicalDate('Date not present in source'),
        }));
        add(record, makeObservation({
            id: 'dated-heart-rate',
            code: 'Heart rate',
            value: 72,
            unit: 'bpm',
        }));

        const undated = searchPatientRecord(record, {
            dateState: 'undated',
        });
        expect(undated.items.map(item => item.id)).toEqual(['unknown-weight']);
        expect(undated.items[0]).toMatchObject({
            knownClinicalDate: false,
            clinicalDateLabel: 'Clinical date unknown',
        });

        const dated = searchPatientRecord(record, {
            dateState: 'dated',
            resourceType: 'Observation',
        });
        expect(dated.items.map(item => item.id)).toEqual(['dated-heart-rate']);
    });
});

describe('complete patient-summary export', () => {
    it('exports every confirmed patient-applicable resource while excluding review and error history', () => {
        const record = makePatientRecord();
        add(record, makeCondition({
            id: 'confirmed-condition',
            verificationStatus: 'confirmed',
            text: 'Hypertension',
        }));
        add(record, makeCondition({
            id: 'candidate-condition',
            verificationStatus: 'candidate',
            text: 'Candidate-only finding',
        }));
        add(record, makeObservation({
            id: 'unknown-result',
            code: 'Example analyte',
            value: 42,
            unit: 'mg/dL',
            effective: unknownClinicalDate('Result date not shown'),
        }));

        const summary = buildCompletePatientSummary(
            record,
            '2026-07-31T12:00:00.000Z',
        );
        expect(summary).toMatchObject({
            format: 'medibrief-complete-patient-summary',
            version: 1,
            generatedAt: '2026-07-31T12:00:00.000Z',
            confirmedResourceCount: 2,
            scope: {
                verification: 'confirmed',
                candidatesIncluded: false,
                rejectedIncluded: false,
                enteredInErrorIncluded: false,
            },
            excludedHistoryCounts: {
                candidate: 1,
            },
        });

        const exportedIds = summary.sections
            .flatMap(section => section.resources)
            .map(item => item.id);
        expect(exportedIds).toContain('confirmed-condition');
        expect(exportedIds).toContain('unknown-result');
        expect(exportedIds).not.toContain('candidate-condition');

        const observation = summary.sections
            .find(section => section.resourceType === 'Observation')
            ?.resources[0];
        expect(observation).toMatchObject({
            clinicalDateLabel: 'Clinical date unknown',
            knownClinicalDate: false,
        });
        expect(observation?.resource).toMatchObject({
            value: {
                type: 'quantity',
                quantity: {
                    original: {
                        value: 42,
                        unit: 'mg/dL',
                    },
                },
            },
        });
    });

    it('produces deterministic JSON and escaped self-contained HTML without leaking candidates', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('note-export'),
            resourceType: 'ClinicalNote',
            status: 'final',
            noteType: 'patient-note',
            title: 'Patient <script>alert(1)</script> note',
            authoredAt: FIXED_TIME,
            sections: [{ title: 'Text', text: 'Confirmed content' }],
            sourceDocumentIds: [],
        }));
        add(record, makeCondition({
            id: 'candidate-secret',
            verificationStatus: 'candidate',
            text: 'Candidate secret text',
        }));

        const summary = buildCompletePatientSummary(
            record,
            '2026-07-31T12:00:00.000Z',
        );
        const json = createCompletePatientSummaryJson(summary);
        const html = createCompletePatientSummaryHtml(summary);

        expect(JSON.parse(json)).toMatchObject({
            format: 'medibrief-complete-patient-summary',
            generatedAt: '2026-07-31T12:00:00.000Z',
        });
        expect(json).not.toContain('Candidate secret text');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).not.toContain('Candidate secret text');
        expect(html).toContain('Unknown clinical dates remain unknown');
        expect(html).toContain('No confirmed resource is stored in this section');
    });
});
