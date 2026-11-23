# Bugveil — Architecture & Engineering Specification

## 1. System Architecture

Bugveil is structured as a **modular monolith** with clear separation of concerns, strict boundary interfaces, and low cognitive overhead.

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + Vite + TypeScript)"]
        UI["User Interface (Tailwind CSS, Shadcn/UI, Lucide)"]
        Monaco["Monaco Code Editor & Diff Viewer"]
        ReactFlow["React Flow (Dependency Graph)"]
        Recharts["Recharts (Quality & Severity Metrics)"]
        ClientState["Client State & React Router"]
    end

    subgraph Server ["Backend (FastAPI Monolith)"]
        API["REST API Router (/api/v1)"]
        Config["Config & Security Manager (.env loaded)"]
        
        subgraph Services ["Core Services"]
            RepoLoader["Repository Ingestion & Safe Unpacker"]
            ASTParser["AST & Language Profiler (Tree-sitter / AST)"]
            StaticRunner["Deterministic Static Analyzer (Ruff, Bandit, Semgrep)"]
            RAGEngine["Repository Indexer & Code Chunker"]
            AIService["Groq AI Service (Single Agent, Configurable Model)"]
            DocGen["Documentation & Report Engine"]
        end

        DBAccess["Database Layer (SQLAlchemy ORM + Async Session)"]
    end

    subgraph Storage ["Persistent & Ephemeral Storage"]
        DB[(PostgreSQL / SQLite Database)]
        SandboxedWorkspace["Sandboxed Repositories Workspace (/data/repos)"]
    end

    subgraph External ["External AI Provider"]
        GroqAPI["Groq API (Cloud LLM Endpoint)"]
    end

    UI -->|HTTP / JSON REST API| API
    API --> Services
    Services --> DBAccess
    DBAccess --> DB
    RepoLoader --> SandboxedWorkspace
    ASTParser --> SandboxedWorkspace
    StaticRunner --> SandboxedWorkspace
    AIService -->|HTTPS with GROQ_API_KEY| GroqAPI
```

### Architectural Principles:
1. **Separation of Determinism and Heuristics**: Static analyzers (Ruff, Bandit, Semgrep) provide deterministic ground truths; the Groq AI agent provides contextual reasoning, impact analysis, code explanations, and syntheses. AI never fabricates static tool findings.
2. **Zero Code Execution**: Uploaded or cloned code is strictly analyzed statically via AST and regex/tokenizers. Sandboxed workspace paths are isolated; scripts are never run.
3. **Single AI Agent Service**: One centralized, reusable AI service client calling Groq. No multi-agent fragmentation or multiple LLM providers.
4. **Resilient Degradation**: If `GROQ_API_KEY` is not present, the application remains fully functional for repository browsing, AST parsing, and deterministic static analysis, displaying a clear configuration warning for AI-specific endpoints.

---

## 2. Folder Structure

```
prompt_final_project/
├── .gitignore
├── README.md
├── docs/
│   └── ARCHITECTURE.md
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── app/
│       ├── __init__.py
│       ├── main.py                    # FastAPI entrypoint & middleware
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py              # Environment settings (Pydantic Settings)
│       │   ├── database.py            # SQLAlchemy async engine & session
│       │   ├── security.py            # Safe path checks & sanitizers
│       │   └── exceptions.py          # Custom API exception handlers
│       ├── models/                    # SQLAlchemy database models
│       │   ├── __init__.py
│       │   ├── repository.py
│       │   ├── analysis.py
│       │   ├── finding.py
│       │   ├── chat.py
│       │   └── documentation.py
│       ├── schemas/                   # Pydantic request/response schemas
│       │   ├── __init__.py
│       │   ├── common.py
│       │   ├── repository.py
│       │   ├── analysis.py
│       │   ├── finding.py
│       │   ├── chat.py
│       │   └── documentation.py
│       ├── services/                  # Business logic & external tool integrations
│       │   ├── __init__.py
│       │   ├── repo_loader.py         # Git clone & ZIP safe extractor
│       │   ├── ast_analyzer.py        # Tree-sitter & AST symbol extraction
│       │   ├── static_analyzer/       # Deterministic analyzers
│       │   │   ├── __init__.py
│       │   │   ├── runner.py
│       │   │   ├── ruff_adapter.py
│       │   │   ├── bandit_adapter.py
│       │   │   └── semgrep_adapter.py
│       │   ├── rag_engine/            # Retrieval Augmented Generation engine
│       │   │   ├── __init__.py
│       │   │   ├── chunker.py
│       │   │   ├── indexer.py
│       │   │   └── retriever.py
│       │   ├── ai_service.py          # Groq API integration (Single Agent)
│       │   └── report_generator.py    # Audit report builder
│       └── api/
│           ├── __init__.py
│           └── v1/
│               ├── __init__.py
│               ├── router.py
│               └── endpoints/
│                   ├── health.py
│                   ├── repositories.py
│                   ├── analysis.py
│                   ├── explorer.py
│                   ├── pull_requests.py
│                   ├── static_analysis.py
│                   ├── chat.py
│                   ├── documentation.py
│                   ├── dependencies.py
│                   ├── reports.py
│                   └── settings.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── index.css
        ├── main.tsx
        ├── App.tsx
        ├── types/
        │   └── index.ts
        ├── services/
        │   ├── api.ts
        │   └── client.ts
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.tsx
        │   │   ├── Navbar.tsx
        │   │   └── DashboardLayout.tsx
        │   ├── ui/
        │   │   ├── Button.tsx
        │   │   ├── Badge.tsx
        │   │   ├── Card.tsx
        │   │   ├── Modal.tsx
        │   │   └── StatusIndicator.tsx
        │   └── common/
        │       ├── EmptyState.tsx
        │       ├── MetricCard.tsx
        │       └── SeverityTag.tsx
        └── pages/
            ├── DashboardPage.tsx
            ├── RepositoriesPage.tsx
            ├── RepositoryImportPage.tsx
            ├── RepositoryOverviewPage.tsx
            ├── FileExplorerPage.tsx
            ├── CodeExplanationPage.tsx
            ├── PullRequestPage.tsx
            ├── AuditResultsPage.tsx
            ├── SecurityFindingsPage.tsx
            ├── DocumentationPage.tsx
            ├── DependencyGraphPage.tsx
            ├── ChatbotPage.tsx
            ├── ReportsPage.tsx
            └── SettingsPage.tsx
```

---

## 3. Database Schema

The database tracks repositories, analysis runs, static and AI findings, code chunks for RAG, conversation history, and generated documentation.

```mermaid
erDiagram
    REPOSITORIES ||--o{ ANALYSIS_JOBS : "has"
    REPOSITORIES ||--o{ CODE_CHUNKS : "contains"
    REPOSITORIES ||--o{ CHAT_CONVERSATIONS : "has"
    REPOSITORIES ||--o{ GENERATED_DOCS : "has"
    REPOSITORIES ||--o{ PR_AUDITS : "evaluates"
    ANALYSIS_JOBS ||--o{ FINDINGS : "produces"
    CHAT_CONVERSATIONS ||--o{ CHAT_MESSAGES : "contains"

    REPOSITORIES {
        string id PK "UUID"
        string name "Repository Name"
        string url "GitHub URL or file source"
        string source_type "GITHUB | ZIP_UPLOAD"
        string default_branch "main | master"
        string storage_path "Relative path in safe storage"
        int size_bytes "Total repository size"
        int file_count "Total analyzed source files"
        string primary_language "Primary detected language"
        json language_distribution "Language breakdown percentage"
        datetime created_at
        datetime updated_at
    }

    ANALYSIS_JOBS {
        string id PK "UUID"
        string repo_id FK "References REPOSITORIES(id)"
        string status "PENDING | RUNNING | COMPLETED | FAILED"
        float quality_score "0.0 - 100.0 computed score"
        int total_findings "Count of findings"
        int critical_count "Critical severity count"
        int high_count "High severity count"
        int medium_count "Medium severity count"
        int low_count "Low severity count"
        string commit_hash "Git commit hash analyzed"
        string error_message "Failure trace if failed"
        datetime started_at
        datetime completed_at
    }

    FINDINGS {
        string id PK "UUID"
        string analysis_id FK "References ANALYSIS_JOBS(id)"
        string repo_id FK "References REPOSITORIES(id)"
        string title "Short finding headline"
        string severity "CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL"
        string category "SECURITY | BUG | PERFORMANCE | CODE_QUALITY | TECH_DEBT"
        string source "RUFF | BANDIT | SEMGREP | GROQ_AI"
        string file_path "Relative file path"
        int line_start "Starting line number"
        int line_end "Ending line number"
        text code_snippet "Snippet of problematic code"
        text explanation "Detailed diagnosis"
        text why_it_matters "Risk assessment"
        text suggested_fix "Recommended remediation code/step"
        float confidence "0.0 to 1.0 confidence level"
        datetime created_at
    }

    CODE_CHUNKS {
        string id PK "UUID"
        string repo_id FK "References REPOSITORIES(id)"
        string file_path "Path to file"
        string chunk_type "FUNCTION | CLASS | MODULE"
        string symbol_name "Name of function/class"
        int line_start
        int line_end
        text content "Code content"
        text summary "Brief symbol summary"
        int token_count
        datetime created_at
    }

    CHAT_CONVERSATIONS {
        string id PK "UUID"
        string repo_id FK "References REPOSITORIES(id)"
        string title "User session label"
        datetime created_at
        datetime updated_at
    }

    CHAT_MESSAGES {
        string id PK "UUID"
        string conversation_id FK "References CHAT_CONVERSATIONS(id)"
        string role "user | assistant | system"
        text content "Message markdown content"
        json referenced_files "List of [{file_path, line_start, line_end}]"
        datetime created_at
    }

    PR_AUDITS {
        string id PK "UUID"
        string repo_id FK "References REPOSITORIES(id)"
        string base_ref "Base branch/commit"
        string target_ref "Target branch/commit"
        text diff_summary "Diff statistics"
        int changed_files_count
        int findings_count
        datetime created_at
    }

    GENERATED_DOCS {
        string id PK "UUID"
        string repo_id FK "References REPOSITORIES(id)"
        string doc_type "README | ARCHITECTURE | API | ONBOARDING"
        string title "Document Title"
        text content_markdown "Rendered markdown content"
        datetime created_at
        datetime updated_at
    }
```

---

## 4. API Endpoint Plan

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend status, DB connectivity, Groq config status |
| `GET` | `/dashboard/summary` | Global counts (repos, findings, severity totals) |
| `POST` | `/repositories/import-url` | Clone public GitHub repo safely |
| `POST` | `/repositories/upload-zip` | Upload & extract ZIP with path sanitization |
| `GET` | `/repositories` | List all tracked repositories |
| `GET` | `/repositories/{id}` | Get repository details & metadata |
| `DELETE` | `/repositories/{id}` | Delete repository and workspace files |
| `POST` | `/repositories/{id}/analyze` | Trigger full repository analysis pipeline |
| `GET` | `/analysis/{id}/status` | Check ongoing analysis progress |
| `GET` | `/analysis/{id}/findings` | Retrieve filtered findings (by severity, file) |
| `GET` | `/repositories/{id}/files` | Retrieve hierarchical file tree |
| `GET` | `/repositories/{id}/file-content` | Fetch source code content of a specific file |
| `POST` | `/explorer/explain` | AI explanation of file, class, or function |
| `POST` | `/pull-requests/audit` | Compare two branches/commits with AI & diff |
| `POST` | `/static-analysis/run` | Run Ruff, Bandit, and Semgrep directly |
| `POST` | `/chat/conversations` | Create new repository chat session |
| `GET` | `/chat/{conversation_id}/history`| Retrieve chat messages |
| `POST` | `/chat/{conversation_id}/message`| Send query to Bugveil Assistant (RAG) |
| `POST` | `/documentation/generate` | Generate README, Architecture, or API docs |
| `GET` | `/documentation/{repo_id}` | Retrieve generated documentation files |
| `GET` | `/dependencies/{repo_id}` | Retrieve AST dependency graph nodes & edges |
| `GET` | `/reports/{repo_id}` | Generate downloadable audit report JSON / Markdown |
| `GET` | `/settings/config` | Read non-sensitive system environment status |

---

## 5. Repository Analysis Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant API as FastAPI /analysis
    participant Ingestion as RepoLoader
    participant AST as AST Analyzer
    participant Static as Static Runners (Ruff/Bandit/Semgrep)
    participant RAG as RAG Chunker & Indexer
    participant Groq as Groq AI Service
    participant DB as Database

    User->>API: Trigger Analysis (repo_id)
    API->>DB: Set Analysis status = RUNNING
    API->>Ingestion: Validate workspace & files (exclude node_modules, .git)
    Ingestion-->>API: Validated File Manifest
    
    par Deterministic Parsing
        API->>AST: Parse AST (Functions, Classes, Imports)
        AST-->>API: Symbol Table & Dependency Graph
    and Static Security Scan
        API->>Static: Execute Ruff & Bandit & Semgrep
        Static-->>API: Normalized Tool Findings
    end

    API->>RAG: Chunk code by semantic symbols (line ranges)
    RAG-->>API: Chunks indexed for retrieval
    
    API->>Groq: Contextualize findings & evaluate overall architectural health
    Groq-->>API: Architectural summary & risk assessment
    
    API->>DB: Store Findings, Quality Score, Analysis Summary
    API->>DB: Set Analysis status = COMPLETED
    API-->>User: Analysis Complete (Quality Score, Findings Breakdown)
```

---

## 6. AI Integration Design (Groq Single Agent)

- **Single Provider**: Groq Cloud API exclusively.
- **Configurable Model**: Driven via `GROQ_MODEL` environment variable (e.g. `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`).
- **Encapsulated Client**: One centralized `GroqService` class handling all prompt templates, schema enforcement, rate-limit retries, and error handling.
- **Structured Outputs**: All analysis and review tasks enforce valid JSON schemas via Pydantic response models.
- **Safe Fallback**: If `GROQ_API_KEY` is unset or invalid:
  - System logs an explicit configuration warning.
  - Returns `424 Failed Dependency` or structured error: `"Groq API key not configured. Please set GROQ_API_KEY in your backend .env file."`
  - Prevents crashes; deterministic static analysis and repository browsing continue working seamlessly.

---

## 7. Chatbot Retrieval Architecture (Bugveil Assistant)

The assistant uses an AST-aware semantic retrieval pipeline:
1. **Symbol-Aware Chunking**: Rather than arbitrary character slicing, code is partitioned by class, function, or module boundaries with exact file paths and line ranges (`start_line`, `end_line`).
2. **Inverted Index & BM25 / Vector Search**: Queries are matched against symbol names, docstrings, imports, and code text.
3. **Prompt Grounding**: The top matching code snippets (with explicit file path and line numbers) are injected into the system prompt.
4. **Anti-Hallucination Constraints**: The system prompt strictly prohibits fabricating code or files not present in the context; if ambiguous, it replies: *"I could not find reference to this in the indexed repository."*

---

## 8. Security Plan

| Threat Vector | Mitigation Strategy |
|---|---|
| **Path Traversal / Zip Slip** | Safe extraction checking `os.path.commonpath([target_dir, extracted_path]) == target_dir`. Reject any entry containing `..`. |
| **Malicious Repository Execution** | Zero dynamic execution. Source files are strictly read as plain text or parsed via AST/Tree-sitter. No build scripts or interpreters are ever invoked on target code. |
| **ZIP Bombs & Excessive Files** | Strict limits: Max ZIP size = 50 MB; Max uncompressed size = 150 MB; Max file count = 2,500; Max individual file size = 2 MB. |
| **SSRF (Server-Side Request Forgery)** | Validates clone URLs against strict regex `https://github.com/[\w-]+/[\w.-]+`. Disallows `localhost`, private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`), file schemes, or SSH. |
| **API Key Exposure** | Keys reside solely on backend via environment variables. Excluded in `.gitignore`, substituted with placeholders in `.env.example`, stripped from client responses and logs. |
| **Data Privacy** | Informs users with a UI disclaimer prior to transmitting source code chunks to the Groq API. |

---

## 9. Milestone Roadmap

- **Milestone 1**: Project setup, complete architecture, backend & frontend foundation, dark SaaS UI, sidebar navigation, responsive layout, realistic empty-state dashboard, and live backend connectivity. (Completed)
- **Milestone 2**: Repository Ingestion & File Processing (GitHub clone, safe ZIP extraction, Zip-Slip & bomb defense, language profiling, hierarchical file tree, and code viewer). (Completed)
- **Milestone 3**: Deterministic Static Analysis Engine (Ruff, Bandit, Semgrep, and Polyglot Security Scanner with normalized findings and offline quality scoring). (Completed)
- **Milestone 4**: Single Groq AI Service (Code Explainer, Bug Analysis, Security Contextualizer, PR Auditor, Doc Generator, Test Generator). (Completed)
- **Milestone 5**: AST Parsing & Symbol Extraction (Functions, Classes, Imports). (Next)
- **Milestone 6**: Bugveil Assistant RAG Chatbot (AST chunking, retrieval, grounded responses). (Scheduled)
- **Milestone 7**: Dependency Graph & Blast Radius Visualization (Tree-sitter/AST import parser + React Flow). (Scheduled)
- **Milestone 8**: Comprehensive Audit Report download (PDF/Markdown), end-to-end testing, security hardening, and deployment guidelines. (Scheduled)
- **Milestone 9**: Dependency Graph Visualization (Tree-sitter/AST import parser + React Flow). (Scheduled)
- **Milestone 10**: Comprehensive Audit Report download (PDF/Markdown), end-to-end testing, security hardening, and deployment guidelines. (Scheduled)

---

## 10. Environment Configuration Plan

### Backend Configuration (`backend/.env.example`)
```env
# Application
PROJECT_NAME="Bugveil"
ENVIRONMENT="development"
DEBUG=true
PORT=8000
HOST="127.0.0.1"

# Database (SQLite by default for zero-setup local dev, PostgreSQL for production)
DATABASE_URL="sqlite+aiosqlite:///./bugveil.db"

# Groq AI Provider (Required for AI analysis & Chat)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Storage
STORAGE_DIR="./data/storage"
MAX_UPLOAD_SIZE_MB=50
```

### Frontend Configuration (`frontend/.env.example`)
```env
VITE_API_BASE_URL="http://127.0.0.1:8000/api/v1"
```
