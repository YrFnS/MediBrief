import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 accessibility contracts', () => {
    it('allows browser zoom and provides visible focus and reduced-motion behavior', () => {
        const html = source('../index.html');
        const styles = source('../styles.css');

        expect(html).toContain('width=device-width, initial-scale=1.0');
        expect(html).not.toContain('user-scalable=no');
        expect(html).not.toContain('maximum-scale=1.0');
        expect(styles).toContain(':focus-visible');
        expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('provides a skip link and a labelled patient-record content landmark', () => {
        const workspace = source('../features/layout/Phase2Workspace.tsx');

        expect(workspace).toContain('Skip to patient record content');
        expect(workspace).toContain('href="#patient-record-content"');
        expect(workspace).toContain('id="patient-record-content"');
        expect(workspace).toContain('role="tabpanel"');
        expect(workspace).toContain('aria-labelledby={`patient-record-tab-${view}`}');
        expect(workspace).toContain('tabIndex={-1}');
    });

    it('supports arrow, Home, and End navigation in both record tab systems', () => {
        const primary = source(
            '../features/personal-health-record/components/PersonalRecordNavigation.tsx',
        );
        const healthData = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );
        const primitives = source(
            '../features/personal-health-record/components/CoreModulePrimitives.tsx',
        );

        for (const moduleSource of [primary, healthData, primitives]) {
            expect(moduleSource).toContain('role="tablist"');
            expect(moduleSource).toContain('role="tab"');
            expect(moduleSource).toContain('aria-selected={active}');
            expect(moduleSource).toContain("event.key === 'ArrowRight'");
            expect(moduleSource).toContain("event.key === 'Home'");
            expect(moduleSource).toContain("event.key === 'End'");
        }

        expect(primary).toContain("value: 'search'");
        expect(primary).toContain('aria-controls="patient-record-content"');
        expect(healthData).toContain('aria-controls="health-data-panel"');
    });

    it('gives shared search, select, source, and feedback controls accessible names', () => {
        const primitives = source(
            '../features/personal-health-record/components/CoreModulePrimitives.tsx',
        );
        const search = source(
            '../features/personal-health-record/components/RecordSearchAndExport.tsx',
        );

        expect(primitives).toContain('aria-label={placeholder}');
        expect(primitives).toContain('aria-label={label}');
        expect(primitives).toContain('View original source:');
        expect(search).toContain('id="record-wide-search"');
        expect(search).toContain('role="status"');
        expect(search).toContain('aria-live="polite"');
        expect(search).toContain('aria-labelledby="record-search-heading"');
    });
});

describe('Phase 2 responsive layout contracts', () => {
    it('keeps both navigation systems horizontally reachable at narrow widths', () => {
        const primary = source(
            '../features/personal-health-record/components/PersonalRecordNavigation.tsx',
        );
        const healthData = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        expect(primary).toContain('overflow-x-auto');
        expect(primary).toContain('min-w-[122px]');
        expect(healthData).toContain('overflow-x-auto');
        expect(healthData).toContain('min-w-[130px]');
    });

    it('stacks export actions and search filters before expanding on wider screens', () => {
        const search = source(
            '../features/personal-health-record/components/RecordSearchAndExport.tsx',
        );

        expect(search).toContain('grid w-full gap-2 sm:grid-cols-2');
        expect(search).toContain('xl:grid-cols-[minmax(280px,1fr)_repeat(3,minmax(150px,auto))]');
        expect(search).toContain('flex flex-col gap-5 lg:flex-row');
        expect(search).toContain('break-words');
        expect(search).toContain('min-h-11');
    });

    it('keeps the dynamic record panel shrinkable inside the fixed application shell', () => {
        const workspace = source('../features/layout/Phase2Workspace.tsx');
        expect(workspace).toContain('flex min-h-0 min-w-0 flex-1 flex-col');
    });
});
