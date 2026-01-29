
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChatMessage, GroundingSource } from '../../../types';

interface ChatState {
    chats: Record<string, ChatMessage[]>;
}

interface ChatActions {
    actions: {
        initializeChat: (patientId: string) => void;
        deleteChat: (patientId: string) => void;
        resetChat: (patientId: string) => void;
        
        // Message Operations
        addMessage: (patientId: string, message: ChatMessage) => void;
        addResponsePlaceholder: (patientId: string) => void;
        appendToLastMessage: (patientId: string, chunk: string, sources?: GroundingSource[]) => void;
        updateLastMessageContent: (patientId: string, content: string) => void;
    }
}

export const useChatStore = create<ChatState & ChatActions>()(
    persist(
        (set) => ({
            chats: {},
            actions: {
                initializeChat: (patientId) => set((state) => {
                    if (state.chats[patientId]) return state;
                    return { chats: { ...state.chats, [patientId]: [] } };
                }),
                deleteChat: (patientId) => set((state) => {
                    const newChats = { ...state.chats };
                    delete newChats[patientId];
                    return { chats: newChats };
                }),
                resetChat: (patientId) => set((state) => ({
                    chats: { ...state.chats, [patientId]: [] }
                })),
                
                addMessage: (patientId, message) => set((state) => ({
                    chats: {
                        ...state.chats,
                        [patientId]: [...(state.chats[patientId] || []), message]
                    }
                })),
                
                addResponsePlaceholder: (patientId) => set((state) => ({
                    chats: {
                        ...state.chats,
                        [patientId]: [...(state.chats[patientId] || []), { role: 'model', content: '' }]
                    }
                })),
                
                appendToLastMessage: (patientId, chunk, sources) => set((state) => {
                    const history = [...(state.chats[patientId] || [])];
                    const lastMsg = history[history.length - 1];
                    
                    if (lastMsg && lastMsg.role === 'model') {
                        lastMsg.content += chunk;
                        if (sources) {
                            const existing = lastMsg.sources || [];
                            // Dedup sources
                            const newSources = sources.filter(ns => 
                                !existing.some(es => 
                                    (es.web?.uri && es.web.uri === ns.web?.uri) || 
                                    (es.maps?.uri && es.maps.uri === ns.maps?.uri)
                                )
                            );
                            lastMsg.sources = [...existing, ...newSources];
                        }
                    }
                    
                    return {
                        chats: { ...state.chats, [patientId]: history }
                    };
                }),

                updateLastMessageContent: (patientId, content) => set((state) => {
                    const history = [...(state.chats[patientId] || [])];
                    const lastMsg = history[history.length - 1];
                    if (lastMsg) lastMsg.content = content;
                    
                    return {
                        chats: { ...state.chats, [patientId]: history }
                    };
                })
            }
        }),
        {
            name: 'medibrief-chat-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
