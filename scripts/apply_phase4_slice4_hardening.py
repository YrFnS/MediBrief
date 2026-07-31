from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected one match in {path}, found {count}: {old[:120]!r}"
        )
    write(path, content.replace(old, new, 1))


# Same title/date/content without a shared source or accession is advisory.
replace_once(
    "features/diagnostic-reports/conflicts.ts",
    """    } else if (sameTitle && sameDate && exactContent) {
        kind = 'exact-duplicate';
        score = 90;
        blocking = true;
        recommendedDecision = 'duplicate';
    } else if (sameTitle && sameDate && overlap >= 0.5) {
""",
    """    } else if (sameTitle && sameDate && exactContent) {
        kind = 'possible-duplicate';
        score = 85;
        blocking = false;
        recommendedDecision = 'distinct';
        evidence.push(
            'No shared source document or accession identifier was found, so identical same-day content remains advisory.',
        );
    } else if (sameTitle && sameDate && overlap >= 0.5) {
""",
)

# A result can be superseded directly or because every containing report is historical.
replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    isSuperseded: boolean;
    supersededByObservationIds: string[];
    lineage?: ObservationRecord['lineage'];
""",
    """    isSuperseded: boolean;
    supersededByObservationIds: string[];
    supersededByReportIds: string[];
    lineage?: ObservationRecord['lineage'];
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    reports,
    successorIds,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
    successorIds: string[];
}): DiagnosticResultView => {
""",
    """    reports,
    successorIds,
    supersededByReportIds,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
    successorIds: string[];
    supersededByReportIds: string[];
}): DiagnosticResultView => {
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        isSuperseded: successorIds.length > 0,
        supersededByObservationIds: successorIds,
        ...(observation.lineage ? { lineage: observation.lineage } : {}),
""",
    """        isSuperseded:
            successorIds.length > 0 || supersededByReportIds.length > 0,
        supersededByObservationIds: successorIds,
        supersededByReportIds,
        ...(observation.lineage ? { lineage: observation.lineage } : {}),
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    observations.forEach(observation => {
        resultViews.set(observation.id, resultView({
            record,
            observation,
            reports: membership.get(observation.id) || [],
            successorIds: observationSuccessorMap.get(observation.id) || [],
        }));
    });
""",
    """    observations.forEach(observation => {
        const reportMemberships = membership.get(observation.id) || [];
        const supersededByReportIds = reportMemberships.length > 0
            && reportMemberships.every(report =>
                reportSuccessorMap.has(report.id))
            ? [...new Set(reportMemberships.flatMap(report =>
                reportSuccessorMap.get(report.id) || []))]
            : [];
        resultViews.set(observation.id, resultView({
            record,
            observation,
            reports: reportMemberships,
            successorIds: observationSuccessorMap.get(observation.id) || [],
            supersededByReportIds,
        }));
    });
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """            reports: membership.get(observation.id) || [],
            superseded: observationSuccessorMap.has(observation.id),
""",
    """            reports: membership.get(observation.id) || [],
            superseded:
                resultViews.get(observation.id)?.isSuperseded
                || observationSuccessorMap.has(observation.id),
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        result.supersededByObservationIds.join(' '),
    ].some(value => normalizeText(value).includes(normalized));
""",
    """        result.supersededByObservationIds.join(' '),
        result.supersededByReportIds.join(' '),
    ].some(value => normalizeText(value).includes(normalized));
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                    {result.isSuperseded && (
                        <p className=\"mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300\">
                            Superseded by {result.supersededByObservationIds.join(', ')}. This value is excluded from current trends but remains source-reviewable.
                        </p>
                    )}
""",
    """                    {result.isSuperseded && (
                        <p className=\"mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300\">
                            {result.supersededByObservationIds.length > 0
                                ? `Superseded by observation ${result.supersededByObservationIds.join(', ')}.`
                                : `The containing report was superseded by report ${result.supersededByReportIds.join(', ')}.`}
                            {' '}This value is excluded from current trends but remains source-reviewable.
                        </p>
                    )}
""",
)

# Add regression coverage for the two conservative edge cases.
replace_once(
    "tests/diagnosticReportConflicts.test.ts",
    """    it('keeps a same-day similar report advisory when no strong event identifier matches', () => {
""",
    """    it('moves an omitted member of a corrected report into immutable history', () => {
        const originalDraft = draft({ documentId: 'source-1', value: '13.2' });
        originalDraft.results.push({
            localId: 'platelets',
            testName: 'Platelets',
            loincCode: '777-3',
            status: 'final',
            categoryTexts: ['Laboratory'],
            valueText: '250',
            unitText: '10*3/uL',
            referenceRangeText: '150 - 400',
            clinicalDate: '2026-07-31',
            specimenLocalId: 'blood',
            source: { pageNumber: 1, excerpt: 'Platelets 250 10*3/uL' },
        });
        const first = buildAndCommitReviewedDiagnosticReport(
            originalDraft,
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        const corrected = buildAndCommitReviewedDiagnosticReport(
            draft({
                documentId: 'source-3',
                value: '12.8',
                status: 'corrected',
                conflictResolution: {
                    relatedReportId: first.commit.reportId!,
                    decision: 'corrects',
                    reason: 'The corrected report intentionally omits the prior platelet row.',
                },
            }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v2') },
        );
        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const originalReport = record.resources.diagnosticReports.find(item =>
            item.id === first.commit.reportId)!;
        const originalPlatelets = record.resources.observations.find(item =>
            originalReport.resultIds.includes(item.id)
            && item.code.text === 'Platelets')!;
        const plateletView = buildDiagnosticResultsIntelligence(record)
            .supersededResults.find(item => item.id === originalPlatelets.id)!;

        expect(plateletView).toMatchObject({
            isSuperseded: true,
            supersededByObservationIds: [],
            supersededByReportIds: [corrected.commit.reportId],
        });
        expect(buildDiagnosticResultsIntelligence(record).trendExclusions)
            .toContainEqual(expect.objectContaining({
                observationId: originalPlatelets.id,
                reason: 'superseded-result',
            }));
    });

    it('keeps identical same-day reports advisory when accessions and sources differ', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2', accession: 'ACC-A' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        expect(first.commit.ok).toBe(true);

        const secondDraft = draft({
            documentId: 'source-4',
            value: '13.2',
            accession: 'ACC-B',
        });
        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const bundle = buildReviewedDiagnosticReportBundle(secondDraft, {
            now: NOW,
            actor: 'tester',
            idFactory: ids('distinct-identical'),
            record,
        });
        const analysis = analyzeDiagnosticReportConflicts(record, bundle);
        const committed = buildAndCommitReviewedDiagnosticReport(secondDraft, {
            now: NOW,
            committedAt: NOW,
            actor: 'tester',
            idFactory: ids('distinct-identical'),
        });

        expect(analysis.candidates[0]).toMatchObject({
            kind: 'possible-duplicate',
            blocking: false,
            recommendedDecision: 'distinct',
        });
        expect(analysis.requiresResolution).toBe(false);
        expect(committed.commit.status).toBe('created');
    });

    it('keeps a same-day similar report advisory when no strong event identifier matches', () => {
""",
)

replace_once(
    "docs/architecture/PHASE_4_CORRECTIONS_DUPLICATES_CONFLICTS.md",
    """- **Exact duplicate** — strong source/accession identity or same clinical event evidence with identical structured results. Confirmation is blocked until the reviewer chooses “duplicate”; no new clinical resource is written.
- **Same-event conflict** — shared source/accession identity with differing result content. Confirmation is blocked until the reviewer records `corrects`, `amends`, `replaces`, or an explicit distinct-report decision.
- **Possible duplicate** — same reviewed title/date with meaningful result overlap but no strong event identifier. This is advisory because two legitimate reports may share those characteristics.
""",
    """- **Exact duplicate** — a shared source document or accession identity with identical structured results. Confirmation is blocked until the reviewer chooses “duplicate”; no new clinical resource is written.
- **Same-event conflict** — shared source/accession identity with differing result content. Confirmation is blocked until the reviewer records `corrects`, `amends`, `replaces`, or an explicit distinct-report decision.
- **Possible duplicate** — same reviewed title/date with meaningful or even identical result content but no strong event identifier. This is advisory because two legitimate reports may share those characteristics.
""",
)

replace_once(
    "docs/architecture/PHASE_4_CORRECTIONS_DUPLICATES_CONFLICTS.md",
    """For corrected, amended, and replacement reports, member results are paired deterministically by confirmed LOINC identity or exact reviewed name plus specimen context. Matched new observations point to one predecessor observation. Unmatched rows remain legitimate additions; prior rows omitted from the new report remain preserved in the older report.
""",
    """For corrected, amended, and replacement reports, member results are paired deterministically by confirmed LOINC identity or exact reviewed name plus specimen context. Matched new observations point to one predecessor observation. Unmatched rows remain legitimate additions. Prior rows omitted from the new report remain preserved in the older report and become superseded through report lineage even when no one-to-one successor row exists.
""",
)

print("Phase 4 Slice 4 hardening patch applied.")
