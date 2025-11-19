
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';
import { ChatMode } from '../types';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// --- Audio Utilities ---
const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

type LiveSession = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>>;

export interface UseLiveSessionReturn {
    isLive: boolean;
    transcript: { userInput: string; modelOutput: string };
    startSession: () => Promise<void>;
    stopSession: () => void;
    error: string | null;
}

export const useLiveSession = (onTurnComplete?: (userInput: string, modelOutput: string) => void): UseLiveSessionReturn => {
    const [isLive, setIsLive] = useState(false);
    const [transcript, setTranscript] = useState({ userInput: '', modelOutput: '' });
    const [error, setError] = useState<string | null>(null);

    // Refs to track accumulating text across closures
    const accumulatedTranscriptRef = useRef({ userInput: '', modelOutput: '' });

    const liveSessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const stopSession = useCallback(() => {
        liveSessionRef.current?.close();
        liveSessionRef.current = null;

        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;

        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        
        // CRITICAL FIX: Save any partial transcript that was in progress when stopped
        if ((accumulatedTranscriptRef.current.userInput || accumulatedTranscriptRef.current.modelOutput) && onTurnComplete) {
            onTurnComplete(accumulatedTranscriptRef.current.userInput, accumulatedTranscriptRef.current.modelOutput);
        }
        
        // Reset refs
        accumulatedTranscriptRef.current = { userInput: '', modelOutput: '' };

        setIsLive(false);
        setTranscript({ userInput: '', modelOutput: '' });
    }, [onTurnComplete]);

    const startSession = useCallback(async () => {
        if (isLive) return;

        setError(null);
        accumulatedTranscriptRef.current = { userInput: '', modelOutput: '' };

        try {
            // Initialize Audio Contexts
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            
            if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
            if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

            setIsLive(true);

            // FIX: Enable echo cancellation to prevent feedback loop
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                } 
            });
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const sessionPromise = ai.live.connect({
                model: MODEL_CONFIGS[ChatMode.Live].model,
                config: {
                    ...MODEL_CONFIGS[ChatMode.Live].config,
                    systemInstruction: SYSTEM_INSTRUCTION
                },
                callbacks: {
                    onopen: async () => {
                        if (!inputAudioContextRef.current) return;
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const { text } = message.serverContent.inputTranscription;
                            accumulatedTranscriptRef.current.userInput += text; // Append to ref
                            // Update state for UI
                            setTranscript(prev => ({ ...prev, userInput: accumulatedTranscriptRef.current.userInput }));
                        }
                        if (message.serverContent?.outputTranscription) {
                            accumulatedTranscriptRef.current.modelOutput += message.serverContent.outputTranscription.text; // Append to ref
                            // Update state for UI
                            setTranscript(prev => ({ ...prev, modelOutput: accumulatedTranscriptRef.current.modelOutput }));
                        }

                        if (message.toolCall) {
                             for (const fc of message.toolCall.functionCalls) {
                                console.log('Function call received:', fc);
                                const args = fc.args as any;
                                // Dynamic response so the model knows EXACTLY what was booked
                                const result = { 
                                    result: `Appointment scheduled for patient ${args.patientId} on ${args.date} at ${args.time}.` 
                                };
                                sessionPromise.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id : fc.id,
                                            name: fc.name,
                                            response: result,
                                        }
                                    })
                                });
                            }
                        }

                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            const outCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
                            const source = outCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outCtx.destination);
                            source.addEventListener('ended', () => { audioSourcesRef.current.delete(source); });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                         if (message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }

                        if (message.serverContent?.turnComplete) {
                            if (onTurnComplete) {
                                onTurnComplete(accumulatedTranscriptRef.current.userInput, accumulatedTranscriptRef.current.modelOutput);
                            }
                            // Reset for next turn
                            accumulatedTranscriptRef.current = { userInput: '', modelOutput: '' };
                            setTranscript({ userInput: '', modelOutput: '' });
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError(e.message || 'Live session error');
                        stopSession();
                    },
                    onclose: () => {
                         stopSession();
                    },
                },
            });
            const session = await sessionPromise;

            // RACE CONDITION FIX:
            // If stopSession() was called while we were awaiting the connection,
            // inputAudioContextRef.current will be null (cleaned up).
            // We must close this new orphaned session immediately.
            if (!inputAudioContextRef.current) {
                console.log("Session connected after stop was called. Closing orphaned session.");
                session.close();
                return;
            }
            
            liveSessionRef.current = session;

        } catch (e: any) {
            console.error("Live session start error", e);
            let msg = e.message || "Unknown error starting live session";
            if (msg.includes('Permission denied') || msg.includes('Microphone')) {
                msg = "Microphone access denied. Please allow permissions.";
            }
            setError(msg);
            stopSession();
        }
    }, [isLive, stopSession, onTurnComplete]);

    useEffect(() => {
        return () => {
            if (isLive) stopSession();
        };
    }, [stopSession]);

    return { isLive, transcript, startSession, stopSession, error };
};
