import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string => fs.readFileSync(
    path.join(process.cwd(), relativePath),
    'utf8',
);

describe('Phase 5 final workspace integration contracts', () => {
    it('exposes reviewed low-risk rules, evidence, and patient-scoped audit review', () => {
        const container = read('features/cdss/CDSSContainer.tsx');
        const workspace = read('features/cdss/components/ValidatedRulesAuditWorkspace.tsx');
        const registry = read('features/cdss/validatedRules.ts');
        const auditTypes = read('features/audit/types.ts');

        expect(container).toContain('Rules & audit');
        expect(container).toContain('<ValidatedRulesAuditWorkspace');
        expect(container).toContain('validatedReview.unreviewedCount');
        expect(workspace).toContain('Current advisories');
        expect(workspace).toContain('Reviewed registry');
        expect(workspace).toContain('Phase 5 audit');
        expect(workspace).toContain('AUDIT_REVIEW_EXPORTED');
        expect(workspace).toContain('not anonymous or PHI-free');
        expect(workspace).toContain('Diagnosis, treatment, prescribing');
        expect(registry).toContain('...LOW_RISK_VALIDATED_RULES');
        expect(registry).not.toContain(
            'VALIDATED_RULE_REGISTRY: ValidatedClinicalRuleDefinition<any>[] = []',
        );
        expect(auditTypes).toContain("'VALIDATED_RULE_SET_EVALUATED'");
        expect(auditTypes).toContain("'AUDIT_REVIEW_EXPORTED'");
    });

    it('opens exact confirmed local evidence and original source previews', () => {
        const workspace = read('features/cdss/components/ValidatedRulesAuditWorkspace.tsx');
        const drawer = read('features/grounded-assistance/components/LocalEvidenceDrawer.tsx');
        const resolver = read('features/grounded-assistance/evidenceReview.ts');
        const orchestrator = read('features/chat/hooks/useChatOrchestrator.ts');

        expect(workspace).toContain('VALIDATED_ADVISORY_EVIDENCE_REVIEWED');
        expect(workspace).toContain('GROUNDED_EVIDENCE_REVIEWED');
        expect(workspace).toContain('referencedEvidenceIds');
        expect(drawer).toContain(
            'Evidence identifiers and bundle membership are checked locally',
        );
        expect(drawer).toContain('DocumentSourcePreview');
        expect(drawer).toContain('CLINICAL_SOURCE_VIEWED');
        expect(resolver).toContain('buildPatientGroundingBundle');
        expect(resolver).toContain('flattenPatientResources');
        expect(resolver).toContain('includeHistory: true');
        expect(orchestrator).toContain('referencedEvidenceIds');
    });

    it('keeps durable decisions non-mutating, reasoned, and proposal-only', () => {
        const workspace = read('features/cdss/components/ValidatedRulesAuditWorkspace.tsx');
        const task = read('features/cdss/validatedRuleReview.ts');
        const pilots = read('features/cdss/lowRiskPilotRules.ts');

        expect(workspace).toContain(
            'A required reason makes the decision auditable',
        );
        expect(workspace).toContain('VALIDATED_ADVISORY_ACKNOWLEDGED');
        expect(workspace).toContain('VALIDATED_ADVISORY_TASK_CREATED');
        expect(task).toContain("priority: 'routine'");
        expect(task).toContain('does not send a notification');
        expect(task).toContain('assign clinical urgency');
        expect(pilots).toContain('isIntentionalReviewProposal');
        expect(pilots).toContain("(task.tags || []).includes('not-an-order')");
        expect(pilots).toContain('&& !isIntentionalReviewProposal(task)');
        expect(workspace).not.toContain('amendResource(');
        expect(workspace).not.toContain('markResourceEnteredInError(');
    });

    it('commits a PHI-free regression corpus with twelve contract cases', () => {
        const corpus = JSON.parse(read(
            'evaluation/phase5/low_risk_rule_pilots_v1.json',
        ));
        expect(corpus).toMatchObject({
            schemaVersion: 1,
            corpusId: 'medibrief-phase5-low-risk-rule-pilots-v1',
            phiFree: true,
        });
        expect(corpus.cases).toHaveLength(12);
        expect(JSON.stringify(corpus).toLowerCase()).toContain('synthetic');
    });
});
