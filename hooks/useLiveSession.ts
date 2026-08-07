import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../types';

export interface UseLiveSessionReturn {
    isLive: boolean;
    transcript: { userInput: string; modelOutput: string };
    startSession: (history?: ChatMessage[]) => Promise<void>;
    stopSession: () => Promise<void>;
    error: string | null;
}

interface LiveSessionOptions {
    onTurnComplete?: (userInput: string, modelOutput: string) => void;
    onToolCall?: (toolName: string, args: any) => void;
}

/**
 * Real-time Gemini uses a browser WebSocket credential. It stays unavailable
 * until a server-side streaming boundary exists, rather than bypassing the
 * credential boundary with a client secret.
 */
export const useLiveSession = ({ onTurnComplete }: LiveSessionOptions = {}): UseLiveSessionReturn => {
    const [isLive, setIsLive] = useState(false);
    const [transcript, setTranscript] = useState({ userInput: '', modelOutput: '' });
    const [error, setError] = useState<string | null>(null);

    const stopSession = useCallback(async () => {
        setIsLive(false);
        setTranscript({ userInput: '', modelOutput: '' });
        onTurnComplete?.('', '');
    }, [onTurnComplete]);

    const startSession = useCallback(async (_history: ChatMessage[] = []) => {
        setError('Live mode is unavailable in the secure server-proxy deployment.');
        await stopSession();
    }, [stopSession]);

    useEffect(() => () => {
        void stopSession();
    }, [stopSession]);

    return { isLive, transcript, startSession, stopSession, error };
};
