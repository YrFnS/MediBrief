import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../features/chat/stores/useChatStore';
import {
    createAdvisoryTaskRecord,
    createProposedAppointmentRecord,
    createReviewedSoapNoteRecord,
    useClinicalRecordStore,
} from '../features/clinical-record';
import { FIXED_TIME } from './fixtures';

describe('chat-independent durable records', () => {
    beforeEach(() => {
        useChatStore.setState({ chats: {} });
        useClinicalRecordStore.setState({ records: {} });
    });

    it('keeps notes, tasks, and appointment proposals after chat is cleared', () => {
        const chatActions = useChatStore.getState().actions;
        const recordActions = useClinicalRecordStore.getState().actions;
        recordActions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });
        chatActions.initializeChat('patient-1');
        chatActions.addMessage('patient-1', {
            role: 'model',
            content: 'Temporary notification',
        });

        const note = createReviewedSoapNoteRecord({
            patientId: 'patient-1',
            subjective: 'Reviewed note',
            authoredAt: FIXED_TIME,
        });
        const task = createAdvisoryTaskRecord({
            patientId: 'patient-1',
            advisoryTitle: 'Reminder',
            actionLabel: 'Follow up',
            createdAt: FIXED_TIME,
        });
        const appointment = createProposedAppointmentRecord({
            patientId: 'patient-1',
            date: '2026-08-15',
            time: '10:00',
            createdAt: FIXED_TIME,
        }).record;

        recordActions.addResource(note);
        recordActions.addResource(task);
        recordActions.addResource(appointment);
        chatActions.resetChat('patient-1');

        expect(useChatStore.getState().chats['patient-1']).toEqual([]);
        const record = useClinicalRecordStore.getState().records['patient-1'];
        expect(record.resources.notes.map(item => item.id)).toEqual([note.id]);
        expect(record.resources.tasks.map(item => item.id)).toEqual([task.id]);
        expect(record.resources.appointments.map(item => item.id))
            .toEqual([appointment.id]);
    });
});
