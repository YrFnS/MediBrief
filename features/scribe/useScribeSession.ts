
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { MODEL_CONFIGS, SCRIBE_SYSTEM_INSTRUCTION } from '../../constants';
import { ChatMode } from '../../types';
import { SoapNote } from './types';

// Duplicated audio utils to keep this feature self-contained and stable
// Ideally, these move to a shared audioService in a larger refactor
const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const clamped = Math.max(-1, Math.min(1, data[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const useScribeSession = () => {
    const [isActive, setIsActive] = useState(false);
    const [soapNote, setSoapNote] = useState<SoapNote>({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });
    const [error, setError] = useState<string | null>(null);

    const liveSessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const stopSession = useCallback(async () => {
        try {
            if (liveSessionRef.current) {
                liveSessionRef.current.close();
                liveSessionRef.current = null;
            }
            scriptProcessorRef.current?.disconnect();
            mediaStreamSourceRef.current?.disconnect();
            if (audioContextRef.current && audioContextRef.current.state === 'running') {
                await audioContextRef.current.suspend();
            }
        } catch(e) {
            console.error("Scribe stop error", e);
        } finally {
            setIsActive(false);
        }
    }, []);

    const startSession = useCallback(async () => {
        if (isActive) return;
        setError(null);

        try {
             // 1. Audio Setup
             if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });

            setIsActive(true);

            // 2. Connect Gemini
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const sessionPromise = ai.live.connect({
                model: MODEL_CONFIGS[ChatMode.Scribe].model,
                config: {
                    ...MODEL_CONFIGS[ChatMode.Scribe].config,
                    systemInstruction: SCRIBE_SYSTEM_INSTRUCTION
                },
                callbacks: {
                    onopen: async () => {
                         if (!audioContextRef.current) return;
                         mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                         scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                         
                         scriptProcessorRef.current.onaudioprocess = (e) => {
                             if (!audioContextRef.current || audioContextRef.current.state !== 'running') return;
                             const inputData = e.inputBuffer.getChannelData(0);
                             const pcmBlob = createBlob(inputData);
                             sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                         };
                         
                         mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                         scriptProcessorRef.current.connect(audioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // We ONLY care about Tool Calls for Scribe mode.
                        // We ignore audio output because the scribe should be silent.
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'updateSoapNote') {
                                    // Update State with partial or full updates
                                    const args = fc.args as any;
                                    setSoapNote(prev => ({
                                        subjective: args.subjective || prev.subjective,
                                        objective: args.objective || prev.objective,
                                        assessment: args.assessment || prev.assessment,
                                        plan: args.plan || prev.plan
                                    }));

                                    // Send Success Response
                                    sessionPromise.then(session => session.sendToolResponse({
                                        functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Note updated" } }]
                                    }));
                                }
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error("Scribe error", e);
                        setError("Scribe connection failed.");
                        stopSession();
                    },
                    onclose: () => stopSession()
                }
            });
            liveSessionRef.current = await sessionPromise;

        } catch (e: any) {
            console.error("Failed to start scribe", e);
            setError(e.message || "Could not start recording.");
            setIsActive(false);
        }
    }, [isActive, stopSession]);

    useEffect(() => {
        return () => { stopSession(); };
    }, [stopSession]);

    return { 
        isActive, 
        soapNote, 
        setSoapNote, // allow manual edits
        startSession, 
        stopSession, 
        error 
    };
};
