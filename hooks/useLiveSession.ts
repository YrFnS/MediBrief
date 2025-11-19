
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';
import { ChatMode, ChatMessage } from '../types';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

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
    const clamped = Math.max(-1, Math.min(1, data[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
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
    startSession: (history?: ChatMessage[]) => Promise<void>;
    stopSession: () => Promise<void>;
    error: string | null;
}

export const useLiveSession = (onTurnComplete?: (userInput: string, modelOutput: string) => void): UseLiveSessionReturn => {
    const [isLive, setIsLive] = useState(false);
    const [transcript, setTranscript] = useState({ userInput: '', modelOutput: '' });
    const [error, setError] = useState<string | null>(null);

    const accumulatedTranscriptRef = useRef({ userInput: '', modelOutput: '' });
    const liveSessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const isStoppingRef = useRef(false);

    const stopSession = useCallback(async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        try {
            liveSessionRef.current?.close();
            liveSessionRef.current = null;

            scriptProcessorRef.current?.disconnect();
            mediaStreamSourceRef.current?.disconnect();
            scriptProcessorRef.current = null;
            mediaStreamSourceRef.current = null;

            audioSourcesRef.current.forEach(source => {
                try { source.stop(); } catch(e) {}
            });
            audioSourcesRef.current.clear();

            // Robust context suspension
            if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
                await inputAudioContextRef.current.suspend();
            }
            if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                await outputAudioContextRef.current.suspend();
            }

            nextStartTimeRef.current = 0;
            
            if ((accumulatedTranscriptRef.current.userInput || accumulatedTranscriptRef.current.modelOutput) && onTurnComplete) {
                onTurnComplete(accumulatedTranscriptRef.current.userInput, accumulatedTranscriptRef.current.modelOutput);
            }
            
            accumulatedTranscriptRef.current = { userInput: '', modelOutput: '' };
            setTranscript({ userInput: '', modelOutput: '' });
        } catch (e) {
            console.error("Error during session stop:", e);
        } finally {
            setIsLive(false);
            isStoppingRef.current = false;
        }
    }, [onTurnComplete]);

    const startSession = useCallback(async (history: ChatMessage[] = []) => {
        if (isLive || isStoppingRef.current) return;

        setError(null);
        accumulatedTranscriptRef.current = { userInput: '', modelOutput: '' };

        try {
            // Re-use contexts or create new ones
            if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
                inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
                outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            }
            
            if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
            if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

            setIsLive(true);

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                } 
            });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            let contextString = "";
            if (history.length > 0) {
                // Simplified context string to reduce token load
                const recentHistory = history.slice(-6).filter(m => m.content).map(m => {
                    const content = m.content.length > 200 ? m.content.substring(0, 200) + "..." : m.content;
                    return `${m.role.toUpperCase()}: ${content}`;
                }).join("\n");
                
                contextString = `\n\n[CONTEXT: ${recentHistory}]`;
            }

            const sessionPromise = ai.live.connect({
                model: MODEL_CONFIGS[ChatMode.Live].model,
                config: {
                    ...MODEL_CONFIGS[ChatMode.Live].config,
                    systemInstruction: SYSTEM_INSTRUCTION + contextString
                },
                callbacks: {
                    onopen: async () => {
                        if (!inputAudioContextRef.current) return;
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            if (!inputAudioContextRef.current || inputAudioContextRef.current.state !== 'running') return;
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
                            accumulatedTranscriptRef.current.userInput += message.serverContent.inputTranscription.text;
                            setTranscript(prev => ({ ...prev, userInput: accumulatedTranscriptRef.current.userInput }));
                        }
                        if (message.serverContent?.outputTranscription) {
                            accumulatedTranscriptRef.current.modelOutput += message.serverContent.outputTranscription.text;
                            setTranscript(prev => ({ ...prev, modelOutput: accumulatedTranscriptRef.current.modelOutput }));
                        }

                        if (message.toolCall) {
                             for (const fc of message.toolCall.functionCalls) {
                                // Mock function execution
                                const result = { result: "Success" };
                                sessionPromise.then((session) => {
                                    if (liveSessionRef.current) {
                                        session.sendToolResponse({
                                            functionResponses: [{ id: fc.id, name: fc.name, response: result }]
                                        });
                                    }
                                });
                            }
                        }

                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            const outCtx = outputAudioContextRef.current;
                            if (outCtx.state !== 'running') await outCtx.resume();
                            
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
                            audioSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }

                        if (message.serverContent?.turnComplete) {
                             if (onTurnComplete) {
                                onTurnComplete(accumulatedTranscriptRef.current.userInput, accumulatedTranscriptRef.current.modelOutput);
                            }
                            accumulatedTranscriptRef.current = { userInput: '', modelOutput: '' };
                            setTranscript({ userInput: '', modelOutput: '' });
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        stopSession();
                    },
                    onclose: () => { stopSession(); },
                },
            });
            
            const session = await sessionPromise;
            if (isStoppingRef.current) {
                session.close();
                return;
            }
            liveSessionRef.current = session;

        } catch (e: any) {
            console.error("Live start failed", e);
            stopSession();
            setError("Microphone or connection failed.");
        }
    }, [isLive, stopSession, onTurnComplete]);

    useEffect(() => {
        return () => { if (isLive) stopSession(); };
    }, [stopSession]);

    return { isLive, transcript, startSession, stopSession, error };
};
