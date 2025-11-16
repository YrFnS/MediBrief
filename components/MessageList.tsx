import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import Message from './Message';
import WelcomeScreen from './WelcomeScreen';
import { BotIcon } from './icons';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    if (messages.length === 0) {
        return <WelcomeScreen />;
    }

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, index) => (
                    <Message key={index} message={msg} />
                ))}
                
                {isLoading && messages.length > 0 && (
                    <div className="flex items-start gap-4 animate-pulse">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-500">
                            <BotIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="w-full max-w-full rounded-xl p-4 bg-white dark:bg-slate-800 shadow flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-full animation-delay-0"></span>
                            <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse delay-200"></span>
                            <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse delay-400"></span>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>
        </main>
    );
};

export default MessageList;
