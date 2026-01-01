import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// Lazy initialization - OAuth client created on first use (after dotenv loads)
let oauth2Client = null;
function getOAuth2Client() {
    if (!oauth2Client) {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            throw new Error('OAuth credentials not configured. Check server/.env file.');
        }

        oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `http://localhost:${process.env.PORT || 3001}/auth/google/callback`
        );

        console.log('✓ OAuth2 client initialized');
        console.log('  Client ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...');
        console.log('  Redirect URI:', `http://localhost:${process.env.PORT || 3001}/auth/google/callback`);
    }
    return oauth2Client;
}

// Scopes required for Gemini API access (from Google's Antigravity OAuth)
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/cclog',
    'https://www.googleapis.com/auth/experimentsandconfigs'
];

/**
 * GET /auth/google
 * Initiates OAuth flow by redirecting to Google consent screen
 */
router.get('/google', (req, res) => {
    const client = getOAuth2Client();
    const authUrl = client.generateAuthUrl({
        access_type: 'offline', // Get refresh token
        scope: SCOPES,
        prompt: 'consent' // Force consent screen to ensure refresh token
    });

    res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles OAuth callback from Google
 */
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error('OAuth error:', error);
        return res.redirect(`${process.env.CLIENT_URL}?auth_error=${error}`);
    }

    if (!code) {
        return res.redirect(`${process.env.CLIENT_URL}?auth_error=no_code`);
    }

    try {
        const client = getOAuth2Client();

        // Exchange authorization code for tokens
        const { tokens } = await client.getToken(code);

        // Store tokens in session
        req.session.tokens = tokens;
        req.session.isAuthenticated = true;

        // Get user info
        client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const userInfo = await oauth2.userinfo.get();

        req.session.userInfo = {
            email: userInfo.data.email,
            name: userInfo.data.name,
            picture: userInfo.data.picture
        };

        await req.session.save();

        console.log(`✓ User authenticated: ${userInfo.data.email}`);

        // Redirect back to frontend with success
        res.redirect(`${process.env.CLIENT_URL}?auth_success=true`);
    } catch (error) {
        console.error('Token exchange error:', error);
        res.redirect(`${process.env.CLIENT_URL}?auth_error=token_exchange_failed`);
    }
});

/**
 * GET /auth/status
 * Check if user is authenticated and return user info
 */
router.get('/status', (req, res) => {
    if (req.session.isAuthenticated && req.session.tokens) {
        res.json({
            authenticated: true,
            user: req.session.userInfo,
            hasRefreshToken: !!req.session.tokens.refresh_token
        });
    } else {
        res.json({ authenticated: false });
    }
});

/**
 * POST /auth/logout
 * Clear session and logout user
 */
router.post('/logout', async (req, res) => {
    const email = req.session.userInfo?.email;

    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }

        console.log(`✓ User logged out: ${email || 'unknown'}`);
        res.json({ success: true });
    });
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
    if (!req.session.tokens?.refresh_token) {
        return res.status(401).json({ error: 'No refresh token available' });
    }

    try {
        const client = getOAuth2Client();
        client.setCredentials({
            refresh_token: req.session.tokens.refresh_token
        });

        const { credentials } = await client.refreshAccessToken();

        // Update tokens in session
        req.session.tokens = {
            ...req.session.tokens,
            ...credentials
        };

        await req.session.save();

        res.json({
            success: true,
            access_token: credentials.access_token
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

export default router;
