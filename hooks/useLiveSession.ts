
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';
import { ChatMode, ChatMessage } from '../types';
import { useSettingsStore } from '../features/settings/useSettingsStore';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// Type definition for the object expected by session.sendRealtimeInput
type LiveInputMedia = {
    data: string;
    mimeType: string;
};

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

const createBlob = (data: Float32Array): LiveInputMedia => {
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

interface LiveSessionOptions {
    onTurnComplete?: (userInput: string, modelOutput: string) => void;
    onToolCall?: (toolName: string, args: any) => void;
}

export const useLiveSession = ({ onTurnComplete, onToolCall }: LiveSessionOptions = {}): UseLiveSessionReturn => {
    const [isLive, setIsLive] = useState(false);
    const [transcript, setTranscript] = useState({ userInput: '', modelOutput: '' });
    const [error, setError] = useState<string | null>(null);

    const { geminiApiKey } = useSettingsStore();

    const accumulatedTranscriptRef = useRef({ userInput: '', modelOutput: '' });
    const liveSessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    // Processors
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const workletSupportedRef = useRef<boolean>(false);
    
    const isStoppingRef = useRef(false);

    const stopSession = useCallback(async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        try {
            // 1. Close the session socket first
            if (liveSessionRef.current) {
                liveSessionRef.current.close();
                liveSessionRef.current = null;
            }

            // 2. Disconnect audio nodes
            workletNodeRef.current?.disconnect();
            scriptProcessorRef.current?.disconnect();
            mediaStreamSourceRef.current?.disconnect();
            
            workletNodeRef.current = null;
            scriptProcessorRef.current = null;
            mediaStreamSourceRef.current = null;

            // 3. Stop all playing audio
            audioSourcesRef.current.forEach(source => {
                try { source.stop(); } catch(e) {}
            });
            audioSourcesRef.current.clear();

            // 4. Suspend AudioContexts cleanly
            if (inputAudioContextRef.current && inputAudioContextRef.current.state === 'running') {
                try { await inputAudioContextRef.current.suspend(); } catch(e) { console.warn("Input suspend failed", e); }
            }
            if (outputAudioContextRef.current && outputAudioContextRef.current.state === 'running') {
                try { await outputAudioContextRef.current.suspend(); } catch(e) { console.warn("Output suspend failed", e); }
            }

            nextStartTimeRef.current = 0;
            
            // 5. Finalize transcript
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
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Media API not available. Secure context (HTTPS) required.");
            }

            if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
                inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
                outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            }
            
            if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
            if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

            // Load AudioWorklet from File (CSP Compliant)
            try {
                await inputAudioContextRef.current.audioWorklet.addModule('/workers/pcm-processor.js');
                workletSupportedRef.current = true;
            } catch (e) {
                console.warn("AudioWorklet module load failed, defaulting to ScriptProcessor fallback:", e);
                workletSupportedRef.current = false;
            }

            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    } 
                });
            } catch (mediaError: any) {
                if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
                    throw new Error("No microphone found on this device.");
                }
                if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                    throw new Error("Microphone permission denied by user.");
                }
                throw mediaError;
            }
            
            setIsLive(true);
            
            const apiKey = geminiApiKey || process.env.API_KEY || '';
            if (!apiKey) {
                throw new Error("Gemini API Key is required for Live Mode.");
            }
            const ai = new GoogleGenAI({ apiKey });

            let contextString = "";
            if (history.length > 0) {
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
                        
                        if (workletSupportedRef.current) {
                            try {
                                workletNodeRef.current = new AudioWorkletNode(inputAudioContextRef.current, 'pcm-processor');
                                workletNodeRef.current.port.onmessage = (event) => {
                                    const inputData = event.data;
                                    const pcmBlob = createBlob(inputData);
                                    sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
                                };
                                mediaStreamSourceRef.current.connect(workletNodeRef.current);
                                workletNodeRef.current.connect(inputAudioContextRef.current.destination);
                            } catch (e) {
                                console.error("Worklet creation failed:", e);
                                workletSupportedRef.current = false; 
                                fallbackToScriptProcessor(sessionPromise);
                            }
                        } else {
                            fallbackToScriptProcessor(sessionPromise);
                        }
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
                                
                                // Notify UI immediately
                                if (onToolCall) {
                                    onToolCall(fc.name, fc.args);
                                }

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
                            if (outCtx.state === 'suspended') await outCtx.resume();
                            
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
            
            let errMsg = "Microphone or connection failed.";
            const msg = e.message || e.toString();
            
            if (msg.includes('No microphone found')) {
                errMsg = "No microphone detected. Please connect a microphone.";
            } else if (msg.includes('permission denied')) {
                errMsg = "Microphone access denied. Please allow permissions.";
            } else if (msg.includes('Media API not available')) {
                errMsg = "Voice is not supported in this browser context (HTTPS required).";
            } else {
                errMsg = "Live connection failed: " + msg;
            }
            
            setError(errMsg);
        }
    }, [isLive, stopSession, onTurnComplete, onToolCall]);

    const fallbackToScriptProcessor = (sessionPromise: Promise<LiveSession>) => {
        if (!inputAudioContextRef.current || !mediaStreamSourceRef.current) return;
        
        console.log("Using ScriptProcessorNode fallback for audio input.");
        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
        };
        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
    };

    // FIXED: Unconditional cleanup on unmount to prevent zombie streams.
    useEffect(() => {
        return () => { 
            // We do NOT check isLive here because the closure might have a stale false value.
            // stopSession is idempotent and checks internal refs/flags.
            stopSession(); 
        };
    }, [stopSession]);

    return { isLive, transcript, startSession, stopSession, error };
};
