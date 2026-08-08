import { webcrypto } from 'node:crypto';
import { get } from 'idb-keyval';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptionService } from '../services/encryptionService';
import { indexedDBStorage } from '../services/storage';
import {
    buildOpenRouterChatRequest,
    fetchOpenRouterModels,
    isFreeOpenRouterModel,
    parseOpenRouterModels,
    redactOpenRouterSecrets,
    searchOpenRouterModels,
} from '../services/openRouter';
import { useSettingsStore } from '../features/settings/useSettingsStore';

const FAKE_KEY = 'synthetic-openrouter-key-for-tests';
const MODEL_ID = 'example/explicit-model-id';

const catalogPayload = {
    data: [
        {
            id: 'example/zero-priced',
            canonical_slug: 'example/zero-priced-2026',
            name: 'Zero Priced',
            description: 'A compact vision model',
            context_length: 32_000,
            architecture: {
                modality: 'text+image->text',
                input_modalities: ['text', 'image'],
                output_modalities: ['text'],
            },
            pricing: { prompt: '0', completion: '0' },
            top_provider: { max_completion_tokens: 4_096 },
            supported_parameters: ['temperature', 'tools'],
        },
        {
            id: 'example/priced-model-named-free',
            name: 'Free Spirit',
            description: 'Its name says free, but its returned prices do not.',
            pricing: { prompt: '0', completion: '0', request: '0.01' },
            architecture: { modality: 'text->text' },
        },
    ],
};

afterEach(() => {
    encryptionService.lock();
    useSettingsStore.getState().setOpenRouterApiKey('');
    useSettingsStore.getState().setOpenRouterModelId('');
});

describe('OpenRouter catalog', () => {
    it('parses useful metadata and searches across returned fields', () => {
        const models = parseOpenRouterModels(catalogPayload);
        expect(models[0]).toMatchObject({
            id: 'example/zero-priced',
            canonicalSlug: 'example/zero-priced-2026',
            contextLength: 32_000,
            maxCompletionTokens: 4_096,
            modality: 'text+image->text',
            inputModalities: ['text', 'image'],
            supportedParameters: ['temperature', 'tools'],
        });
        expect(searchOpenRouterModels(models, 'compact vision')).toEqual([
            models[0],
        ]);
        expect(searchOpenRouterModels(models, 'image tools')).toEqual([
            models[0],
        ]);
    });

    it('derives free status only when every returned price is zero', () => {
        const models = parseOpenRouterModels(catalogPayload);
        expect(isFreeOpenRouterModel(models[0])).toBe(true);
        expect(isFreeOpenRouterModel(models[1])).toBe(false);
    });

    it('loads the public catalog with an unauthenticated GET', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify(catalogPayload),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        ));
        vi.stubGlobal('fetch', fetchMock);

        await expect(fetchOpenRouterModels()).resolves.toHaveLength(2);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/models');
        expect(init).toMatchObject({ method: 'GET' });
        expect(JSON.stringify(init)).not.toContain('Authorization');
    });
});

describe('OpenRouter selection and local secret handling', () => {
    it('starts without a model, keeps an explicit exact selection, and clears it', () => {
        const settings = useSettingsStore.getState();
        expect(settings.openRouterModelId).toBe('');

        settings.setOpenRouterApiKey(FAKE_KEY);
        settings.setOpenRouterModelId(MODEL_ID);
        expect(useSettingsStore.getState()).toMatchObject({
            openRouterApiKey: FAKE_KEY,
            openRouterModelId: MODEL_ID,
        });

        settings.setOpenRouterApiKey('');
        settings.setOpenRouterModelId('');
        expect(useSettingsStore.getState()).toMatchObject({
            openRouterApiKey: '',
            openRouterModelId: '',
        });
    });

    it('encrypts persisted settings when the local vault is unlocked', async () => {
        const local = new Map<string, string>();
        vi.stubGlobal('window', { crypto: webcrypto });
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => local.get(key) ?? null,
            setItem: (key: string, value: string) => local.set(key, value),
        });
        await encryptionService.setup('1234');

        const serialized = JSON.stringify({
            state: { openRouterApiKey: FAKE_KEY, openRouterModelId: MODEL_ID },
            version: 2,
        });
        await indexedDBStorage.setItem('openrouter-storage-test', serialized);
        const raw = await get('openrouter-storage-test');

        expect(typeof raw).toBe('string');
        expect(raw).not.toContain(FAKE_KEY);
        await expect(indexedDBStorage.getItem('openrouter-storage-test'))
            .resolves.toBe(serialized);
    });

    it('redacts fake keys and bearer values from errors', () => {
        const message = redactOpenRouterSecrets(
            new Error(`Authorization: Bearer ${FAKE_KEY}; key=${FAKE_KEY}`),
            [FAKE_KEY],
        );
        expect(message).not.toContain(FAKE_KEY);
        expect(message).toContain('[redacted]');
    });
});

describe('OpenRouter request construction', () => {
    it('sends the exact selected model and fake key only in the Bearer header', () => {
        const request = buildOpenRouterChatRequest({
            apiKey: FAKE_KEY,
            model: MODEL_ID,
            messages: [{ role: 'user', content: 'synthetic test message' }],
            stream: true,
            appOrigin: 'https://clinixsummary.vercel.app',
        });
        const headers = request.init.headers as Record<string, string>;
        const body = JSON.parse(String(request.init.body));

        expect(request.url).toBe(
            'https://openrouter.ai/api/v1/chat/completions',
        );
        expect(headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
        expect(headers['HTTP-Referer']).toBe(
            'https://clinixsummary.vercel.app',
        );
        expect(body.model).toBe(MODEL_ID);
        expect(body.stream).toBe(true);
        expect(request.url).not.toContain(FAKE_KEY);
        expect(String(request.init.body)).not.toContain(FAKE_KEY);
    });

    it('rejects a request without an explicit model before fetch', () => {
        expect(() => buildOpenRouterChatRequest({
            apiKey: FAKE_KEY,
            model: '',
            messages: [],
            stream: false,
        })).toThrow('Select or enter an OpenRouter model in Settings.');
    });
});
