import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Phase 5 medication reconciliation workspace', () => {
    const workspace = readFileSync(
        'features/medication-reconciliation/components/MedicationReconciliationWorkspace.tsx',
        'utf8',
    );
    const healthData = readFileSync(
        'features/personal-health-record/components/HealthDataWorkspace.tsx',
        'utf8',
    );
    const engine = readFileSync(
        'features/medication-reconciliation/reconciliation.ts',
        'utf8',
    );

    it('exposes a dedicated Health Data destination and pending-review badge', () => {
        expect(healthData).toContain("value: 'medication-reconciliation'");
        expect(healthData).toContain('MedicationReconciliationWorkspace');
        expect(healthData).toContain('reconciliation.unreviewedCount');
        expect(healthData).toContain('reconciliation.actionPendingCount');
        expect(healthData).toContain('reconciliation.candidateMedicationCount');
    });

    it('requires a reason and never presents reconciliation as an automatic medication edit', () => {
        expect(workspace).toContain('A review reason is required');
        expect(workspace).toContain('No automatic medication changes');
        expect(workspace).toContain('Use Manage Records separately');
        expect(workspace).toContain('No medication status, directions, dates, or confirmed facts were changed.');
        expect(workspace).not.toContain("amendResource(");
        expect(workspace).not.toContain("markResourceEnteredInError(");
    });

    it('keeps medication source kinds distinct and creates proposal tasks only', () => {
        expect(engine).toContain("leftRecord.kind !== rightRecord.kind");
        expect(engine).toContain("type: 'cross-kind-context'");
        expect(engine).toContain("intent: 'proposal'");
        expect(engine).toContain("'not-an-order'");
        expect(engine).toContain('not a prescription');
    });

    it('keeps original source review available for every source-linked medication', () => {
        expect(workspace).toContain('DocumentSourcePreview');
        expect(workspace).toContain('View original source');
        expect(workspace).toContain('sourceDocument');
        expect(workspace).toContain('amendmentCount');
    });
});
