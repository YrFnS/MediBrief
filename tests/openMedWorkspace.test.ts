import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 3 OpenMed workspace contracts', () => {
    it('keeps clinical extraction settings separate from chat-provider settings', () => {
        const settings = source(
            '../features/settings/useSettingsStore.ts',
        );
        const modal = source(
            '../features/settings/SettingsModal.tsx',
        );
        const openMedPanel = source(
            '../features/settings/OpenMedSettingsPanel.tsx',
        );
        const contextStatus = source(
            '../features/settings/OpenMedContextBridgeStatus.tsx',
        );
        const documentStatus = source(
            '../features/settings/OpenMedDocumentBridgeStatus.tsx',
        );

        expect(settings).toContain("extractionMode: 'auto'");
        expect(settings).toContain('openMedBaseUrl');
        expect(settings).toContain('openMedDiseaseModel');
        expect(settings).toContain('openMedMedicationModel');
        expect(settings).toContain('allowGeminiExtractionFallback: false');
        expect(settings).toContain('openMedDocumentExtractionEnabled: true');
        expect(settings).toContain("openMedOcrMode: 'auto'");
        expect(settings).toContain("openMedOcrLanguages: ['en']");
        expect(modal).toContain('Assistant AI');
        expect(modal).toContain('OpenMedSettingsPanel');
        expect(modal).toContain('OpenMedContextBridgeStatus');
        expect(openMedPanel).toContain('Clinical document extraction');
        expect(openMedPanel).toContain('OpenMed only');
        expect(openMedPanel).toContain('Gemini only');
        expect(openMedPanel).toContain('Enable local PDF and image text extraction');
        expect(openMedPanel).toContain('Auto — OCR pages without usable embedded text');
        expect(contextStatus).toContain('Test context bridge');
        expect(contextStatus).toContain('uvicorn openmed_bridge.app:app');
        expect(documentStatus).toContain('Test document bridge');
        expect(documentStatus).toContain('original upload remains authoritative');
    });

    it('never represents OpenMed extraction, OCR, or context as a confirmed patient fact', () => {
        const mapping = source(
            '../features/openmed/candidateMapping.ts',
        );
        const contextReview = source(
            '../features/clinical-record/components/ClinicalContextReview.tsx',
        );

        expect(mapping).toContain("verificationStatus: 'candidate'");
        expect(mapping).toContain("polarity: 'unknown'");
        expect(mapping).toContain("certainty: 'unknown'");
        expect(mapping).toContain("temporality: 'unknown'");
        expect(mapping).toContain("experiencer: 'unknown'");
        expect(mapping).toContain('startOffset: entity.start');
        expect(mapping).toContain('endOffset: entity.end');
        expect(mapping).toContain("externalSystem: 'openmed:rest'");
        expect(mapping).toContain('openMedContextEvidence');
        expect(mapping).toContain('openMedDocumentEvidence');
        expect(mapping).toContain('original uploaded file remains authoritative');
        expect(mapping).not.toContain("verificationStatus: 'confirmed'");
        expect(contextReview).toContain(
            'The main candidate review remains the only confirmation/rejection workflow',
        );
        expect(contextReview).not.toContain('confirmCandidate');
        expect(contextReview).not.toContain('rejectCandidate');
    });

    it('keeps NER, document extraction, and context provenance separate and reviewable', () => {
        const mapping = source(
            '../features/openmed/candidateMapping.ts',
        );
        const contextClient = source(
            '../features/openmed/openMedContextClient.ts',
        );
        const documentClient = source(
            '../features/openmed/openMedDocumentClient.ts',
        );
        const evidence = source(
            '../features/openmed/documentEvidence.ts',
        );
        const workspace = source('../features/layout/Phase2Workspace.tsx');

        expect(mapping).toContain('OpenMed local REST NER');
        expect(mapping).toContain('OpenMed assertion context and medication-sig evidence');
        expect(mapping).toMatch(/page-aware local PDF\/OCR provenance/i);
        expect(mapping).toContain('openmed-context');
        expect(mapping).toContain('openmed-medication-sig');
        expect(mapping).toContain('openmed-document-text');
        expect(contextClient).toContain("path: '/medibrief/context'");
        expect(documentClient).toContain("path: '/medibrief/documents/extract'");
        expect(evidence).toContain('openMedDocumentEvidence');
        expect(workspace).toContain('ClinicalContextReview');
        expect(workspace).toContain('ClinicalCandidateReview');
    });

    it('keeps local OpenMed and cloud Gemini provenance distinguishable', () => {
        const extractionHook = source('../hooks/useEntityExtractor.ts');
        const mapping = source(
            '../features/openmed/candidateMapping.ts',
        );

        expect(mapping).toContain('OpenMed local REST NER');
        expect(mapping).toContain('openmed-extracted');
        expect(extractionHook).toContain(
            'Google Gemini compatibility extraction',
        );
        expect(extractionHook).toContain(
            'medibrief:gemini-entity-extraction',
        );
        expect(extractionHook).toContain('gemini-extracted');
        expect(extractionHook).toContain('separate cloud provenance');
    });

    it('allows fallback only for unsupported or unavailable local extraction after explicit opt-in', () => {
        const extractionHook = source('../hooks/useEntityExtractor.ts');
        const settingsPanel = source(
            '../features/settings/OpenMedSettingsPanel.tsx',
        );

        expect(extractionHook).toContain(
            "openMedResult.status === 'unsupported'",
        );
        expect(extractionHook).toContain(
            "openMedResult.status === 'unavailable'",
        );
        expect(extractionHook).toContain(
            'settings.allowGeminiExtractionFallback',
        );
        expect(extractionHook).toContain(
            'Auto mode reaches this branch only for unsupported or',
        );
        expect(settingsPanel).toContain(
            'when local document or NER extraction is unsupported or unavailable',
        );
        expect(settingsPanel).toContain(
            'Gemini output keeps separate cloud-extraction provenance',
        );
    });

    it('blocks unevaluated Arabic and mixed-script clinical NER while preserving source text', () => {
        const extraction = source(
            '../features/openmed/openMedExtractionService.ts',
        );
        const languagePolicy = source(
            '../features/openmed/languagePolicy.ts',
        );
        const arabicCorpus = source(
            '../evaluation/phase3/clinical_ner_ar_gold.json',
        );
        const extractionFunction = extraction.slice(
            extraction.indexOf('export const extractOpenMedCandidatesFromUpload'),
        );
        const languageGuard = extractionFunction.indexOf(
            'if (!languageAssessment.allowDefaultClinicalNer)',
        );
        const modelCall = extractionFunction.indexOf(
            'const response = await analyzeOpenMedText',
        );

        expect(extraction).toContain('assessOpenMedClinicalLanguage');
        expect(extraction).toContain('allowDefaultClinicalNer');
        expect(extraction).toContain("status: 'unsupported'");
        expect(languageGuard).toBeGreaterThanOrEqual(0);
        expect(modelCall).toBeGreaterThan(languageGuard);
        expect(languagePolicy).toContain('unsupported-arabic-clinical-ner');
        expect(languagePolicy).toContain('mixed-script-review');
        expect(languagePolicy).toContain('Arabic OCR capability');
        expect(languagePolicy).toContain('Arabic clinical NER');
        expect(arabicCorpus).toContain('route-blocked-pending-measurement');
        expect(arabicCorpus).toContain('No accepted OpenMed Arabic clinical-NER prediction file');
    });

    it('keeps context defaults advisory and evidence-backed', () => {
        const mapping = source(
            '../features/openmed/candidateMapping.ts',
        );
        const review = source(
            '../features/clinical-record/components/ClinicalContextReview.tsx',
        );

        expect(mapping).toContain('not positive evidence');
        expect(mapping).toContain("? 'negated'");
        expect(mapping).toContain("? 'uncertain'");
        expect(mapping).toContain("? 'historical'");
        expect(review).toContain('deterministic OpenMed clinical-context helpers');
        expect(review).toContain('A default is not proof');
    });

    it('uses a real local PDF/OCR bridge with status, retries, and page evidence', () => {
        const bridge = source('../openmed_bridge/document_service.py');
        const preparation = source(
            '../features/openmed/documentPreparation.ts',
        );
        const statusStore = source(
            '../features/openmed/useDocumentExtractionStore.ts',
        );
        const statusPanel = source(
            '../features/openmed/components/DocumentExtractionStatusPanel.tsx',
        );
        const documents = source(
            '../features/personal-health-record/components/DocumentsModule.tsx',
        );

        expect(bridge).toContain('embedded-pdf-text');
        expect(bridge).toContain('scanned-pdf-ocr');
        expect(bridge).toContain('page_number');
        expect(bridge).toContain('source_sha256');
        expect(preparation).toContain('extractOpenMedDocument');
        expect(statusStore).toContain("status: 'queued'");
        expect(statusStore).toContain('attempts: (previous?.attempts || 0) + 1');
        expect(statusPanel).toContain('Retry local extraction');
        expect(statusPanel).toContain('same-source candidates are deduplicated');
        expect(statusPanel).toContain('original uploaded file remains authoritative');
        expect(documents).toContain('DocumentExtractionStatusPanel');
    });

    it('separates contract fixtures from measured model and OCR evidence', () => {
        const evaluator = source(
            '../openmed_bridge/evaluate_extraction.py',
        );
        const workflow = source(
            '../.github/workflows/phase1-validation.yml',
        );
        const referenceNer = source(
            '../evaluation/phase3/clinical_ner_en_reference_predictions.json',
        );
        const referenceOcr = source(
            '../evaluation/phase3/ocr_reference_predictions.json',
        );

        expect(evaluator).toContain('contract-fixture');
        expect(evaluator).toContain('measured-runtime-output');
        expect(evaluator).toContain('--require-measured-predictions');
        expect(evaluator).toContain('character_error_rate');
        expect(evaluator).toContain('word_error_rate');
        expect(evaluator).toContain('exact_span');
        expect(workflow).toContain('Validate Phase 3 extraction metric contracts');
        expect(referenceNer).toContain('must never be reported as model accuracy');
        expect(referenceOcr).toContain('must never be reported as OCR accuracy');
    });
});
