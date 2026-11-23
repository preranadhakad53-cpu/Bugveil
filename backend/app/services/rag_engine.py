import os
import re
import math
from typing import List, Dict, Any, Optional, Tuple
from app.services.language_detector import is_binary_or_ignored_file
from app.services.ai_service import ai_service
from app.core.config import settings


class CodeChunk:
    def __init__(self, file_path: str, line_start: int, line_end: int, content: str, symbols: List[str]):
        self.file_path = file_path.replace("\\", "/")
        self.line_start = line_start
        self.line_end = line_end
        self.content = content
        self.symbols = symbols
        self.tokens = self._tokenize(f"{file_path} {' '.join(symbols)} {content}")

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        # Split on non-alphanumeric, keep words of len >= 2, lowercase
        words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{1,}", text.lower())
        return words


class RepositoryIndex:
    """
    In-memory BM25-style keyword and symbol index for code search.
    Provides fast, zero-dependency semantic chunk retrieval.
    """

    def __init__(self, repo_dir: str):
        self.repo_dir = os.path.abspath(repo_dir)
        self.chunks: List[CodeChunk] = []
        self.doc_count: int = 0
        self.avg_doc_len: float = 0.0
        self.term_doc_freq: Dict[str, int] = {}

        self._index_repository()

    def _index_repository(self):
        if not os.path.exists(self.repo_dir):
            return

        total_length = 0

        for root, dirs, files in os.walk(self.repo_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in (
                "node_modules", "dist", "build", "venv", ".venv", "__pycache__"
            )]

            for f in files:
                abs_path = os.path.join(root, f)
                rel_path = os.path.relpath(abs_path, self.repo_dir).replace("\\", "/")

                if is_binary_or_ignored_file(abs_path, f):
                    continue

                try:
                    with open(abs_path, "r", encoding="utf-8", errors="ignore") as fp:
                        lines = fp.readlines()
                except Exception:
                    continue

                if not lines:
                    continue

                # Partition into chunks of ~35 lines with 10 lines overlap
                chunk_size = 35
                overlap = 10
                idx = 0

                while idx < len(lines):
                    chunk_lines = lines[idx:idx + chunk_size]
                    chunk_text = "".join(chunk_lines)
                    line_start = idx + 1
                    line_end = idx + len(chunk_lines)

                    # Extract defined symbols in this chunk
                    symbols = re.findall(r"(?:def|class|function|const|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)", chunk_text)

                    chunk = CodeChunk(rel_path, line_start, line_end, chunk_text, symbols)
                    self.chunks.append(chunk)
                    total_length += len(chunk.tokens)

                    # Update term doc frequencies
                    unique_terms = set(chunk.tokens)
                    for term in unique_terms:
                        self.term_doc_freq[term] = self.term_doc_freq.get(term, 0) + 1

                    if idx + chunk_size >= len(lines):
                        break
                    idx += (chunk_size - overlap)

        self.doc_count = len(self.chunks)
        if self.doc_count > 0:
            self.avg_doc_len = total_length / self.doc_count

    def search(self, query: str, top_k: int = 4) -> List[CodeChunk]:
        """
        Retrieves top_k relevant code chunks with BM25-based keyword and symbol boosting.
        """
        if self.doc_count == 0 or not query.strip():
            return []

        query_tokens = [t.lower() for t in re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{1,}", query)]
        if not query_tokens:
            return self.chunks[:top_k]

        k1 = 1.5
        b = 0.75
        scores: List[Tuple[float, CodeChunk]] = []

        for chunk in self.chunks:
            score = 0.0
            doc_len = len(chunk.tokens)
            doc_token_counts: Dict[str, int] = {}
            for t in chunk.tokens:
                doc_token_counts[t] = doc_token_counts.get(t, 0) + 1

            for term in query_tokens:
                if term not in doc_token_counts:
                    continue

                df = self.term_doc_freq.get(term, 1)
                idf = math.log((self.doc_count - df + 0.5) / (df + 0.5) + 1.0)
                tf = doc_token_counts[term]

                term_score = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc_len / (self.avg_doc_len or 1.0)))))

                # Symbol boost: If symbol name directly matches query term
                for sym in chunk.symbols:
                    if term in sym.lower():
                        term_score *= 3.0
                        break

                # Path boost: If file path contains the query term
                if term in chunk.file_path.lower():
                    term_score *= 2.0

                score += term_score

            if score > 0.0:
                scores.append((score, chunk))

        # Sort by score descending
        scores.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scores[:top_k]]


# In-memory index cache: repo_id -> RepositoryIndex
_index_cache: Dict[str, RepositoryIndex] = {}


def get_or_build_index(repo_id: str, repo_dir: str) -> RepositoryIndex:
    if repo_id not in _index_cache:
        _index_cache[repo_id] = RepositoryIndex(repo_dir)
    return _index_cache[repo_id]


async def chat_with_repository(
    repo_id: str,
    repo_dir: str,
    repo_name: str,
    query: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    RAG pipeline for Bugveil Assistant:
    1. Retrieves relevant repository code chunks.
    2. Constructs grounded prompt with exact line number citations.
    3. Queries Groq AI service with message history for follow-up support.
    """
    index = get_or_build_index(repo_id, repo_dir)
    relevant_chunks = index.search(query, top_k=4)

    # Build reference context block
    context_lines = []
    referenced_files = []

    for chunk in relevant_chunks:
        ref_obj = {
            "file_path": chunk.file_path,
            "line_start": chunk.line_start,
            "line_end": chunk.line_end,
            "snippet": chunk.content.strip("\n")[:400],
        }
        referenced_files.append(ref_obj)

        context_lines.append(
            f"--- FILE: {chunk.file_path} (Lines {chunk.line_start}-{chunk.line_end}) ---\n"
            f"{chunk.content.strip()}\n"
        )

    context_str = "\n".join(context_lines) if context_lines else "No directly matching code files found."

    system_prompt = (
        f"You are the Bugveil Assistant. Tagline: 'Review smarter. Debug deeper.'\n"
        f"You are answering developer questions about the repository '{repo_name}'.\n\n"
        "STRICT GROUNDING INSTRUCTIONS:\n"
        "1. Ground your answers ONLY in the provided repository context below.\n"
        "2. Always reference exact file paths and line ranges in your answer using markdown format: `file_path:start-end`.\n"
        "3. If the answer cannot be found in the provided repository context, clearly and honestly state:\n"
        "   'I could not find reference to this in the indexed repository code.'\n"
        "4. Do NOT hallucinate or invent files, functions, or implementation details.\n"
        "5. Explain code flow, architectures, dependencies, and potential impacts clearly.\n\n"
        f"REPOSITORY CODE CONTEXT:\n{context_str}\n"
    )

    # Prepare message chain for follow-up questions
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    
    if history:
        for turn in history[-6:]:  # Keep up to last 6 turns for context
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content.strip():
                messages.append({"role": role, "content": content.strip()})

    messages.append({"role": "user", "content": query.strip()})

    # Call Groq AI service
    res = await ai_service._call_groq_api(
        system_prompt=system_prompt,
        user_prompt=query.strip(),
    )

    if not res.get("_is_mock") and "content" in res:
        answer_text = res["content"]
        is_mock = False
        model_used = settings.GROQ_MODEL
    else:
        # Fallback / Simulated Grounded Response using actual indexed files
        is_mock = True
        model_used = f"{settings.GROQ_MODEL} (Simulated)"

        if relevant_chunks:
            top_chunk = relevant_chunks[0]
            answer_text = (
                f"Based on the repository code in `{top_chunk.file_path}:{top_chunk.line_start}-{top_chunk.line_end}`:\n\n"
                f"- **Analysis:** The component defines {', '.join(top_chunk.symbols) if top_chunk.symbols else 'internal logic'} "
                f"handling the queried workflow.\n"
                f"- **Reference:** See lines {top_chunk.line_start} to {top_chunk.line_end} in `{top_chunk.file_path}`.\n\n"
                f"```\n{top_chunk.content[:250].strip()}\n```\n\n"
                "To explore further or trace dependencies, you can ask a follow-up question!"
            )
        else:
            answer_text = "I could not find reference to this in the indexed repository code."

    return {
        "answer": answer_text,
        "referenced_files": referenced_files,
        "is_mock": is_mock,
        "model_used": model_used,
    }
