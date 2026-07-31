import { describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type ClinicalRecordResource,
} from '../features/clinical-record';
import {
    buildClinicalNotesModuleViewModel,
    buildDocumentsModuleViewModel,
    buildEncounterModuleViewModel,
    buildImmunizationModuleViewModel,
    buildProcedureModuleViewModel,
} from '../features/personal-health-record';
import {
    FIXED_TIME,
    clinicalDay,
    makePatientRecord,
    unknownClinicalDate,
} from './fixtures';

const confirmedBase = (
    id: string,
    patientId = 'patient-1',
) => ({
    id,
    patientId,
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
            description: 'Longitudinal module test fixture',
        },
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
        confirmation: {
            reviewedAt: FIXED_TIME,
            reviewedBy: 'test-user',
            reason: 'Confirmed test record',
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

describe('visits and encounters module', () => {
    it('links confirmed notes, procedures, reports, and documents while preserving unknown encounter dates', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('encounter-1'),
            resourceType: 'Encounter',
            status: 'finished',
            encounterClass: 'ambulatory',
            type: { text: 'Cardiology follow-up' },
            period: {
                start: unknownClinicalDate('Date not visible'),
            },
            reason: [{ text: 'Chest discomfort follow-up' }],
            participants: [{ person: 'Dr Example', role: { text: 'Cardiologist' } }],
            location: 'Outpatient clinic',
            serviceProvider: 'Example Hospital',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('note-1'),
            resourceType: 'ClinicalNote',
            status: 'final',
            noteType: 'visit-note',
            title: 'Cardiology follow-up note',
            authoredAt: FIXED_TIME,
            encounterId: 'encounter-1',
            sections: [{ title: 'Assessment', text: 'Stable symptoms.' }],
            sourceDocumentIds: [],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('procedure-1'),
            resourceType: 'Procedure',
            status: 'completed',
            code: { text: 'Electrocardiogram' },
            encounterId: 'encounter-1',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('report-1'),
            resourceType: 'DiagnosticReport',
            status: 'final',
            code: { text: 'ECG report' },
            resultIds: [],
            specimenIds: [],
            documentIds: ['document-1'],
            encounterId: 'encounter-1',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('document-1'),
            resourceType: 'DocumentReference',
            status: 'current',
            storageId: 'file-1',
            fileName: 'cardiology-note.pdf',
            mimeType: 'application/pdf',
            uploadedAt: FIXED_TIME,
            relatedResources: [{ resourceType: 'Encounter', id: 'encounter-1' }],
        }));

        const view = buildEncounterModuleViewModel(record);
        expect(view.items).toHaveLength(1);
        expect(view.items[0]).toMatchObject({
            title: 'Cardiology follow-up',
            knownClinicalDate: false,
            periodLabel: 'Clinical date unknown',
        });
        expect(view.items[0].linkedNotes.map(item => item.id)).toEqual(['note-1']);
        expect(view.items[0].linkedProcedures.map(item => item.id)).toEqual(['procedure-1']);
        expect(view.items[0].linkedReports.map(item => item.id)).toEqual(['report-1']);
        expect(view.items[0].linkedDocuments.map(item => item.id)).toEqual(['document-1']);
    });
});

describe('clinical notes module', () => {
    it('preserves full sections and the encounter relationship outside chat', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('encounter-2'),
            resourceType: 'Encounter',
            status: 'finished',
            encounterClass: 'virtual',
            type: { text: 'Telehealth review' },
            period: { start: clinicalDay('2026-07-20') },
            participants: [],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('note-2'),
            resourceType: 'ClinicalNote',
            status: 'final',
            noteType: 'soap',
            title: 'Reviewed SOAP note',
            authoredAt: FIXED_TIME,
            author: 'Local user',
            encounterId: 'encounter-2',
            sections: [
                { title: 'Subjective', text: 'Patient reports improvement.' },
                { title: 'Assessment', text: 'Symptoms improving.' },
                { title: 'Plan', text: 'Continue follow-up.' },
            ],
            sourceDocumentIds: ['transcript-1'],
            transcriptDocumentId: 'transcript-1',
        }));

        const view = buildClinicalNotesModuleViewModel(record);
        expect(view.items[0].sections.map(section => section.title)).toEqual([
            'Subjective',
            'Assessment',
            'Plan',
        ]);
        expect(view.items[0].encounter).toMatchObject({
            id: 'encounter-2',
            label: 'Telehealth review',
        });
        expect(view.items[0].transcriptDocumentId).toBe('transcript-1');
    });
});

describe('procedures and device-related evidence module', () => {
    it('finds confirmed device-related procedure and document evidence without claiming a device inventory', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('procedure-stent'),
            resourceType: 'Procedure',
            status: 'completed',
            code: { text: 'Coronary stent placement' },
            performed: clinicalDay('2024-03-12'),
            bodySite: [{ text: 'Coronary artery' }],
            outcome: { text: 'Stent deployed successfully' },
            performer: ['Interventional cardiology team'],
            note: 'Implant details are in the operative report.',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('document-device'),
            resourceType: 'DocumentReference',
            status: 'current',
            storageId: 'device-file',
            fileName: 'pacemaker-device-card.pdf',
            mimeType: 'application/pdf',
            title: 'Pacemaker device card',
            authoredOn: unknownClinicalDate('Date absent'),
            uploadedAt: FIXED_TIME,
            relatedResources: [],
        }));

        const view = buildProcedureModuleViewModel(record);
        expect(view.items[0]).toMatchObject({
            name: 'Coronary stent placement',
            deviceRelated: true,
            knownClinicalDate: true,
        });
        expect(view.items[0].matchedDeviceTerms).toContain('stent');
        expect(view.deviceRelatedRecords.map(item => item.sourceType)).toEqual([
            'procedure',
            'document',
        ]);
        expect(view.deviceRelatedRecords[1]).toMatchObject({
            label: 'Pacemaker device card',
            knownClinicalDate: false,
            dateLabel: 'Clinical date unknown',
        });
    });
});

describe('immunization module', () => {
    it('preserves vaccine lot, dose, route, and an explicitly unknown occurrence date', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('immunization-1'),
            resourceType: 'Immunization',
            status: 'completed',
            vaccineCode: { text: 'Influenza vaccine' },
            occurrence: unknownClinicalDate('Date not recorded'),
            lotNumber: 'LOT-123',
            manufacturer: 'Example Manufacturer',
            doseQuantity: {
                original: { value: 0.5, unit: 'mL' },
            },
            site: { text: 'Left deltoid' },
            route: { text: 'Intramuscular' },
            performer: 'Example Clinic',
        }));

        const view = buildImmunizationModuleViewModel(record);
        expect(view.items[0]).toMatchObject({
            vaccine: 'Influenza vaccine',
            occurrenceLabel: 'Clinical date unknown',
            knownClinicalDate: false,
            lotNumber: 'LOT-123',
            dose: '0.5 mL',
            route: 'Intramuscular',
        });
        expect(view.unknownDateCount).toBe(1);
    });
});

describe('document library module', () => {
    it('keeps authored date separate from upload time and resolves related records explicitly', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('procedure-2'),
            resourceType: 'Procedure',
            status: 'completed',
            code: { text: 'Appendectomy' },
            performed: clinicalDay('2020-02-02'),
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('document-2'),
            resourceType: 'DocumentReference',
            status: 'current',
            storageId: 'operative-file',
            fileName: 'operative-report.pdf',
            mimeType: 'application/pdf',
            title: 'Operative report',
            documentType: { text: 'Surgical report' },
            authoredOn: unknownClinicalDate('Date illegible'),
            uploadedAt: FIXED_TIME,
            pageCount: 4,
            relatedResources: [
                { resourceType: 'Procedure', id: 'procedure-2' },
                { resourceType: 'Encounter', id: 'missing-encounter' },
            ],
        }));

        const view = buildDocumentsModuleViewModel(record);
        expect(view.items[0]).toMatchObject({
            title: 'Operative report',
            authoredLabel: 'Clinical date unknown',
            knownClinicalDate: false,
            mimeFamily: 'PDF',
            pageCount: 4,
        });
        expect(view.items[0].uploadedLabel).not.toBe('Clinical date unknown');
        expect(view.items[0].relatedResources[0]).toMatchObject({
            id: 'procedure-2',
            label: 'Appendectomy',
            missing: undefined,
        });
        expect(view.items[0].relatedResources[1]).toMatchObject({
            id: 'missing-encounter',
            missing: true,
        });
    });
});
