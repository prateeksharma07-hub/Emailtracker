# 🧠 MAILMIND AI — Intelligent Email Management & Automation Agent

MAILMIND AI is an autonomous, privacy-first email intelligence platform connecting to Gmail via OAuth 2.0 and powered by Google Gemini 3.5.

## 🚀 Key Capabilities
- **Smart Inbox & AI Categorization**: Classifies messages into *Urgent*, *Work*, *Meeting*, *Task*, *Personal*, *Newsletter*, and *Other*.
- **5-Level Priority Detection**: Flags critical emails with visual heat indicators.
- **Zero-Leak Sensitive Data Shield**: Regex pre-AI filter strictly intercepts OTPs, passwords, bank accounts, and credit cards from reaching external LLMs.
- **Task & Deadline Extraction**: Extracts actionable deadlines into an interactive board.
- **Human-in-the-Loop AI Drafts**: Generates contextual replies; **never** sends without explicit user review and confirmation.
- **Activity & Security Audit Log**: Complete local audit trail of email syncs and security events.

## 🛠️ Quick Start
1. Install dependencies:
   ```bash
   npm run install:all
   ```
2. Configure `server/.env` with your Google Cloud OAuth Client ID & Secret.
3. Start development servers:
   ```bash
   npm run dev
   ```
   - **Backend**: `http://localhost:5001`
   - **Frontend**: `http://localhost:5174`
