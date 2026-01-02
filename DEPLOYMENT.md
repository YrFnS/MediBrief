# Deployment Guide: MediBrief (Netlify + Render)

Since MediBrief effectively has two parts (Frontend + Backend), you generally deploy them to separate services for the best result.

## Architecture
- **Frontend**: Deployed on **Netlify** (Static site)
- **Backend**: Deployed on **Render** (Node.js API)

---

## Part 1: Deploy Backend (Render)
The backend handles the Google OAuth flow (Subscription) and proxies API calls.

1. Create a [Render](https://render.com) account.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free (or Starter)
5. **Environment Variables** (Add these in Render Dashboard):
   - `NODE_ENV` = `production`
   - `GOOGLE_CLIENT_ID` = (From your .env)
   - `GOOGLE_CLIENT_SECRET` = (From your .env)
   - `SESSION_SECRET` = (Generate a random string)
   - `CLIENT_URL` = `https://your-project-name.netlify.app` (Your Netlify URL)

   > **Note**: For `CLIENT_URL`, enter your Netlify URL *without* the trailing slash.

6. **Deploy** and copy your Render URL (e.g., `https://medibrief-api.onrender.com`).

---

## Part 2: Deploy Frontend (Netlify)
The frontend connects to the backend API.

1. Push your latest changes to GitHub.
2. Log in to Netlify and go to your site settings.
3. **Site Configuration** -> **Environment variables**.
4. Add the following variable:
   - `VITE_USE_BACKEND` = `true`
   - `VITE_BACKEND_URL` = `https://medibrief-api.onrender.com` (Your Render URL)

5. **Trigger a new deploy** (or wait for auto-deploy).

---

## Part 3: Google Auth Configuration
You need to tell Google your new production URLs.

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Edit your OAuth 2.0 Client.
3. Add to **Authorized JavaScript origins**:
   - `https://medibrief-api.onrender.com` (Your Render URL)
4. Add to **Authorized redirect URIs**:
   - `https://medibrief-api.onrender.com/auth/google/callback`

   > **Important**: The redirect URI must point to the **Backend (Render)**, not the frontend.

## Troubleshooting
- **CORS Errors**: Check that `CLIENT_URL` in Render matches your Netlify URL exactly.
- **Login Loop**: Check that proper HTTPS is used and `Authorized redirect URIs` are correct in Google Console.
