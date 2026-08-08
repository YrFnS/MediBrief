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
 * OpenRouter chat completions do not provide the real-time audio transport
 * this mode requires, so browser-only BYOK leaves live audio disabled.
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
        setError('Live audio is unavailable with browser-only OpenRouter BYOK.');
        await stopSession();
    }, [stopSession]);

    useEffect(() => () => {
        void stopSession();
    }, [stopSession]);

    return { isLive, transcript, startSession, stopSession, error };
};
