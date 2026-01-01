
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * OAuth Authentication Service
 * Handles communication with backend OAuth endpoints
 */

export interface AuthStatus {
    authenticated: boolean;
    user?: {
        email: string;
        name: string;
        picture?: string;
    };
    hasRefreshToken?: boolean;
}

/**
 * Initiate Google OAuth login
 * Opens OAuth flow in popup window
 */
export const loginWithGoogle = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
            `${BACKEND_URL}/auth/google`,
            'Google OAuth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
            reject(new Error('Failed to open popup. Please allow popups for this site.'));
            return;
        }

        // Listen for OAuth callback
        const checkPopup = setInterval(() => {
            try {
                // Check if popup was closed (this may throw Cross-Origin error)
                let popupClosed = false;
                try {
                    popupClosed = popup.closed;
                } catch {
                    // Cross-Origin-Opener-Policy may block this - ignore
                    return;
                }

                if (popupClosed) {
                    clearInterval(checkPopup);
                    // Check auth status after popup closes
                    getAuthStatus().then(status => {
                        resolve(status.authenticated);
                    }).catch(() => {
                        resolve(false);
                    });
                    return;
                }

                // Check if popup navigated back to our domain (callback)
                let popupUrl = '';
                try {
                    popupUrl = popup.location.href;
                } catch {
                    // Cross-origin - popup is still on Google's domain
                    return;
                }

                if (popupUrl.includes(window.location.origin)) {
                    clearInterval(checkPopup);

                    // Check for success/error in URL
                    const url = new URL(popupUrl);
                    const authSuccess = url.searchParams.get('auth_success');
                    const authError = url.searchParams.get('auth_error');

                    popup.close();

                    if (authError) {
                        reject(new Error(`Authentication failed: ${authError}`));
                    } else if (authSuccess) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            } catch {
                // Unexpected error - ignore and continue checking
            }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
            clearInterval(checkPopup);
            if (!popup.closed) {
                popup.close();
            }
            reject(new Error('Authentication timeout'));
        }, 5 * 60 * 1000);
    });
};

/**
 * Get current authentication status
 */
export const getAuthStatus = async (): Promise<AuthStatus> => {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/status`, {
            credentials: 'include' // Include session cookie
        });

        if (!response.ok) {
            throw new Error('Failed to check auth status');
        }

        return await response.json();
    } catch (error) {
        console.error('Auth status check failed:', error);
        return { authenticated: false };
    }
};

/**
 * Logout current user
 */
export const logout = async (): Promise<void> => {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
};

/**
 * Refresh access token
 */
export const refreshToken = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include'
        });

        return response.ok;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
    }
};
