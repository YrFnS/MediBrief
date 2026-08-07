import { useCallback, useEffect, useState } from 'react';
import type { SoapNote } from './types';

/**
 * Scribe's real-time Gemini WebSocket is disabled until a server-side
 * streaming boundary is available. Never fall back to a browser credential.
 */
export const useScribeSession = () => {
    const [isActive, setIsActive] = useState(false);
    const [soapNote, setSoapNote] = useState<SoapNote>({
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
    });
    const [transcript, setTranscript] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const stopSession = useCallback(async () => {
        setIsActive(false);
    }, []);

    const startSession = useCallback(async () => {
        setError('Scribe mode is unavailable in the secure server-proxy deployment.');
        await stopSession();
    }, [stopSession]);

    useEffect(() => () => {
        void stopSession();
    }, [stopSession]);

    return {
        isActive,
        soapNote,
        transcript,
        setSoapNote,
        startSession,
        stopSession,
        error,
        setTranscript,
    };
};
