import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: {
        timeout: 12_000,
    },
    reporter: [
        ['line'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        timeout: 120_000,
        reuseExistingServer: false,
    },
});
