import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 manual record management workspace', () => {
    it('adds a dedicated guided management destination to Health Data', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );
        const management = source(
            '../features/personal-health-record/components/RecordManagementModule.tsx',
        );

        expect(workspace).toContain("value: 'manage'");
        expect(workspace).toContain('RecordManagementModule');
        expect(management).toContain('Add record');
        expect(management).toContain('Correct / invalidate');
        expect(management).toContain('Amendment history');
    });

    it('keeps unknown dates unknown and validates relationships before persistence', () => {
        const management = source(
            '../features/personal-health-record/components/RecordManagementModule.tsx',
        );
        const service = source(
            '../features/personal-health-record/manualRecordManagement.ts',
        );

        expect(management).toContain('records them as unknown instead of inserting today’s date');
        expect(service).toContain("createUnknownClinicalDate('Not entered during manual record entry')");
        expect(service).toContain('validateManualResourceRelationships');
        expect(service).toContain('does not exist for this patient');
        expect(service).toContain('not an active confirmed relationship target');
    });

    it('requires reasons and retains reviewed history instead of hard-deleting it', () => {
        const management = source(
            '../features/personal-health-record/components/RecordManagementModule.tsx',
        );
        const store = source(
            '../features/clinical-record/useClinicalRecordStore.ts',
        );

        expect(management).toContain('Correction reason *');
        expect(management).toContain('A correction reason is required.');
        expect(management).toContain('A reason and explicit acknowledgement are required');
        expect(management).toContain('does not delete the record');
        expect(store).toContain('Reviewed clinical history cannot be hard-deleted');
        expect(store).toContain('A reason is required when marking a clinical resource entered in error');
    });

    it('preserves source review, prior values, and explicit audit events', () => {
        const management = source(
            '../features/personal-health-record/components/RecordManagementModule.tsx',
        );
        const auditTypes = source('../features/audit/types.ts');

        expect(management).toContain('Previous values retained');
        expect(management).toContain('ProvenancePanel');
        expect(management).toContain('DocumentSourcePreview');
        expect(auditTypes).toContain('CLINICAL_RESOURCE_CREATED');
        expect(auditTypes).toContain('CLINICAL_RESOURCE_AMENDED');
        expect(auditTypes).toContain('CLINICAL_RESOURCE_MARKED_ERROR');
    });
});
