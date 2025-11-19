
import React, { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile, LiveTranscript } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponseStream } from './services/geminiService';
import { processPdf, PdfProcessingStrategy } from './services/pdfService';
import { exportBriefingToPdf } from './services/exportService';
import { cleanJsonOutput, isJsonBriefing } from './utils';
import { FILE_ANALYSIS_PROMPT, FILE_TEXT_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE, SYSTEM_INSTRUCTION, MODEL_CONFIGS } from './constants';

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
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

// --- Error Handling Helper ---
const getFriendlyErrorMessage = (error: unknown): string => {
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        try {
            // Attempt to parse the error message as JSON, which is common for API errors
            const errorObj = JSON.parse(error.message);
            if (errorObj.error && errorObj.error.message) {
                const message = errorObj.error.message.toLowerCase();
                if (message.includes('overloaded') || message.includes('too many requests') || errorObj.error.code === 503 || errorObj.error.code === 500) {
                    return 'The service is currently experiencing high demand. Please wait a moment and try again.';
                }
                 if (message.includes('api key not valid')) {
                    return 'The API key is not valid. Please check your configuration.';
                }
                return errorObj.error.message; // Return the specific message from the API
            } else {
                return error.message; // Not the expected JSON format, return raw message
            }
        } catch (parseError) {
            // If it's not a JSON string, return the raw message.
            // Also check for common non-JSON error messages.
            if (error.message.toLowerCase().includes('permission denied')) {
                return 'Microphone access was denied. Please allow microphone permission in your browser settings.';
            }
            return error.message;
        }
    } else if (typeof error === 'string') {
        return error;
    }
    return errorMessage;
};


// --- State Management (useReducer) ---

// Correctly infer the LiveSession type from the instance method
type LiveSession = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>>;

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

const getInitialMessages = (): ChatMessage[] => {
    try {
        const savedMessages = localStorage.getItem('mediBriefMessages');
        if (savedMessages) {
            const parsed = JSON.parse(savedMessages);
            // Basic validation to ensure it's an array of messages
            if (Array.isArray(parsed) && parsed.every(m => 'role' in m && 'content' in m)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Failed to parse messages from localStorage. Clearing corrupted data.", error);
        localStorage.removeItem('mediBriefMessages');
    }
    return [];
};

const initialLiveTranscript: LiveTranscript = { userInput: '', modelOutput: '' };

const initialState: AppState = {
    messages: getInitialMessages(),
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
                lastMessage.content += action.payload.chunk || '';
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
        if (messages.length > 0) {
            localStorage.setItem('mediBriefMessages', JSON.stringify(messages));
        } else {
            localStorage.removeItem('mediBriefMessages');
        }
    }, [messages]);
    
    const handleClearChat = useCallback(() => {
        dispatch({ type: 'RESET_CHAT' });
    }, []);

    /**
     * @param prompt The text prompt to send.
     * @param fileOverride Optional file to use instead of the state's uploadedFile.
     * @param displayOverride Optional text to display in the user's chat bubble instead of the prompt.
     * @param skipFileSending If true, the file is shown in the UI preview but NOT sent to the API (used when we extract text client-side to save tokens).
     */
    const handleSend = useCallback(async (prompt: string, fileOverride?: UploadedFile, displayOverride?: string, skipFileSending: boolean = false) => {
        const trimmedPrompt = prompt.trim();
        const currentFile = fileOverride || uploadedFile;

        if (!trimmedPrompt && !currentFile) return;
        
        // Command to directly export the briefing as a PDF
        if (trimmedPrompt.toLowerCase() === '/export') {
            dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '📥 Generating your briefing for PDF export. This may take a moment...' } });
            try {
                const history = messages.filter(m => !isJsonBriefing(m.content));
                const modeForRequest = ChatModeEnum.Deep;
                const briefingPrompt = SHIFT_BRIEFING_PROMPT();

                const stream = generateResponseStream(briefingPrompt, history, modeForRequest, { responseType: 'json' });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    fullResponseText += chunk.text;
                }
                
                const cleanedJson = cleanJsonOutput(fullResponseText);

                if (!cleanedJson.startsWith('{')) {
                    throw new Error("The model did not return a valid briefing. Ensure there is enough context in the chat to generate a report.");
                }
                
                const parsedBriefing = JSON.parse(cleanedJson);
                await exportBriefingToPdf(parsedBriefing);

                dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: '✅ Your shift briefing PDF has been downloaded successfully.' });
            } catch (e) {
                const friendlyError = getFriendlyErrorMessage(e);
                const finalMessage = `Sorry, I couldn't generate the PDF. Please try again.\n\n**Error:** ${friendlyError}`;
                dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: finalMessage });
            }
            return;
        }

        if (trimmedPrompt.toLowerCase() === '/help') {
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: '/help' } }});
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: HELP_COMMAND_RESPONSE } } });
             return;
        }

        let finalPrompt = trimmedPrompt;
        let modeForRequest: ChatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';

        // Determine mode and prompt based on commands or user selection
        if (isBriefingCommand) {
            finalPrompt = SHIFT_BRIEFING_PROMPT();
            modeForRequest = ChatModeEnum.Deep;
            responseType = 'json';
        } else if (trimmedPrompt.toLowerCase().startsWith('/patient')) {
            modeForRequest = ChatModeEnum.Deep;
        } else if (chatMode === ChatModeEnum.Live) {
            // If user sends text while in Live mode (which is audio-centric), 
            // fall back to the smart Auto mode so they get a text response with tools if needed.
            modeForRequest = ChatModeEnum.Auto;
        } else {
            // Respect user's manual mode selection if no command is found
            modeForRequest = chatMode;
        }

        const userMessage: ChatMessage = { role: 'user', content: finalPrompt };
        if(displayOverride) {
            userMessage.displayContent = displayOverride;
        }
        
        if (currentFile) {
            // Store the base64 data in the message history so the model can see it later
            userMessage.filePreview = { 
                name: currentFile.file.name, 
                type: currentFile.type, 
                url: currentFile.url,
                base64: currentFile.base64 
            };
        }
        
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });
        if(!fileOverride) setUploadedFile(null);

        try {
            const history = [...messages];
            // Optimization: If skipFileSending is true, we pass undefined for the file so it isn't sent to the API.
            const fileToSend = skipFileSending ? undefined : currentFile;
            const stream = generateResponseStream(finalPrompt, history, modeForRequest, { file: fileToSend, responseType });
            
            for await (const chunk of stream) {
                const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: chunk.text || '', sources } });
            }
        } catch (e) {
            const friendlyError = getFriendlyErrorMessage(e);
            dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
        }
    }, [chatMode, messages, uploadedFile]);

    const handleFileUpload = useCallback(async (file: UploadedFile) => {
        try {
            let analysisPrompt: string;
            let displayMessage = `Analyzing file: ${file.file.name}`;
            let skipFileSending = false;

            if (file.type === 'application/pdf') {
                const pdfResult = await processPdf(file.file);
                if (pdfResult.strategy === PdfProcessingStrategy.TEXT_EXTRACTION && pdfResult.extractedText) {
                    // Token Optimization: If we extracted text, sending the text is enough.
                    // We do NOT need to send the PDF bytes, saving massive amounts of tokens.
                    analysisPrompt = FILE_TEXT_ANALYSIS_PROMPT(file.file.name, pdfResult.extractedText);
                    skipFileSending = true;
                } else {
                    analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name); // Fallback to OCR
                }
            } else if (file.type === 'text/plain' || file.file.name.endsWith('.txt') || file.file.name.endsWith('.md') || file.file.name.endsWith('.csv') || file.file.name.endsWith('.json')) {
                 // Text File Optimization: Read directly and send as text part.
                 const textContent = await file.file.text();
                 analysisPrompt = FILE_TEXT_ANALYSIS_PROMPT(file.file.name, textContent);
                 skipFileSending = true;
            } else {
                analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name);
            }
            
            // We pass the file to handleSend so it shows the UI preview, 
            // but we use skipFileSending=true to prevent sending bytes to the API if we already extracted text.
            await handleSend(analysisPrompt, file, displayMessage, skipFileSending);

        } catch (error) {
            const friendlyError = getFriendlyErrorMessage(error);
            dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
        }
    }, [handleSend]);
    
    const handleExportChat = useCallback(() => {
        handleSend('/export');
    }, [handleSend]);

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

        // CRITICAL: Initialize/Resume audio contexts synchronously within the user click event.
        // This is required for Safari/Mobile browsers to allow audio playback.
        try {
            if (!inputAudioContextRef.current) {
                inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            }
            
            if (inputAudioContextRef.current.state === 'suspended') {
                await inputAudioContextRef.current.resume();
            }
            if (outputAudioContextRef.current.state === 'suspended') {
                await outputAudioContextRef.current.resume();
            }
        } catch (err) {
            console.error("Error initializing audio contexts", err);
            dispatch({ type: 'REQUEST_FAILED', payload: "Could not initialize audio device. Please check permissions." });
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
                    onopen: async () => {
                        // Audio Contexts are already initialized and resumed above in the click handler.
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
                            currentInput = text;
                            dispatch({ type: 'LIVE_TRANSCRIPT_UPDATE', payload: { userInput: text } });
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
                        const errorMessage = e.message || 'Live session encountered an error.';
                        dispatch({ type: 'REQUEST_FAILED', payload: errorMessage });
                        stopLiveSession();
                    },
                    onclose: () => {
                         stopLiveSession();
                    },
                },
            });
            liveSessionRef.current = await sessionPromise;

        } catch (e) {
            const friendlyError = getFriendlyErrorMessage(e);
            if (friendlyError.includes('Microphone access was denied')) {
                 alert(friendlyError);
            }
            dispatch({ type: 'REQUEST_FAILED', payload: `Failed to start live session. Error: ${friendlyError}` });
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
        <div className="flex flex-col h-screen font-sans overflow-hidden">
            <Header
                currentMode={chatMode}
                onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                onClearChat={handleClearChat}
                onExportChat={handleExportChat}
            />
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
