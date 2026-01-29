
import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { UploadedFile } from '../types';
import { blobStorage } from '../services/blobStorageService';

export const useFileDragAndDrop = () => {
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
        if (!e.dataTransfer.types.includes('Files')) return;
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const processFile = useCallback(async (file: File) => {
        if (file.size > 10 * 1024 * 1024) { 
            alert("File is too large. Please select a file smaller than 10MB.");
            return;
        }
        const isSupported = file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt');
        if (!isSupported) {
             alert("Unsupported file type. Please upload Images, PDFs, or Text files.");
             return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const storageId = uuidv4();
            
            // Persist to IndexedDB immediately to prevent memory issues
            try {
                await blobStorage.saveFile(storageId, base64, file.type);
            } catch (e) {
                console.error("Failed to save to IDB", e);
            }

            const uploadPayload: UploadedFile = { 
                file, 
                base64, // Keep base64 active for the *immediate* API call
                type: file.type,
                storageId 
            };
            
            if (file.type.startsWith('image/')) {
                uploadPayload.url = URL.createObjectURL(file);
            }
            setUploadedFile(uploadPayload);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const clearFile = useCallback(() => {
        setUploadedFile(null);
    }, []);

    return {
        uploadedFile,
        setUploadedFile, // Updated to potentially handle manual sets if needed
        processFile, // Exposed for input[type=file]
        isDragging,
        clearFile,
        dragHandlers: {
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop
        }
    };
};
