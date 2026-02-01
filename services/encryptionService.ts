
// Zero-Knowledge Encryption Service
// Uses PBKDF2 for key derivation and AES-GCM for data encryption.
// The raw key never leaves memory.

const SALT_KEY = 'medibrief_sec_salt';
const VERIFIER_KEY = 'medibrief_sec_verifier'; // Encrypted string "VALID" to check PIN accuracy

export class EncryptionService {
    private key: CryptoKey | null = null;

    // --- Helpers ---
    private buffToBase64(buff: ArrayBuffer): string {
        return btoa(String.fromCharCode(...new Uint8Array(buff)));
    }

    private base64ToBuff(b64: string): Uint8Array {
        const bin = atob(b64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    // --- Core Crypto ---

    private async deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(pin),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false, // Key is non-extractable
            ["encrypt", "decrypt"]
        );
    }

    // --- Public API ---

    isConfigured(): boolean {
        return !!localStorage.getItem(SALT_KEY);
    }

    hasKey(): boolean {
        return this.key !== null;
    }

    async setup(pin: string): Promise<void> {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const key = await this.deriveKey(pin, salt);
        
        // Create a verifier token
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        const verifierCipher = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            enc.encode("VALID")
        );

        // Store public params
        localStorage.setItem(SALT_KEY, this.buffToBase64(salt.buffer));
        localStorage.setItem(VERIFIER_KEY, JSON.stringify({
            iv: this.buffToBase64(iv.buffer),
            data: this.buffToBase64(verifierCipher)
        }));

        this.key = key;
    }

    async unlock(pin: string): Promise<boolean> {
        const saltStr = localStorage.getItem(SALT_KEY);
        const verifierStr = localStorage.getItem(VERIFIER_KEY);
        
        if (!saltStr || !verifierStr) return false;

        try {
            const salt = this.base64ToBuff(saltStr);
            const key = await this.deriveKey(pin, salt);
            
            // Validate Key against Verifier
            const verifier = JSON.parse(verifierStr);
            const iv = this.base64ToBuff(verifier.iv);
            const data = this.base64ToBuff(verifier.data);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                data
            );

            const dec = new TextDecoder();
            if (dec.decode(decrypted) === "VALID") {
                this.key = key;
                return true;
            }
            return false;
        } catch (e) {
            // Decryption failed = Wrong PIN
            return false;
        }
    }

    async encrypt(text: string): Promise<string> {
        if (!this.key) throw new Error("Keystore locked");
        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            this.key,
            enc.encode(text)
        );

        return JSON.stringify({
            v: 1, // Versioning for future algos
            iv: this.buffToBase64(iv.buffer),
            data: this.buffToBase64(ciphertext)
        });
    }

    async decrypt(encryptedJson: string): Promise<string | null> {
        if (!this.key) throw new Error("Keystore locked");

        try {
            const parsed = JSON.parse(encryptedJson);
            if (!parsed.iv || !parsed.data) return null; // Not encrypted data

            const iv = this.base64ToBuff(parsed.iv);
            const data = this.base64ToBuff(parsed.data);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                this.key,
                data
            );

            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } catch (e) {
            console.error("Decryption failed:", e);
            return null;
        }
    }
    
    lock(): void {
        this.key = null;
    }
}

export const encryptionService = new EncryptionService();
