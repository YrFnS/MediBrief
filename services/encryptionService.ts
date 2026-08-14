const SALT_KEY = 'medibrief_sec_salt';
const VERIFIER_KEY = 'medibrief_sec_verifier';
const CREDENTIAL_POLICY_KEY = 'medibrief_sec_policy_version';
const CURRENT_CREDENTIAL_POLICY_VERSION = 2;
const PBKDF2_ITERATIONS = 310_000;

interface StoredVerifier {
    iv: string;
    data: string;
}

export class EncryptionService {
    private key: CryptoKey | null = null;

    private bufferToBase64(buffer: ArrayBuffer): string {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    private base64ToBuffer(value: string): Uint8Array {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    private async deriveKey(
        credential: string,
        salt: Uint8Array,
        iterations = PBKDF2_ITERATIONS,
    ): Promise<CryptoKey> {
        const material = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(credential),
            { name: 'PBKDF2' },
            false,
            ['deriveKey'],
        );

        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations,
                hash: 'SHA-256',
            },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    }

    isConfigured(): boolean {
        return Boolean(localStorage.getItem(SALT_KEY));
    }

    hasKey(): boolean {
        return this.key !== null;
    }

    getCredentialPolicyVersion(): number | null {
        if (!this.isConfigured()) return null;
        const raw = localStorage.getItem(CREDENTIAL_POLICY_KEY);
        if (!raw) return 1;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 1;
    }

    isLegacyCredentialPolicy(): boolean {
        const version = this.getCredentialPolicyVersion();
        return version !== null && version < CURRENT_CREDENTIAL_POLICY_VERSION;
    }

    async setup(passphrase: string): Promise<void> {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const key = await this.deriveKey(passphrase, salt);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const verifierCipher = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode('VALID'),
        );

        localStorage.setItem(SALT_KEY, this.bufferToBase64(salt.buffer));
        localStorage.setItem(VERIFIER_KEY, JSON.stringify({
            iv: this.bufferToBase64(iv.buffer),
            data: this.bufferToBase64(verifierCipher),
        } satisfies StoredVerifier));
        localStorage.setItem(
            CREDENTIAL_POLICY_KEY,
            String(CURRENT_CREDENTIAL_POLICY_VERSION),
        );
        this.key = key;
    }

    async unlock(credential: string): Promise<boolean> {
        const saltValue = localStorage.getItem(SALT_KEY);
        const verifierValue = localStorage.getItem(VERIFIER_KEY);
        if (!saltValue || !verifierValue) return false;

        try {
            const salt = this.base64ToBuffer(saltValue);
            const policyVersion = this.getCredentialPolicyVersion() || 1;
            const iterations = policyVersion >= 2 ? PBKDF2_ITERATIONS : 100_000;
            const key = await this.deriveKey(credential, salt, iterations);
            const verifier = JSON.parse(verifierValue) as StoredVerifier;
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: this.base64ToBuffer(verifier.iv),
                },
                key,
                this.base64ToBuffer(verifier.data),
            );

            if (new TextDecoder().decode(decrypted) !== 'VALID') return false;
            this.key = key;
            return true;
        } catch {
            return false;
        }
    }

    async encrypt(text: string): Promise<string> {
        if (!this.key) throw new Error('Keystore locked');
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this.key,
            new TextEncoder().encode(text),
        );

        return JSON.stringify({
            v: 1,
            iv: this.bufferToBase64(iv.buffer),
            data: this.bufferToBase64(ciphertext),
        });
    }

    async decrypt(encryptedJson: string): Promise<string | null> {
        if (!this.key) throw new Error('Keystore locked');
        try {
            const parsed = JSON.parse(encryptedJson) as StoredVerifier & {
                v?: number;
            };
            if (!parsed.iv || !parsed.data) return null;
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: this.base64ToBuffer(parsed.iv),
                },
                this.key,
                this.base64ToBuffer(parsed.data),
            );
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    lock(): void {
        this.key = null;
    }
}

export const encryptionService = new EncryptionService();
