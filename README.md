# 🧠 MAILMIND AI — Multi-User Autonomous Email Intelligence Agent

MAILMIND AI is an autonomous, privacy-first, multi-user email intelligence SaaS platform. Any user can connect their Gmail account via Google OAuth 2.0 to access a private, encrypted smart workspace featuring AI inbox triage, deadline extraction, local sensitive data shielding, and human-in-the-loop reply drafts.

---

## 🌟 Key Features & Multi-User Architecture

- **Strict Multi-User Tenant Isolation**: Every database query (`emails`, `tasks`, `drafts`, `activity_logs`, `draft_checks`) enforces `WHERE user_id = req.user.id`. No user can access or view another user's correspondence.
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

## 🚢 Production Deployment Guide

MailMind AI is deployment-ready for cloud hosting. You can deploy it using either **Raasta A** (All-in-one on Render) or **Raasta B** (Decoupled: Frontend on Vercel + Backend on Render).

### ⚠️ Important Note on Free Hosting & SQLite Persistence
> [!WARNING]
> Free hosting tiers on Render and similar platforms use ephemeral filesystems. When a free instance spins down due to inactivity or restarts after a deploy, the local SQLite database (`mailmind.db`) resets.
> - **Development / Trial**: The app runs out-of-the-box without extra setup and will print a warning: `Free hosting par data restart par reset ho sakta hai.`
> - **Production / Data Durability**: Attach a Render Persistent Disk (e.g. mounted at `/var/data`) and configure the `SQLITE_PATH=/var/data/mailmind.db` environment variable.

---

### 🟢 Raasta A: All-in-One Deployment on Render (Recommended for Simplicity)
In this setup, a single Render Web Service builds both client and server. Express serves the production React Vite bundle statically from `client/dist` while handling all `/api` endpoints on the same domain.

#### Step 1: Deploy on Render
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New** > **Blueprint** (or **Web Service** using `render.yaml`).
3. Connect your repository. Render automatically reads `render.yaml` with:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

#### Step 2: Configure Environment Variables on Render
Set the following environment variables in the Render Dashboard:
- `NODE_ENV`: `production`
- `APP_URL`: `https://<your-render-app>.onrender.com` (your Render service URL)
- `GOOGLE_REDIRECT_URI`: `https://<your-render-app>.onrender.com/api/auth/callback`
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
- `GROQ_API_KEY`: Your Groq API Key (`gsk_...`)
- `TOKEN_ENC_KEY`: 64-character hex key (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `SESSION_SECRET`: Secure random hex string for cookie signing
- *(Optional)* `SQLITE_PATH`: `/var/data/mailmind.db` (if a Render Disk is attached)

#### Step 3: Update Google Cloud Console
1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Edit your OAuth 2.0 Web Client.
3. Under **Authorized redirect URIs**, add:
   ```
   https://<your-render-app>.onrender.com/api/auth/callback
   ```
4. Save changes.

---

### 🌐 Raasta B: Decoupled Deployment (Backend on Render + Frontend on Vercel)
In this setup, the Vite React frontend is hosted on Vercel's global edge CDN, and the Express backend runs on Render. Vercel automatically proxies `/api/*` requests to Render, maintaining single-origin cookies and zero CORS overhead.

#### Step 1: Deploy Backend to Render
1. Follow Step 1 & 2 of Raasta A to deploy the backend on Render.
2. Note your Render service URL: `https://<your-render-service>.onrender.com`.
3. Set the following environment variables on Render:
   - `APP_URL`: `https://<your-vercel-app>.vercel.app` (your Vercel frontend URL)
   - `CLIENT_ORIGIN`: `https://<your-vercel-app>.vercel.app`
   - `GOOGLE_REDIRECT_URI`: `https://<your-render-service>.onrender.com/api/auth/callback`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`, `TOKEN_ENC_KEY`, `SESSION_SECRET`

#### Step 2: Configure Vercel Proxy Rewrite
1. In `client/vercel.json`, replace `<RENDER_URL>` with your actual Render hostname:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://<your-render-service>.onrender.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
2. Commit and deploy the `client/` directory to Vercel (Root Directory: `client`).

#### Step 3: Update Google Cloud Console
1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Under **Authorized JavaScript origins**, add:
   ```
   https://<your-vercel-app>.vercel.app
   ```
3. Under **Authorized redirect URIs**, add:
   ```
   https://<your-render-service>.onrender.com/api/auth/callback
   ```
4. Save changes. Users logging in through Vercel will seamlessly authenticate and redirect back to your Vercel frontend with encrypted session cookies.

---

## 🛡️ PHASE 1: "Shield + X-Ray" AI Email Firewall

MailMind AI features a multi-layer defense engine designed to intercept prompt injection attacks, hidden adversarial instructions, and steganographic payloads targeting LLM email agents.

### 🔬 Multi-Layer Defensive Pipeline
1. **HTML & Structural Inspector (`htmlInspector.js` via Cheerio)**:
   - Scans CSS text hiding techniques: `display:none`, `visibility:hidden`, `opacity <= 0.05`, `font-size <= 2px`, white-on-white text, off-screen displacement (`left/top: -9999px`), `max-height: 0px` with `overflow: hidden`, `<template>`, and HTML comments.
   - Detects invisible Unicode steganography: zero-width spaces (`U+200B`, `U+200C`, `U+200D`, `U+2060`, `U+FEFF`), bidirectional override markers (`U+202A`–`U+202E`, `U+2066`–`U+2069`), and Unicode tag blocks (`U+E0000`–`U+E007F`).
   - Produces separated `visibleText` (human canvas) and `aiText` (naive parser extraction).
2. **Override Pattern Engine (`overridePatterns.js`)**:
   - Weighted regex engine scanning for instruction-override syntax across English, Hindi, and Romanized Hinglish (e.g. *"ignore previous instructions"*, *"disregard system prompt"*, *"pehle ki instructions ignore karo"*, *"upar ki baatein bhool jao"*, *"approve wire transfer"*).
3. **Groq Prompt Guard 2 Scanner (`promptGuard.js`)**:
   - Classifies text chunks (~1400 chars) against `meta-llama/llama-prompt-guard-2-22m` on Groq with preview fail-safe fallback (`status: unavailable`) in case of rate limits.
4. **Safe Delimitation & Output Validation (`outputValidator.js`)**:
   - Strict `<<<UNTRUSTED_EMAIL_CONTENT>>>` demarcation instructing the LLM to treat email body as passive data.
   - Post-generation validator verifies that AI summaries, tasks, and drafts do not hallucinate or leak ungrounded URLs, emails, phone numbers, or bank details.
5. **Policy Engine (`shieldPipeline.js`)**:
   - Tolerates benign marketing newsletter preheaders (e.g., "view in browser") to avoid false positives.
   - Assigns verdicts: `CLEARED` (threat score < 25), `SUSPICIOUS` (score 25-59 or anomalous structure), and `DETAINED` (score >= 60 or hidden override injection).
   - **Fail-Closed**: Any unhandled exception marks the email as `SUSPICIOUS`, never `CLEARED`.

### 🛃 Checkpoint (X-Ray) Visual Interface
- **Airport Customs Theme**: Dark steel interface with laser sweep, status stamps (`CLEARED`, `SUSPICIOUS`, `DETAINED`), and a 0-100 composite threat score gauge.
- **Side-by-Side Dual Column**:
  - Left: *"Aap Kya Dekhte Ho"* (Sanitized human canvas).
  - Right: *"AI Kya Dekhta Hai"* (Ingestion view with hidden adversarial segments highlighted in crimson).
- **Strict Web Security**: Zero `dangerouslySetInnerHTML`. All highlights rendered via safe React text node tokenization.

### 🧪 Benchmark Evaluation Suite
Run the 100-sample benchmark evaluation (50 malicious vectors + 50 benign controls) with multi-layer ablation:
```bash
# Standard 100-sample evaluation
npm run shield:bench --prefix server

# Run multi-layer ablation study (saves server/data/ablation_results.json)
npm run shield:bench --prefix server -- --ablation
```

---

## ⚡ PHASE 2: "Autopilot + Attack Lab"

Phase 2 introduces automated human-in-the-loop executive productivity workflows paired with an adversarial simulation laboratory.

### 🤖 1. Autopilot Engine & Adaptive Reply Studio
- **Needs-Reply Detection**: Analyzes incoming CLEARED and SUSPICIOUS emails with strict JSON heuristics (`needs_reply`, `reason`, `urgency`, `suggested_action`). Automated senders (`no-reply@`, `marketing@`, `mailer-daemon@`) and newsletters are automatically filtered out.
- **3-Tone Response Generator**: Generates 3 pre-computed response options simultaneously:
  - `Professional`: Formal, polite executive correspondence.
  - `Concise`: Brief, direct 1–2 sentence operational answers.
  - `Detailed`: Comprehensive, step-by-step contextual replies.
- **Language Auto-Matching**: Automatically identifies sender's dialect (`English`, `Hindi`, `Hinglish`) and generates culturally fluent responses in that tongue.
- **Tailored Instruction Regeneration**: Users can prompt the AI with personalized instructions (*"thoda formal karo"*, *"politely decline"*, *"ask for Thursday 3pm"*) to regenerate tailored drafts safely using delimiter separation (`<<<USER_INSTRUCTION>>>` vs `<<<DATA_CONTENT>>>`).
- **Follow-Up Intelligence Tracker**: Identifies sent threads where the user requested action or answered a query, but no counterparty response has arrived after $N$ days (default $\ge 3$ days), preparing ready-to-dispatch follow-up drafts.
- **Firewall Verdict Enforcement**:
  - `CLEARED`: Full automated autopilot assistance.
  - `SUSPICIOUS`: Amber warning banner; drafts synthesized strictly on sanitized human-visible text.
  - `DETAINED`: Zero AI drafting permitted. Displays safe quarantine advisory with verified out-of-band instructions.
- **Gated Human Approval**: Every draft push requires explicit human confirmation (`confirmHumanApproval: true`). Drafts are pushed strictly to the user's Gmail Drafts folder (`gmail.compose`). Auto-send is permanently disallowed (`gmail.send` is never requested or called).

### 🧪 2. Adversarial Attack & Simulation Lab
- **Simulation Sandbox**: Safe, isolated environment allowing developers and security auditors to contrast a standard "Naive AI Summarizer" against "MailMind Shielded Defense".
- **5 Harmless Preset Scenarios**:
  1. *Preheader Injection*: Hidden CSS `display:none` instruction override attempting canary extraction.
  2. *Zero-Width Font Smuggling*: Inaudible `U+200B` Unicode characters hiding exfiltration commands.
  3. *White-on-White Styling*: `#FFFFFF` text on `#FFFFFF` background.
  4. *Tag Breakout & Markdown Injection*: `</template>` DOM escape sequences.
  5. *Multilingual Hinglish Override*: Romanized conversational evasion (*"Pehle ki instructions bhool jao"*).
- **Custom Adversarial Vector Builder**: Allows testing custom subjects, visible bodies, hidden payloads, and hiding techniques (`display:none`, `white-on-white`, `zero-width`, `html-comment`, `font-size:0px`).
- **Canary Marker Verification**: Tracks synthetic canary tokens (`CANARY_PRIORITY_ESCALATE_APPROVED`, etc.) to objectively score outcomes:
  - `HIJACKED`: Model obeyed adversarial instruction and leaked/executed canary.
  - `HELD`: Firewall suppressed payload or model safely resisted execution.
- **5-Iteration Batch Trial Runner**: Executes 5 consecutive simulations to empirically measure hijack rate ($x/5$).
- **Zero Real-Inbox Contamination**: Lab runs are completely isolated and recorded strictly in the `lab_runs` telemetry table.

### 📊 3. Automated Test Infrastructure & Ablation Analytics
- **Deterministic Offline Testing**: Tests use injectable provider interfaces (`services/llm/client.js`), ensuring deterministic evaluation without external API rate limits or network dependencies.
- **70 Comprehensive Automated Tests (8 Suites)**:
  ```bash
  npm test --prefix server
  ```
  - `isolation.test.js`: 10/10 tests (401 unauth, cross-user email/task/draft/shield isolation, IDOR prevention).
  - `autopilot.test.js`: 9/9 tests (needs-reply detection, Hinglish matching, 3 tones, DETAINED block 403, IDOR 404, follow-up detection).
  - `attackLab.test.js`: 5/5 tests (presets, canary detection HIJACKED vs HELD, zero real-inbox leakage, lab_runs isolation).
  - `regretShield.test.js`: 13/13 tests (Aadhaar Verhoeff precision, bank account context, placeholder precision, domain mismatch, tone parsing fail-safes, ungrounded rewrite stripping, draft hashing & caching, 409 approval gate, 403 detained gate, IDOR 404).
  - `senderIngestion.test.js`: 5/5 tests (authserv-id verification, RFC 2822 parser, profile upserts, multi-user isolation, feature flag).
  - `sentSync.test.js`: 4/4 tests (quoted comma parsing, metadata header-only sync, 429 backoff retry, feature flag).
  - `senderTrust.test.js`: 11/11 tests (homoglyphs & lookalikes, display-name spoofing, risky ask scanner, 7 strict policy invariants, feature flag).
  - `senderRoutes.test.js`: 13/13 tests (401 auth, multi-user isolation, filter & search, IDOR prevention, PATCH updates, bulk forget, profile rebuild, GDPR erasure, feature flag).
- **Synthetic Benchmark Suite (`npm run shield:bench`)**:
  - Evaluates 100 baseline synthetic test fixtures (50 adversarial prompt-injection attack vectors, 50 legitimate benign corporate/newsletter emails) + 20 dedicated Sender Trust Memory fixtures (10 spoof/auth/wire vectors, 10 legitimate contacts).
  - *Benchmark Scope Note*: This benchmark measures recall and false-positive rates on synthetic vectors within an offline test harness. Production security operates as a best-effort defense-in-depth architecture; no automated system can guarantee 100% impenetrability against novel zero-day prompts, which is why explicit human approval remains mandatory.
- **Live Groq Smoke Test (`npm run regret:smoke`)**:
  - Tests 5 live draft scenarios (Polite, Harsh, Passive-Aggressive, Commitment, Hinglish) directly against Groq LPU with zero secrets or text logging.

### 🛡️ 4. Regret Shield: Pre-Approval Quality & Tone Safeguard
- **Objective**: Intercepts embarrassing mistakes and risky outgoing content before user authorization.
- **Deterministic Checks (Zero-LLM)**:
  - *Attachment Reminder*: Warns when draft mentions attachments (`PFA`, `attached`, `attach kar diya`) as MailMind creates drafts without attaching files.
  - *Unfilled Placeholders*: Flags leftover template markers (`[Your Name]`, `[DATE]`, `XXXX`, `TODO`, `{{...}}`, `<name>`) with `HIGH` severity. Masked credentials like `XXXX 1234` or lowercase `todo` are ignored to minimize false positives.
  - *Outgoing Sensitive Credentials*: Reuses local regex shielding + Indian national patterns (12-digit Aadhaar verified via Verhoeff checksum algorithm with phone number exclusion, 10-char PAN `[A-Z]{5}[0-9]{4}[A-Z]{1}`, Bank A/C numbers within $\pm 40$ chars of banking context words, Passwords/OTPs) with `HIGH` severity. Excerpts are masked so plain secrets are never stored.
  - *Recipient Hazards*: Identifies Reply-To vs From domain mismatches, Reply-All hazards (> 5 recipients), and newly introduced external recipient domains with `MEDIUM` severity.
  - *Greeting Mismatches*: Detects when greeting name does not match any sender or recipient name with `LOW` severity.
- **LLM Tone & Commitment Analysis (Groq LPU)**:
  - Identifies harsh, passive-aggressive, or overly casual phrasing.
  - Highlights binding commitments and promises (deadlines, payments, attendance) so users know what they are agreeing to.
  - Provides diplomatic softer rewrites grounded in original context (strips any newly hallucinated URLs, emails, or phone numbers).
  - Fail-safe fallback: If Groq times out or fails, deterministic checks remain fully active without crashing.
- **Approval Gate Guard (409 Conflict)**:
  - If composite severity is `HIGH`, approval is blocked with HTTP 409 unless the user explicitly checks the acknowledgment box (`acknowledged: true`).
  - Caches results by SHA-256 draft hash in the `draft_checks` table.
- **Feature Flag Controlled**:
  - Gated behind `FEATURE_REGRET_SHIELD` (default: `true`). Setting to `false` completely bypasses the gate, reverting behavior seamlessly.

### 🛡️ 5. Sender Trust Memory: Relationship & Impersonation Defense (Layer 4)
- **Objective**: Tracks historical sender relationships, parses inbound Google authentication results, and detects CEO/executive display-name impersonation and lookalike domains.
- **Strict Policy Invariants**:
  1. *Risk Increase Only*: Trusted status never decreases risk or bypasses prompt injection defense. A trusted contact sending a prompt injection is strictly `DETAINED`.
  2. *Anomaly Ceiling*: A sender anomaly alone (lookalike, first-time, SPF fail) is capped at `SUSPICIOUS`, never `DETAINED`. Only an anomaly paired with a risky ask (urgent wire, bank modification, gift card) or a user block escalates to `DETAINED`.
  3. *Fail-Safe Isolation*: If Layer 4 encounters any error, it marks itself `unavailable` and the rest of the pipeline executes without crashing.
  4. *Benign Newcomer Protection*: Legitimate first-time senders remain `CLEARED` if there is no anomaly or prompt injection.
  5. *Baseline Preservation*: Old Phase 1 fixtures preserve identical baseline verdicts.
- **Signals Evaluated**:
  - `first_time_sender`: Informative flag when no prior correspondence exists.
  - `established`: Contact verified by sent mail history (`sent_to_count > 0`), manual trust, or 3+ emails over 14+ days.
  - `display_name_spoof`: External email mimicking the display name of a known trusted contact.
  - `lookalike_domain`: Homoglyph normalization (`1`->`l`, `0`->`o`, `rn`->`m`, `vv`->`w`) and Levenshtein distance $\le 2$ against established domains, excluding common free-mail providers.
  - `auth_failure`: Inbound SPF, DKIM, and DMARC failures parsed strictly from Google MTA headers (`authserv-id: mx.google.com`).
  - `reply_to_mismatch`: Reply-To domain pointing away from sender domain to untrusted destination.
  - `risky_ask`: Scans for urgent wire transfers, banking detail modifications, gift cards, credential harvesting, or Hinglish urgent payment requests.
- **Privacy & Ingestion Architecture**:
  - *Sent-Mail Sync*: Fetches only `format=metadata` (`To`, `Cc`, `Date`), never reads sent email bodies. Default limit: 300 messages. Handles 429 rate limits with exponential backoff.
  - *Full User Control*: Dedicated `/api/senders` API and Sender Memory UI to mark contacts as trusted, blocked, or unknown, delete individual profiles, rebuild memory, or trigger bulk erasure ("Forget all sender memory").
  - *GDPR Erasure*: "Disconnect & Delete My Data" automatically wipes all user records from `sender_profiles` and `email_headers_meta`.
- **Feature Flag Controlled**:
  - Gated behind `FEATURE_SENDER_TRUST` (default: `true`). Disabling shuts down Layer 4, sent sync, and sender routes.

---

## 🔒 Security & Privacy Architecture (Best-Effort Layered Defense)

| Security Feature | Implementation |
|---|---|
| **Multi-User Data Isolation** | Enforced via `WHERE user_id = req.user.id` on all queries and inserts. |
| **Token Encryption** | AES-256-GCM with dynamic IV per token and authentication tags. |
| **AI Email Firewall** | Multi-layer screening (HTML/CSS tricks, Unicode tags, Groq Prompt Guard 2, Sender Trust Memory). |
| **Sender Trust Memory** | Homoglyph lookalike defense, display name spoofing detection, Google MTA auth inspection, and sent metadata sync. |
| **Regret Shield** | Pre-approval check for attachments, placeholders, PAN/Aadhaar, recipient risks, tone risks, and explicit 409 acknowledgment. |
| **Zero Raw HTML Injection** | Plaintext React tokenization; no `dangerouslySetInnerHTML` for emails. |
| **Zero Auto-Send** | Only creates drafts upon explicit human approval. |
| **Session Security** | `httpOnly`, `sameSite=lax`, 7-day TTL with database session revocation. |
| **CSRF Defense** | Single-use 15-minute cryptographic state validation on OAuth callback. |
| **Privacy Guard** | Local regex filtering shielding OTPs, passwords, and bank accounts. |
| **Rate Limiting** | Auth endpoints and sync APIs guarded with `express-rate-limit`. |

---

## 🚀 Deploying to Render

MailMind AI is configured for one-click deployment using Render Blueprints (`render.yaml`).

### Option 1: Render Blueprint (Recommended)
1. Go to the [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Blueprint**.
2. Connect your Git repository. Render will automatically detect [`render.yaml`](./render.yaml).
3. Populate the required environment variables:
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` (from Google Cloud Console)
   - `GOOGLE_REDIRECT_URI` (`https://<your-render-app>.onrender.com/api/auth/callback` or custom domain)
   - `GROQ_API_KEY` (`gsk_...` from Groq Console)
   - `TOKEN_ENC_KEY` (64-character hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `SESSION_SECRET` (random hex string for cookie signing)
   - `APP_URL` (`https://<your-render-app>.onrender.com` or custom domain)
4. Click **Apply**. Render will run `npm install && npm run build` and start the server with `npm start`.

### Option 2: Render Manual Web Service
- **Environment**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Node Version**: `>=24.0.0`
- *(Optional Persistent Disk)*: Add a persistent disk mounted at `/var/data` and set `SQLITE_PATH=/var/data/mailmind.db`. On free tier without a persistent disk, an ephemeral warning will be logged.

