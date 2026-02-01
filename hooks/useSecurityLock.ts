
import { useState, useEffect, useRef, useCallback } from 'react';

// --- IDLE TIMER CONSTANTS ---
const PRIVACY_BLUR_MS = 2 * 60 * 1000; // 2 Minutes -> Blur
const AUTO_LOCK_MS = 15 * 60 * 1000;   // 15 Minutes -> Full Lock

export const useSecurityLock = () => {
    const [isLocked, setIsLocked] = useState(false);
    const [isBlurred, setIsBlurred] = useState(false);
    const lastActivityRef = useRef(Date.now());

    // Reset timer on user interaction
    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        setIsBlurred(prev => prev ? false : prev); // Optimistic unblur
    }, []);

    // Unlock function
    const unlock = useCallback(() => {
        lastActivityRef.current = Date.now();
        setIsLocked(false);
        setIsBlurred(false);
    }, []);

    useEffect(() => {
        const checkIdle = () => {
            const idleTime = Date.now() - lastActivityRef.current;
            
            if (idleTime > AUTO_LOCK_MS) {
                setIsLocked(true);
            } else if (idleTime > PRIVACY_BLUR_MS) {
                setIsBlurred(true);
            }
        };

        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('touchstart', resetTimer);
        window.addEventListener('scroll', resetTimer);
        
        const intervalId = setInterval(checkIdle, 5000); 

        return () => {
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('touchstart', resetTimer);
            window.removeEventListener('scroll', resetTimer);
            clearInterval(intervalId);
        };
    }, [resetTimer]);

    return { isLocked, isBlurred, unlock };
};
