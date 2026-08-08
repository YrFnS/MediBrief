import { useCallback, useEffect, useState } from 'react';
import type { SoapNote } from './types';

/**
 * OpenRouter chat completions do not provide the real-time audio transport
 * required for ambient transcription. Manual SOAP editing remains local.
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
        setError('Ambient transcription is unavailable with browser-only OpenRouter BYOK.');
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
