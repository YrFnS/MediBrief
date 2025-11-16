import React, { useState, useCallback } from 'react';
import type { ChatMessage, ChatMode, UploadedFile } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponse } from './services/geminiService';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE } from './constants';

const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState<ChatMode>(ChatModeEnum.Auto);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

    const handleFileUpload = useCallback(async (file: UploadedFile) => {
        setUploadedFile(file);
        setIsLoading(true);
        setError(null);

        const analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name);
        const userMessage: ChatMessage = {
            role: 'user',
            content: analysisPrompt, // Full prompt for history
            displayContent: `Analyzing file: ${file.file.name}`, // Clean message for UI
            filePreview: { url: file.url, type: file.type },
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            // File analysis always uses standard mode
            const response = await generateResponse(analysisPrompt, messages, ChatModeEnum.Standard, file);
            
            const modelMessage: ChatMessage = {
                role: 'model',
                content: response.text,
            };
            setMessages(prev => [...prev, modelMessage]);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Failed to analyze file. Error: ${errorMessage}`);
            const errorBotMessage: ChatMessage = {
                role: 'model',
                content: `Sorry, I encountered an error analyzing the file. Please try again. \n\n**Details:** ${errorMessage}`,
            };
            setMessages((prev) => [...prev, errorBotMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages]);

    const handleSend = useCallback(async (prompt: string) => {
        if (!prompt.trim() && !uploadedFile) return;

        setIsLoading(true);
        setError(null);

        const userMessage: ChatMessage = {
            role: 'user',
            content: prompt,
            displayContent: prompt,
            filePreview: uploadedFile ? { url: uploadedFile.url, type: uploadedFile.type } : undefined,
        };
        
        const lowerCasePrompt = prompt.trim().toLowerCase();

        // Handle local commands that don't need an AI call
        if (lowerCasePrompt.startsWith('/')) {
            const [command, ...args] = prompt.trim().split(' ');
            const argument = args.join(' ');

            if (command === '/help') {
                const helpResponse: ChatMessage = { role: 'model', content: HELP_COMMAND_RESPONSE };
                setMessages(prev => [...prev, userMessage, helpResponse]);
                setIsLoading(false);
                return;
            }

            if ((command === '/patient' || command === '/drugs') && !argument) {
                const usage = command === '/patient' ? '`/patient [ID]`' : '`/drugs [name]`';
                const errorResponse: ChatMessage = { role: 'model', content: `Please provide an argument. Usage: ${usage}` };
                setMessages(prev => [...prev, userMessage, errorResponse]);
                setIsLoading(false);
                return;
            }
        }

        setMessages(prev => [...prev, userMessage]);

        let finalPrompt = prompt;
        let modeForRequest: ChatMode | undefined;

        // 1. Handle specific commands that dictate a mode
        const isBriefingRequest = BRIEFING_TRIGGERS.some(trigger => lowerCasePrompt.includes(trigger)) || lowerCasePrompt.startsWith('/brief');

        if (isBriefingRequest) {
            finalPrompt = SHIFT_BRIEFING_PROMPT();
            modeForRequest = ChatModeEnum.Deep; // Briefings are important, use Deep
        } else if (lowerCasePrompt.startsWith('/patient')) {
            finalPrompt = `Show patient summary for ${prompt.trim().split(' ').slice(1).join(' ')}`;
        } else if (lowerCasePrompt.startsWith('/drugs')) {
            finalPrompt = `Tell me about ${prompt.trim().split(' ').slice(1).join(' ')}`;
            modeForRequest = ChatModeEnum.Web; // Drug info needs web search
        } else if (lowerCasePrompt.startsWith('/export')) {
            finalPrompt = 'export briefing';
        }

        // 2. Determine mode if not already set by a command
        if (!modeForRequest) {
            if (chatMode === ChatModeEnum.Auto) {
                // Auto mode heuristics for non-command prompts
                if (/\b(latest|current|news|who is|what is|define)\b/i.test(prompt)) {
                    modeForRequest = ChatModeEnum.Web;
                } else if (prompt.length > 200) {
                    modeForRequest = ChatModeEnum.Deep;
                } else if (prompt.length < 60) {
                    modeForRequest = ChatModeEnum.Quick;
                } else {
                    modeForRequest = ChatModeEnum.Standard;
                }
            } else {
                // User has selected a specific mode
                modeForRequest = chatMode;
            }
        }
        
        // 3. Final override: File upload ALWAYS uses Standard mode for analysis.
        if (uploadedFile) {
            modeForRequest = ChatModeEnum.Standard;
        }

        try {
            const response = await generateResponse(finalPrompt, messages, modeForRequest, uploadedFile || undefined);
            
            const text = response.text;
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

            const modelMessage: ChatMessage = {
                role: 'model',
                content: text,
                sources: groundingChunks,
            };
            setMessages(prev => [...prev, modelMessage]);

        } catch (e) {
            console.error(e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Failed to get response from AI. Error: ${errorMessage}`);
            const errorBotMessage: ChatMessage = {
                role: 'model',
                content: `Sorry, I encountered an error. Please try again. \n\n**Details:** ${errorMessage}`,
            };
            setMessages((prev) => [...prev, errorBotMessage]);
        } finally {
            setIsLoading(false);
            if (prompt.trim() || uploadedFile) {
                if (userMessage.role === 'user') {
                     // The requirement is to keep the file in memory.
                }
            }
        }
    }, [chatMode, messages, uploadedFile]);
    
    const handleClearFile = useCallback(() => {
        setUploadedFile(null);
    }, []);


    return (
        <div className="flex flex-col h-screen font-sans">
            <Header currentMode={chatMode} onModeChange={setChatMode} />
            <MessageList messages={messages} />
            <InputBar 
                onSend={handleSend} 
                onFileUpload={handleFileUpload}
                onClearFile={handleClearFile}
                uploadedFile={uploadedFile}
                isLoading={isLoading} 
                currentMode={chatMode} 
            />
        </div>
    );
};

export default App;