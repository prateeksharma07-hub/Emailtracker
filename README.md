# 🧠 MAILMIND AI — Multi-User Autonomous Email Intelligence Agent

MAILMIND AI is an autonomous, privacy-first, multi-user email intelligence SaaS platform. Any user can connect their Gmail account via Google OAuth 2.0 to access a private, encrypted smart workspace featuring AI inbox triage, deadline extraction, local sensitive data shielding, and human-in-the-loop reply drafts.

---

## 🌟 Key Features & Multi-User Architecture

- **100% Multi-User Isolation**: Every database query (`emails`, `tasks`, `drafts`, `activity_logs`) enforces `WHERE user_id = req.user.id`. No user can access or view another user's correspondence.
- **Hardware-Grade AES-256-GCM Token Encryption**: Google OAuth tokens (`access_token`, `refresh_token`) are encrypted with AES-256-GCM before storage in SQLite. Plaintext tokens are never stored, logged, or sent to the frontend.
- **7-Day HttpOnly Cookie Sessions**: Seamless authentication using secure `mailmind_session` cookies with automated expiry and single-use CSRF OAuth state protection.
- **Dedicated Google Login Landing**: Logged-out users are greeted by a sleek landing interface; authenticated users access their private workspace with avatar, name, and email in the header.
- **Ultra-Fast Groq LPU Inference**: Multi-model intelligence (`openai/gpt-oss-120b` and `openai/gpt-oss-20b`) with a concurrency queue to prevent rate limits during concurrent multi-user syncs.
- **Zero-Retention Privacy Shield**: Local regex engine intercepts OTPs, passwords, bank account numbers, credit cards, and medical keywords before LLM analysis.
- **Human-in-the-Loop Safeguards**: Minimum permissions (`gmail.readonly`, `gmail.compose`). Auto-send is permanently disabled (`gmail.send` is disallowed). Approved drafts are created directly in the user's Gmail Drafts folder.
- **"Disconnect & Delete My Data"**: Full GDPR-grade data erasure — revokes Google OAuth tokens and permanently wipes all user emails, tasks, drafts, and logs.

---

## 🔐 Google Cloud Console Setup (OAuth 2.0)

To allow users (or test users) to connect their Gmail accounts:

### 1. Create a Project in Google Cloud
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** > **New Project**, name it (e.g., `MailMind-AI`), and click **Create**.

### 2. Enable the Gmail API
1. In the left navigation, go to **APIs & Services** > **Library**.
2. Search for **Gmail API** and click **Enable**.

### 3. Configure the OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** user type and click **Create**.
3. Fill in the app information:
   - **App name**: `MailMind AI`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes** and select:
   - `.../auth/gmail.readonly` (Read resources metadata and message content)
   - `.../auth/gmail.compose` (Create drafts and send messages on behalf of user)
   - `.../auth/userinfo.email` (See your primary Google Account email address)
   - `.../auth/userinfo.profile` (See your personal info, including any personal info you've made publicly available)
   *(Note: Do NOT add `gmail.send` — MailMind strictly enforces minimum permissions).*
6. Under **Test Users** (Critical while publishing status is "Testing"):
   - Click **+ Add Users**.
   - Add every Gmail address that will sign in to test the application.
7. Click **Save and Continue**.

### 4. Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Set **Application type**: **Web application**.
4. Set **Name**: `MailMind Web Client`.
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   http://localhost:5001/api/auth/callback
   ```
   *(If deploying to production, also add your production callback, e.g., `https://your-domain.com/api/auth/callback`).*
6. Click **Create**.
7. Copy the **Client ID** and **Client Secret**.

---

## ⚙️ Environment Variables Configuration

Create or update `server/.env`:

```env
PORT=5001
CLIENT_URL=http://localhost:5174

# Groq High-Speed LPU API Key
GROQ_API_KEY=gsk_your_groq_api_key_here

# Google Cloud OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/callback

# AES-256-GCM 32-Byte Token Encryption Key (64-character hex string)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENC_KEY=your_64_character_hex_encryption_key

# Session Secret for Cookie Signing
SESSION_SECRET=your_random_session_secret_hex
```

---

## 🚀 Running the Application

### 1. Install Dependencies
```bash
# In project root
npm run install:all
```

### 2. Start Both Servers
```bash
# Starts Express server on :5001 and Vite client on :5174
npm run dev
```

- **Web Client**: `http://localhost:5174`
- **Backend API**: `http://localhost:5001`
- **Health Check**: `http://localhost:5001/api/health`

---

## 🔒 Security & Privacy Guarantees

| Security Feature | Implementation |
|---|---|
| **Multi-User Data Isolation** | Enforced via `WHERE user_id = req.user.id` on all queries and inserts. |
| **Token Encryption** | AES-256-GCM with dynamic IV per token and authentication tags. |
| **Zero Auto-Send** | Only creates drafts upon explicit human approval. |
| **Session Security** | `httpOnly`, `sameSite=lax`, 7-day TTL with database session revocation. |
| **CSRF Defense** | Single-use 15-minute cryptographic state validation on OAuth callback. |
| **Privacy Guard** | Local regex filtering shielding OTPs, passwords, and bank accounts. |
| **Rate Limiting** | Auth endpoints and sync APIs guarded with `express-rate-limit`. |
