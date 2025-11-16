import React, { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponseStream } from './services/geminiService';
import { processPdf, PdfProcessingStrategy } from './services/pdfService';
import { FILE_ANALYSIS_PROMPT, FILE_TEXT_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE, SYSTEM_INSTRUCTION, MODEL_CONFIGS } from './constants';

declare global {
    interface Window {
        pdfjsLib: any;
        webkitAudioContext: typeof AudioContext
    }
}

// --- Audio & Live Session Utilities ---
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


// --- State Management (useReducer) ---

interface LiveTranscript {
    userInput: string;
    modelOutput: string;
    isUserInputFinal: boolean;
}

interface AppState {
    messages: ChatMessage[];
    isLoading: boolean;
    chatMode: ChatMode;
    error: string | null;
    isLiveSessionActive: boolean;
    liveTranscript: LiveTranscript;
}

type AppAction =
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'ADD_RESPONSE_PLACEHOLDER' }
    | { type: 'APPEND_TO_LAST_MESSAGE'; payload: { chunk: string, sources?: any[] } }
    | { type: 'REQUEST_FINISH' }
    | { type: 'ADD_FULL_RESPONSE'; payload: { message: ChatMessage; consumesFile?: boolean } }
    | { type: 'UPDATE_LAST_MESSAGE_CONTENT'; payload: string }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'SET_CHAT_MODE'; payload: ChatMode }
    | { type: 'RESET_CHAT' }
    | { type: 'LIVE_SESSION_START' }
    | { type: 'LIVE_SESSION_STOP' }
    | { type: 'LIVE_TRANSCRIPT_UPDATE'; payload: Partial<LiveTranscript> }
    | { type: 'LIVE_TURN_COMPLETE'; payload: { userInput: string; modelOutput: string } }
    | { type: 'ADD_INTERIM_MESSAGE', payload: ChatMessage };

const savedMessages = localStorage.getItem('mediBriefMessages');
const initialLiveTranscript: LiveTranscript = { userInput: '', modelOutput: '', isUserInputFinal: false };

const initialState: AppState = {
    messages: savedMessages ? JSON.parse(savedMessages) : [],
    isLoading: false,
    chatMode: ChatModeEnum.Auto,
    error: null,
    isLiveSessionActive: false,
    liveTranscript: initialLiveTranscript,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'START_REQUEST':
            return {
                ...state,
                isLoading: true,
                error: null,
                messages: [...state.messages, action.payload.userMessage],
            };
        case 'ADD_RESPONSE_PLACEHOLDER':
            return {
                ...state,
                messages: [...state.messages, { role: 'model', content: '' }]
            };
        case 'APPEND_TO_LAST_MESSAGE': {
            const newMessages = [...state.messages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'model') {
                lastMessage.content += action.payload.chunk;
                if(action.payload.sources && action.payload.sources.length > 0) {
                    lastMessage.sources = action.payload.sources;
                }
            }
            return { ...state, messages: newMessages };
        }
        case 'REQUEST_FINISH':
             return { ...state, isLoading: false };
        case 'ADD_FULL_RESPONSE':
            return {
                ...state,
                isLoading: false,
                messages: [...state.messages, action.payload.message],
            };
        case 'ADD_INTERIM_MESSAGE':
            return {
                ...state,
                messages: [...state.messages, action.payload],
            };
         case 'UPDATE_LAST_MESSAGE_CONTENT': {
            const newMessages = [...state.messages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage) {
                lastMessage.content = action.payload;
            }
            return { ...state, messages: newMessages };
        }
        case 'REQUEST_FAILED': {
             const newMessages = [...state.messages];
             const lastMessage = newMessages[newMessages.length - 1];
             if(lastMessage && lastMessage.role === 'model' && lastMessage.content === '') {
                 lastMessage.content = `Sorry, I encountered an error. Please try again. \n\n**Details:** ${action.payload}`;
             } else {
                 newMessages.push({ role: 'model', content: `Sorry, I encountered an error. Please try again. \n\n**Details:** ${action.payload}` });
             }
            return {
                ...state,
                isLoading: false,
                error: action.payload,
                messages: newMessages
            };
        }
        case 'SET_CHAT_MODE':
            return { ...state, chatMode: action.payload };
        case 'RESET_CHAT':
            return { ...initialState, messages: [], chatMode: state.chatMode };
        case 'LIVE_SESSION_START':
            return { ...state, isLiveSessionActive: true, isLoading: true, error: null };
        case 'LIVE_SESSION_STOP':
            return { ...state, isLiveSessionActive: false, isLoading: false, liveTranscript: initialLiveTranscript };
        case 'LIVE_TRANSCRIPT_UPDATE':
            return { ...state, liveTranscript: { ...state.liveTranscript, ...action.payload } };
        case 'LIVE_TURN_COMPLETE':
            const newMessages: ChatMessage[] = [];
            if(action.payload.userInput) newMessages.push({ role: 'user', content: action.payload.userInput });
            if(action.payload.modelOutput) newMessages.push({ role: 'model', content: action.payload.modelOutput });
            return {
                ...state,
                messages: [...state.messages, ...newMessages],
                liveTranscript: initialLiveTranscript
            };
        default:
            return state;
    }
};

// --- Helper Functions for handleSend Logic ---
const handleLocalCommand = (prompt: string): { isHandled: boolean; response?: ChatMessage } => {
    // ... (rest of the function is unchanged)
    return { isHandled: false };
};
const determineRequestDetails = (prompt: string, chatMode: ChatMode): { finalPrompt: string, modeForRequest: ChatMode, responseType: 'json' | 'text' } => {
    // ... (rest of the function is unchanged)
    return { finalPrompt: prompt, modeForRequest: chatMode, responseType: 'text' };
};

// --- Main App Component ---
const App: React.FC = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { messages, isLoading, chatMode, isLiveSessionActive, liveTranscript } = state;
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

    // Refs for live session
    const liveSessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
        }
    }, []);
    
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('mediBriefMessages', JSON.stringify(messages));
        } else {
            localStorage.removeItem('mediBriefMessages');
        }
    }, [messages]);
    
    const handleClearChat = useCallback(() => {
        dispatch({ type: 'RESET_CHAT' });
    }, []);

    const handleFileUpload = useCallback(async (file: UploadedFile) => {
        // ... (this function remains unchanged)
    }, [messages]);

    const handleSend = useCallback(async (prompt: string) => {
       // ... (this function remains unchanged)
    }, [chatMode, messages, uploadedFile]);
    
    const stopLiveSession = useCallback(() => {
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

        dispatch({ type: 'LIVE_SESSION_STOP' });
    }, []);

    const toggleLiveSession = useCallback(async () => {
        if (isLiveSessionActive) {
            stopLiveSession();
            return;
        }

        dispatch({ type: 'LIVE_SESSION_START' });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            let currentInput = '';
            let currentOutput = '';
            
            const sessionPromise = ai.live.connect({
                model: MODEL_CONFIGS[ChatModeEnum.Live].model,
                config: {
                    ...MODEL_CONFIGS[ChatModeEnum.Live].config,
                    systemInstruction: SYSTEM_INSTRUCTION
                },
                callbacks: {
                    onopen: () => {
                        inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                        outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                        
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
                            const { text, isFinal } = message.serverContent.inputTranscription;
                            currentInput = text;
                            dispatch({ type: 'LIVE_TRANSCRIPT_UPDATE', payload: { userInput: text, isUserInputFinal: isFinal } });
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutput += message.serverContent.outputTranscription.text;
                            dispatch({ type: 'LIVE_TRANSCRIPT_UPDATE', payload: { modelOutput: currentOutput } });
                        }

                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                console.log('Function call received:', fc);

                                const functionName = fc.name;
                                const args = fc.args;
                                let result = "An unknown error occurred executing the function.";

                                if (functionName === 'scheduleAppointment') {
                                    // In a real app, you would call an external API here.
                                    // For this demo, we simulate it and show the action in the chat.
                                    const readableArgs = JSON.stringify(args, null, 2);
                                    const systemMessage = `[FUNCTION CALL: \`${functionName}\`]\n\`\`\`json\n${readableArgs}\n\`\`\``;
                                    dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: systemMessage } });
                                    result = `Successfully requested an appointment for patient ${args.patientId} on ${args.date} at ${args.time}.`;
                                }

                                sessionPromise.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id : fc.id,
                                            name: fc.name,
                                            response: { result: result },
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
                            const finalUserInput = currentInput;
                            const finalModelOutput = currentOutput;
                            dispatch({ type: 'LIVE_TURN_COMPLETE', payload: { userInput: finalUserInput, modelOutput: finalModelOutput } });
                            currentInput = '';
                            currentOutput = '';
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        dispatch({ type: 'REQUEST_FAILED', payload: 'Live session encountered an error.' });
                        stopLiveSession();
                    },
                    onclose: () => {
                         stopLiveSession();
                    },
                },
            });
            liveSessionRef.current = await sessionPromise;

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            if (errorMessage.includes('Permission denied')) {
                 alert('Microphone access was denied. Please allow microphone permission in your browser settings.');
            }
            dispatch({ type: 'REQUEST_FAILED', payload: `Failed to start live session. Error: ${errorMessage}` });
            stopLiveSession();
        }

    }, [isLiveSessionActive, stopLiveSession]);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (isLiveSessionActive) {
                stopLiveSession();
            }
        };
    }, [isLiveSessionActive, stopLiveSession]);

    return (
        <div className="flex flex-col h-screen font-sans">
            <Header currentMode={chatMode} onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })} onClearChat={handleClearChat} />
            <MessageList messages={messages} isLoading={isLoading} isLive={isLiveSessionActive} liveTranscript={liveTranscript} />
            <InputBar
                onSend={handleSend}
                onFileUpload={handleFileUpload}
                onClearFile={() => setUploadedFile(null)}
                setUploadedFile={setUploadedFile}
                uploadedFile={uploadedFile}
                isLoading={isLoading}
                currentMode={chatMode}
                toggleLiveSession={toggleLiveSession}
                isLiveSessionActive={isLiveSessionActive}
            />
        </div>
    );
};

export default App;