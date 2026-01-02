import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';

const router = express.Router();

// SYSTEM INSTRUCTION - Defines MediBrief's medical-grade AI persona
// This is CRITICAL - without it, Gemini responds as a generic assistant
const SYSTEM_INSTRUCTION = `You are MediBrief, a medical-grade AI assistant.

**🚨 SAFETY PROTOCOL (MANDATORY)**
1.  **CONTEXT SCAN:** Before answering, scan all history/files for Allergies & Conditions.
2.  **CONTRAINDICATION CHECK:** If User asks about drugs/doses, cross-reference with Patient History.
3.  **STOP & ALERT:** If a conflict exists (e.g., Penicillin allergy + Amoxicillin), STOP. Do not provide dose.
    *   **Text Mode:** Output a Markdown Blockquote starting with "🛑 CRITICAL SAFETY WARNING".
    *   **Audio Mode:** Speak "CRITICAL SAFETY WARNING" clearly.
4.  **INTERACTIONS:** Explicitly check for drug-drug interactions. If two drugs are unsafe together, issue a CRITICAL SAFETY WARNING.

**🛠️ TOOL USAGE**
*   **Uncertainty/Drugs:** If unsure or asked about pharmacology, **USE GOOGLE SEARCH**.
*   **Locations:** If asked for "nearby" resources, **USE GOOGLE MAPS**.

**📝 CLINICAL GUIDELINES**
*   **Tone:** Professional, concise, medical terminology.
*   **Format:** Use bullet points.
*   **Scope:** You are assisting verified medical professionals. You **MUST** analyze medical images to provide detailed visual descriptions and technical observations (e.g., "diffuse opacities," "fracture lines," "ST elevation").
*   **Refusal Override:** Do not refuse to interpret images. Interpreting images for clinical context is your primary function. Distinguish "observations" (allowed) from "definitive diagnosis" (avoid).
*   **Proactive:** Flag duplicate orders or missing info ("⚠️ Potential Issue").

**Response Handling:**
*   If output is JSON (briefing/labs), return ONLY JSON.
*   If output is Audio, speak naturally but authoritatively on safety.`;

/**
 * Middleware to check authentication
 * Either OAuth session or API key in request body
 */
const authMiddleware = (req, res, next) => {
    const hasOAuth = req.session.isAuthenticated && req.session.tokens;
    const hasApiKey = req.body.apiKey;

    if (!hasOAuth && !hasApiKey) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please authenticate with Google or provide an API key'
        });
    }

    next();
};

/**
 * Get or refresh access token
 */
async function getAccessToken(session) {
    if (!session.tokens) {
        throw new Error('No tokens in session');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials(session.tokens);

    // Check if token is expired
    const now = Date.now();
    const expiryDate = session.tokens.expiry_date;

    if (expiryDate && expiryDate < now) {
        console.log('Access token expired, refreshing...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        session.tokens = { ...session.tokens, ...credentials };
        await session.save();
    }

    return session.tokens.access_token;
}

// Antigravity API constants
const ANTIGRAVITY_ENDPOINTS = [
    'https://cloudcode-pa.googleapis.com',  // prod
    'https://autopush-cloudcode-pa.sandbox.googleapis.com',  // staging
    'https://daily-cloudcode-pa.sandbox.googleapis.com'  // dev
];
const ANTIGRAVITY_API_VERSION = 'v1internal';
const ANTIGRAVITY_HEADERS = {
    'User-Agent': 'google-api-nodejs-client/9.15.1',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': JSON.stringify({
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
    })
};

// Default Project ID (fallback when loadCodeAssist API fails)
// From opencode-antigravity-auth reference implementation
const ANTIGRAVITY_DEFAULT_PROJECT_ID = 'rising-fact-p41fc';

// Cache for project context
const projectContextCache = new Map();

/**
 * Fetch project context via loadCodeAssist API
 */
async function fetchProjectContext(accessToken) {
    // Check cache first
    if (projectContextCache.has(accessToken)) {
        console.log('📋 Using cached project context');
        return projectContextCache.get(accessToken);
    }

    const metadata = {
        ideType: 'IDE_UNSPECIFIED',
        platform: 'PLATFORM_UNSPECIFIED',
        pluginType: 'GEMINI'
    };

    for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
        const url = `${endpoint}/${ANTIGRAVITY_API_VERSION}:loadCodeAssist`;
        console.log(`📡 Calling loadCodeAssist: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    ...ANTIGRAVITY_HEADERS
                },
                body: JSON.stringify({ metadata })
            });

            if (!response.ok) {
                console.log(`❌ loadCodeAssist failed: ${response.status}`);
                continue;
            }

            const data = await response.json();
            console.log('✅ loadCodeAssist response:', JSON.stringify(data, null, 2));

            // Extract project ID
            let projectId = data.cloudaicompanionProject;
            if (typeof projectId === 'object' && projectId.id) {
                projectId = projectId.id;
            }

            if (projectId) {
                projectContextCache.set(accessToken, projectId);
                return projectId;
            }

            // If no project, try onboarding for free tier
            if (data.allowedTiers) {
                const tierId = data.currentTier?.id || data.allowedTiers[0]?.id || 'free-tier';
                console.log(`🔄 Attempting onboardUser with tierId: ${tierId}`);

                const onboardUrl = `${endpoint}/${ANTIGRAVITY_API_VERSION}:onboardUser`;
                const onboardResponse = await fetch(onboardUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        ...ANTIGRAVITY_HEADERS
                    },
                    body: JSON.stringify({ tierId, metadata })
                });

                if (onboardResponse.ok) {
                    const onboardData = await onboardResponse.json();
                    console.log('✅ onboardUser response:', JSON.stringify(onboardData, null, 2));

                    const managedProjectId = onboardData.response?.cloudaicompanionProject?.id;
                    if (onboardData.done && managedProjectId) {
                        projectContextCache.set(accessToken, managedProjectId);
                        return managedProjectId;
                    }
                }
            }
        } catch (err) {
            console.error(`❌ loadCodeAssist error: ${err.message}`);
            continue;
        }
    }

    // Fallback - use default project ID from oh-my-opencode reference
    console.log(`⚠️ Could not get project context, using fallback: ${ANTIGRAVITY_DEFAULT_PROJECT_ID}`);
    projectContextCache.set(accessToken, ANTIGRAVITY_DEFAULT_PROJECT_ID);
    return ANTIGRAVITY_DEFAULT_PROJECT_ID;
}

/**
 * POST /api/chat
 * Stream chat responses from Gemini API
 * Supports both OAuth and API key authentication
 */
router.post('/chat', authMiddleware, async (req, res) => {
    const { messages, mode, file, apiKey, responseType, location } = req.body;

    try {
        // Set headers for Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Normalize mode names from frontend enum values to config keys
        // Frontend sends: "Auto", "Standard", "Quick Query", "Deep Analysis", "Web Search", "Live"
        const normalizeModeKey = (modeInput) => {
            if (!modeInput) return 'auto';
            const modeMap = {
                'Auto': 'auto',
                'Standard': 'standard',
                'Quick Query': 'quick',
                'Deep Analysis': 'deep',
                'Web Search': 'web',
                'Live': 'live',
                // Also support lowercase versions
                'auto': 'auto',
                'standard': 'standard',
                'quick': 'quick',
                'deep': 'deep',
                'web': 'web',
                'search': 'web',
                'live': 'live'
            };
            return modeMap[modeInput] || 'auto';
        };

        const normalizedMode = normalizeModeKey(mode);
        console.log(`🎛️ Mode: "${mode}" -> normalized: "${normalizedMode}"`);

        // Full model configuration matching frontend constants.ts
        // Includes tools (Google Search, Maps) and thinkingConfig
        const MODEL_CONFIGS = {
            auto: {
                model: 'gemini-3-flash-preview',
                temperature: 0.7,
                tools: [{ googleSearch: {} }, { googleMaps: {} }]
            },
            standard: {
                model: 'gemini-3-flash-preview',
                temperature: 0.7
                // No tools - balanced general mode
            },
            quick: {
                model: 'gemini-3-flash-preview',
                temperature: 0.5
                // Optimized for speed, no tools
            },
            deep: {
                model: 'gemini-3-pro-preview',
                temperature: 0.3,
                thinkingConfig: { thinkingBudget: 8192 }
            },
            web: {
                model: 'gemini-3-flash-preview',
                temperature: 0.5,
                tools: [{ googleSearch: {} }, { googleMaps: {} }]
            },
            live: {
                model: 'gemini-3-flash-preview',
                temperature: 0.9
                // Live mode audio handled by frontend useLiveSession
            }
        };

        const modelConfig = MODEL_CONFIGS[normalizedMode] || MODEL_CONFIGS.auto;
        console.log(`📊 Using config:`, JSON.stringify(modelConfig, null, 2));


        // Prepare contents for API - ensure proper format
        const contents = messages.map(msg => {
            const parts = [];

            // Ensure we have content
            if (msg.content && msg.content.trim()) {
                parts.push({ text: msg.content.trim() });
            } else if (msg.parts && msg.parts.length > 0) {
                // Use existing parts if content is empty
                parts.push(...msg.parts);
            }

            // Skip messages with no content
            if (parts.length === 0) {
                return null;
            }

            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts
            };
        }).filter(Boolean); // Remove null entries

        console.log('📝 Formatted contents:', JSON.stringify(contents, null, 2));

        // Add file if provided
        if (file) {
            const lastContent = contents[contents.length - 1];
            if (lastContent) {
                lastContent.parts.unshift({
                    inlineData: {
                        mimeType: file.type,
                        data: file.base64
                    }
                });
            }
        }

        let response;

        // Determine authentication method
        if (req.session.isAuthenticated && req.session.tokens) {
            // OAuth authentication - use Cloudcode/Antigravity API (same as oh-my-opencode)
            const accessToken = await getAccessToken(req.session);
            console.log(`Request from OAuth user: ${req.session.userInfo?.email}`);

            // Get user's project context (now always returns a value due to fallback)
            const projectId = await fetchProjectContext(accessToken);
            console.log(`🎯 Using project: ${projectId}`);

            // Generate request ID and session ID
            const requestId = `agent-${crypto.randomUUID()}`;
            const sessionId = req.session.id || crypto.randomUUID();

            // Wrap request in Antigravity format (exactly like oh-my-opencode)
            // Include tools, thinkingConfig, responseMimeType, and location when available
            const antigravityBody = {
                project: projectId,
                model: modelConfig.model,
                userAgent: 'antigravity',
                requestId,
                request: {
                    contents,
                    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                    generationConfig: {
                        temperature: modelConfig.temperature,
                        ...(modelConfig.thinkingConfig && { thinkingConfig: modelConfig.thinkingConfig }),
                        ...(responseType === 'json' && { responseMimeType: 'application/json' })
                    },
                    ...(modelConfig.tools && { tools: modelConfig.tools }),
                    ...(location && {
                        toolConfig: {
                            retrievalConfig: {
                                latLng: {
                                    latitude: location.latitude,
                                    longitude: location.longitude
                                }
                            }
                        }
                    }),
                    sessionId
                }
            };

            // Try each endpoint in order: daily → autopush → prod (same as oh-my-opencode)
            const endpoints = [
                'https://daily-cloudcode-pa.sandbox.googleapis.com',  // dev - try first!
                'https://autopush-cloudcode-pa.sandbox.googleapis.com',  // staging
                'https://cloudcode-pa.googleapis.com'  // prod
            ];

            let lastError = null;
            const GCP_PERMISSION_ERROR_PATTERNS = [
                'PERMISSION_DENIED',
                'does not have permission',
                'Cloud AI Companion API has not been used',
                'has not been enabled'
            ];

            const isGcpPermissionError = (text) => {
                return GCP_PERMISSION_ERROR_PATTERNS.some(pattern => text.includes(pattern));
            };

            const calculateRetryDelay = (attempt) => {
                return Math.min(200 * Math.pow(2, attempt), 2000);
            };

            for (const endpoint of endpoints) {
                const apiUrl = `${endpoint}/v1internal:streamGenerateContent?alt=sse`;

                console.log(`📤 Trying: ${endpoint}`);

                // GCP permission error retry loop (up to 10 attempts per endpoint)
                const maxPermissionRetries = 10;
                let endpointSuccess = false;

                for (let attempt = 0; attempt < maxPermissionRetries; attempt++) {
                    try {
                        response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                ...ANTIGRAVITY_HEADERS,
                                'Accept': 'text/event-stream'
                            },
                            body: JSON.stringify(antigravityBody)
                        });

                        console.log(`📥 Status: ${response.status}`);

                        if (response.ok) {
                            console.log(`✅ Success with: ${endpoint}`);
                            endpointSuccess = true;
                            break;
                        }

                        // Check for GCP permission errors that may resolve with retry
                        if (response.status === 403) {
                            const errorText = await response.text();
                            if (isGcpPermissionError(errorText)) {
                                if (attempt < maxPermissionRetries - 1) {
                                    const delay = calculateRetryDelay(attempt);
                                    console.log(`🔄 GCP permission error, retry ${attempt + 1}/${maxPermissionRetries} after ${delay}ms`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                    continue;
                                }
                            }
                            lastError = errorText;
                            break;
                        }

                        // Log error but continue to next endpoint
                        const errorText = await response.text();
                        console.log(`⚠️ ${response.status} from ${endpoint}:`, errorText.substring(0, 200));
                        lastError = errorText;
                        break;

                    } catch (err) {
                        console.log(`❌ Network error from ${endpoint}:`, err.message);
                        lastError = err.message;
                        break;
                    }
                }

                if (endpointSuccess) break;
            }

            if (!response || !response.ok) {
                throw new Error(`All endpoints failed. Last error: ${lastError?.substring(0, 200)}`);
            }
        } else if (apiKey) {
            // API key authentication - use SDK with full config
            console.log('Request with API key');
            const ai = new GoogleGenAI({ apiKey });
            const model = ai.getGenerativeModel({
                model: modelConfig.model,
                systemInstruction: SYSTEM_INSTRUCTION,
                generationConfig: {
                    temperature: modelConfig.temperature,
                    ...(modelConfig.thinkingConfig && { thinkingConfig: modelConfig.thinkingConfig }),
                    ...(responseType === 'json' && { responseMimeType: 'application/json' })
                },
                ...(modelConfig.tools && { tools: modelConfig.tools }),
                ...(location && {
                    toolConfig: {
                        retrievalConfig: {
                            latLng: {
                                latitude: location.latitude,
                                longitude: location.longitude
                            }
                        }
                    }
                })
            });

            const result = await model.generateContentStream({ contents });

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                }
            }

            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        // Handle OAuth/Cloudcode response stream (Antigravity format)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let chunkCount = 0;
        let textReceived = false;
        let buffer = ''; // Buffer for incomplete SSE data

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            chunkCount++;
            console.log(`📦 Chunk ${chunkCount}:`, chunk.substring(0, 200));

            // Add chunk to buffer and process complete lines
            buffer += chunk;
            const lines = buffer.split('\n');

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    console.log(`📨 Data line:`, data.substring(0, 150));

                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        console.log(`🔍 Parsed keys:`, Object.keys(parsed));

                        // Unwrap Antigravity response wrapper: { response: { candidates: [...] } }
                        const unwrapped = parsed.response || parsed;
                        console.log(`🎁 Unwrapped keys:`, Object.keys(unwrapped));

                        // Extract grounding metadata for Google Search/Maps citations
                        const groundingMetadata = unwrapped.candidates?.[0]?.groundingMetadata;

                        // Extract text from candidates - check ALL parts for text (thinking models have thoughtSignature first)
                        const parts = unwrapped.candidates?.[0]?.content?.parts || [];
                        for (const part of parts) {
                            if (part.text) {
                                textReceived = true;
                                console.log(`✅ Extracted text:`, part.text.substring(0, 50));
                                // Include grounding metadata in response for search citations
                                const responseData = { text: part.text };
                                if (groundingMetadata) {
                                    responseData.groundingMetadata = groundingMetadata;
                                }
                                res.write(`data: ${JSON.stringify(responseData)}\n\n`);
                            }
                        }

                        if (!textReceived && parts.length > 0) {
                            console.log(`⚠️ Parts found but no text. Parts:`, parts.map(p => Object.keys(p)));
                        }
                    } catch (e) {
                        console.error('❌ Error parsing SSE chunk:', e.message);
                        console.log(`📄 Raw data that failed to parse:`, data.substring(0, 300));
                    }
                }
            }
        }

        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
            const data = buffer.slice(6);
            if (data && data !== '[DONE]') {
                try {
                    const parsed = JSON.parse(data);
                    const unwrapped = parsed.response || parsed;
                    const parts = unwrapped.candidates?.[0]?.content?.parts || [];
                    for (const part of parts) {
                        if (part.text) {
                            textReceived = true;
                            res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                        }
                    }
                } catch (e) {
                    console.error('❌ Error parsing final buffer:', e.message);
                }
            }
        }

        console.log(`📊 Stream complete. Chunks: ${chunkCount}, Text received: ${textReceived}`);
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Chat API error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'API request failed',
                message: error.message
            });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
});

/**
 * GET /api/quota
 * Get current quota usage (OAuth only)
 */
router.get('/quota', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'OAuth authentication required' });
    }

    try {
        // This would require calling Google's quota API
        // For now, return estimated limits based on OAuth tier
        res.json({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            tier: 'Free (OAuth)'
        });
    } catch (error) {
        console.error('Quota check error:', error);
        res.status(500).json({ error: 'Failed to check quota' });
    }
});

export default router;
