import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobStorage } from '../services/blobStorageService';
import {
    ENCRYPTED_SOURCE_STORAGE_PREFIX,
    encryptedSourceStorage,
    sha256Hex,
} from '../services/encryptedSourceStorage';
import { encryptionService } from '../services/encryptionService';

class MemoryStorage implements Storage {
    private values = new Map<string, string>();

    get length(): number {
        return this.values.size;
    }

    clear(): void {
        this.values.clear();
    }

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
        return [...this.values.keys()][index] ?? null;
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

const readSourceRows = async (): Promise<Array<Record<string, unknown>>> =>
    new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(
            'MediBrief_EncryptedSourceStore',
            1,
        );
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
            const db = openRequest.result;
            const transaction = db.transaction('sources', 'readonly');
            const request = transaction.objectStore('sources').getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(
                request.result as Array<Record<string, unknown>>,
            );
        };
    });

const textToBase64 = (value: string): string =>
    Buffer.from(value, 'utf8').toString('base64');

const base64ToText = (value: string): string =>
    Buffer.from(value, 'base64').toString('utf8');

describe('encrypted IPS source storage', () => {
    beforeEach(async () => {
        vi.stubGlobal('window', globalThis);
        vi.stubGlobal('localStorage', new MemoryStorage());
        encryptionService.lock();
        await encryptionService.setup(
            'P1.3 encrypted source test passphrase 2026!',
        );
    });

    afterEach(() => {
        encryptionService.lock();
    });

    it('stores only an opaque key and ciphertext while recovering the exact verified envelope', async () => {
        const logicalId = `${ENCRYPTED_SOURCE_STORAGE_PREFIX}test-patient:source-a`;
        const text = JSON.stringify({
            resourceType: 'Bundle',
            patient: 'Synthetic Encrypted Source Patient',
            diagnosis: 'Synthetic encrypted diagnosis',
        }, null, 2);
        const sha256 = await sha256Hex(text);
        await encryptedSourceStorage.saveSource({
            id: logicalId,
            text,
            fileName: 'sensitive-patient-summary.json',
            mimeType: 'application/fhir+json',
            sha256,
            byteLength: new TextEncoder().encode(text).byteLength,
            storedAt: '2026-08-15T10:00:00.000Z',
        });

        const rows = await readSourceRows();
        const row = rows.find(candidate =>
            typeof candidate.id === 'string'
            && candidate.id.toString().startsWith(
                `${ENCRYPTED_SOURCE_STORAGE_PREFIX}key:`,
            ));
        expect(row).toBeDefined();
        expect(Object.keys(row!).sort()).toEqual([
            'encryptedPayload',
            'id',
        ]);
        expect(row!.id).toMatch(
            /^medibrief-encrypted-source:key:[a-f0-9]{64}$/,
        );
        const serialized = JSON.stringify(row);
        expect(serialized).not.toContain(logicalId);
        expect(serialized).not.toContain('sensitive-patient-summary.json');
        expect(serialized).not.toContain('Synthetic Encrypted Source Patient');
        expect(serialized).not.toContain('Synthetic encrypted diagnosis');
        expect(serialized).not.toContain(sha256);

        const recovered = await encryptedSourceStorage.getSource(logicalId);
        expect(recovered).toEqual({
            id: logicalId,
            text,
            fileName: 'sensitive-patient-summary.json',
            mimeType: 'application/fhir+json',
            sha256,
            byteLength: new TextEncoder().encode(text).byteLength,
            storedAt: '2026-08-15T10:00:00.000Z',
        });

        await encryptedSourceStorage.deleteSource(logicalId);
    });

    it('exports through the backup asset contract and re-encrypts on restore', async () => {
        const logicalId = `${ENCRYPTED_SOURCE_STORAGE_PREFIX}test-patient:source-b`;
        const text = JSON.stringify({
            resourceType: 'Bundle',
            id: 'portable-encrypted-source',
        });
        const original = {
            id: logicalId,
            data: textToBase64(text),
            mimeType: 'application/fhir+json',
            timestamp: Date.parse('2026-08-15T11:00:00.000Z'),
        };

        await blobStorage.putFile(original);
        const exported = await blobStorage.getFile(logicalId);
        expect(exported).toBeDefined();
        expect(exported?.id).toBe(logicalId);
        expect(exported?.mimeType).toBe('application/fhir+json');
        expect(base64ToText(exported!.data)).toBe(text);

        await blobStorage.deleteFile(logicalId);
        expect(await encryptedSourceStorage.getSource(logicalId))
            .toBeUndefined();

        await blobStorage.putFile(exported!);
        const restored = await encryptedSourceStorage.getSource(logicalId);
        expect(restored?.text).toBe(text);
        expect(restored?.sha256).toBe(await sha256Hex(text));
        expect(restored?.storedAt).toBe('2026-08-15T11:00:00.000Z');

        await blobStorage.deleteFile(logicalId);
    });

    it('fails closed when the source text changes after preview evidence was computed', async () => {
        const logicalId = `${ENCRYPTED_SOURCE_STORAGE_PREFIX}test-patient:source-c`;
        const reviewedText = '{"resourceType":"Bundle","id":"reviewed"}';

        await expect(encryptedSourceStorage.saveSource({
            id: logicalId,
            text: '{"resourceType":"Bundle","id":"substituted"}',
            fileName: 'received-ips.json',
            mimeType: 'application/fhir+json',
            sha256: await sha256Hex(reviewedText),
            byteLength: new TextEncoder().encode(reviewedText).byteLength,
            storedAt: '2026-08-15T12:00:00.000Z',
        })).rejects.toThrow(
            'Source evidence changed after preview; import was cancelled.',
        );

        expect(await encryptedSourceStorage.getSource(logicalId))
            .toBeUndefined();
    });
});
