import React, { useState, useCallback } from 'react';
import type { UploadedFile } from '../types';

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

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const file = e.dataTransfer.files?.[0];
        if (file) {
             if (file.size > 4 * 1024 * 1024) { 
                alert("File is too large. Please select a file smaller than 4MB.");
                return;
            }
            const isSupported = file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt');
            if (!isSupported) {
                 alert("Unsupported file type. Please upload Images, PDFs, or Text files.");
                 return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                const uploadPayload: UploadedFile = { file, base64, type: file.type };
                if (file.type.startsWith('image/')) {
                    uploadPayload.url = URL.createObjectURL(file);
                }
                setUploadedFile(uploadPayload);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const clearFile = useCallback(() => {
        setUploadedFile(null);
    }, []);

    return {
        uploadedFile,
        setUploadedFile,
        isDragging,
        clearFile,
        dragHandlers: {
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop
        }
    };
};