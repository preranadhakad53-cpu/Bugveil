# Bugveil — Review smarter. Debug deeper.

An AI-powered code auditing platform that analyzes repositories, reviews pull requests, detects security vulnerabilities, generates documentation, and answers developer questions grounded in real code.

---

## Features

| Feature | Status |
|---------|--------|
| Repository import (GitHub URL & ZIP) | ✅ Working |
| File tree explorer with language detection | ✅ Working |
| Static analysis (Ruff, Bandit, Semgrep, Security Scan) | ✅ Working |
| AI code explanation (Groq) | ✅ Working |
| AI bug analysis (Groq) | ✅ Working |
| AI security analysis (Groq) | ✅ Working |
| Repository-aware chatbot (RAG + Groq) | ✅ Working |
| Pull request auditor (Static + Groq AI) | ✅ Working |
| Code impact & blast radius analysis | ✅ Working |
| Dependency graph visualizer | ✅ Working |
| Documentation generator (Groq) | ✅ Working |
| Audit report (Markdown + JSON download) | ✅ Working |

---

## Tech Stack

**Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy (async), aiosqlite, GitPython, httpx  
**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons  
**AI Provider:** Groq API (single agent, single provider — backend-only)  
**Static Analysis:** Ruff, Bandit, Semgrep, Custom Polyglot Security Scanner

---

## Project Structure

```
prompt_final_project/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # FastAPI route handlers
│   │   ├── core/               # Config, database, security
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   └── services/           # AI, RAG, static analysis, dependency analysis
│   ├── tests/                  # pytest test suite
│   ├── .env.example            # Environment template
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/              # React page components
    │   ├── components/         # Shared UI components
    │   ├── services/           # API client
    │   └── types/              # TypeScript types
    └── vite.config.ts
```

---

## Setup & Installation

### 1. Clone or Download

```bash
cd prompt_final_project
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

**This is the most important step.**

```bash
# Copy the template
cp .env.example .env
```

Open `backend/.env` in any text editor and set your real values:

```env
GROQ_API_KEY=gsk_your_actual_key_here        # From https://console.groq.com/
GROQ_MODEL=llama-3.3-70b-versatile           # Or any other Groq model
DATABASE_URL=sqlite+aiosqlite:///./bugveil.db
```

> **Security:** Never commit `.env` to git. It is already in `.gitignore`.  
> The app works without a Groq API key — static analysis and file tree features work offline. AI features show a mock response when the key is missing.

### 4. Start the Backend

```bash
cd backend
venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### 5. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Running Tests

```bash
backend\venv\Scripts\pytest backend\tests -v
```

---

## API Key Guide

1. Go to [https://console.groq.com/](https://console.groq.com/)
2. Sign up / log in → **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_`)
4. Open `backend/.env` and replace `your_groq_api_key_here` with your key:
   ```
   GROQ_API_KEY=gsk_abc123...
   ```
5. Restart the backend server

**Without a real API key:** Static analysis, repository import, file explorer, and dependency graph work normally. AI features (chatbot, PR review, documentation, code explanation) return a simulated mock response with a warning badge.

---

## Demonstration Workflow

For a complete demo:

1. **Import repository** → `/import` → paste a public GitHub URL (e.g., `https://github.com/pallets/flask`)
2. **View file tree** → `/explorer`
3. **Run static analysis** → click "Run Static Analysis" on the repository page
4. **View findings** → `/security`
5. **Ask chatbot questions** → `/chat` → select the repo → ask "Where is routing implemented?"
6. **Audit a pull request** → `/pull-requests` → use the "Security Diff" sample → click Audit
7. **Generate documentation** → `/documentation` → select repo → choose README → Generate
8. **Download audit report** → `/reports` → select repo → Download .md or .json

---

## Security Notes

- Groq API key is **backend-only**. It never appears in frontend code, browser console, or HTTP responses.
- Repository files are **never executed**. Only static reading and pattern matching occur.
- ZIP uploads are protected against Zip Slip and Zip Bomb attacks.
- GitHub clones are shallow (`depth=1`) and the `.git` directory is purged after cloning.
- Path traversal is prevented on all file access endpoints.

---

*Bugveil — Review smarter. Debug deeper.*
