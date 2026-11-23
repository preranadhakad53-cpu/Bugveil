import React, { useState, useEffect, useRef } from 'react';
import { BotMessageSquare, Send, HelpCircle, Loader2, FileCode, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Repository, ChatMessage, ReferencedFile } from '../types';

interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
  referencedFiles?: ReferencedFile[];
  isMock?: boolean;
  modelUsed?: string;
}

export const ChatbotPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    'Where is authentication implemented?',
    'What does the main entry point do?',
    'How does data flow between modules?',
    'What security issues exist in this codebase?',
  ];

  useEffect(() => {
    api.getRepositories().then(setRepositories).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || !selectedRepoId || isLoading) return;

    const userMsg: MessageItem = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.chatWithRepository({ repo_id: selectedRepoId, query, history });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          referencedFiles: res.referenced_files,
          isMock: res.is_mock,
          modelUsed: res.model_used,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Error: ${err?.response?.data?.detail || err.message || 'Failed to get response.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRef = (key: string) => {
    setExpandedRefs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const code = part.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
        return (
          <pre key={i} className="bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-emerald-300 overflow-x-auto my-2 whitespace-pre-wrap">
            {code}
          </pre>
        );
      }
      // Highlight file references like `path/file.py:10-20`
      const lineRef = /`([^`]+:[0-9]+-[0-9]+)`/g;
      const inlineCode = /`([^`]+)`/g;
      let rendered = part
        .replace(lineRef, '<span class="text-blue-400 font-mono text-xs bg-blue-950/30 px-1 rounded">$1</span>')
        .replace(inlineCode, '<code class="font-mono text-xs bg-slate-800 px-1 rounded text-amber-300">$1</code>');
      return <span key={i} dangerouslySetInnerHTML={{ __html: rendered }} className="whitespace-pre-wrap" />;
    });
  };

  const selectedRepo = repositories.find((r) => r.id === selectedRepoId);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="panel-card p-4 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <BotMessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Bugveil Assistant</h3>
            <p className="text-xs text-slate-400">Grounded in repository code. Cites exact file paths and line numbers.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedRepoId}
            onChange={(e) => { setSelectedRepoId(e.target.value); setMessages([]); }}
            className="bg-[#090d16] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 min-w-[180px]"
          >
            <option value="">Select repository…</option>
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {selectedRepo && (
            <Badge variant="info">{selectedRepo.primary_language || 'Polyglot'}</Badge>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div className="panel-card flex flex-col h-[560px]">
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Welcome / Empty */}
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 max-w-2xl">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <BotMessageSquare className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 space-y-2">
                  {selectedRepoId ? (
                    <>
                      <p>I'm the <strong>Bugveil Assistant</strong>, grounded in <strong>{selectedRepo?.name}</strong>.</p>
                      <p className="text-slate-400">Ask me about architecture, functions, security issues, or how modules relate to each other. I'll cite exact files and line numbers.</p>
                    </>
                  ) : (
                    <>
                      <p>Select a <strong>repository</strong> from the dropdown above to start asking questions.</p>
                      <p className="text-slate-400">I'll answer based strictly on the indexed repository code — no hallucinations.</p>
                    </>
                  )}
                </div>
              </div>

              {selectedRepoId && (
                <div className="pt-2 border-t border-slate-800/60">
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> Suggested questions:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sampleQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="text-left p-2.5 rounded bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <BotMessageSquare className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/30 text-slate-200 text-right'
                    : 'bg-slate-900 border border-slate-800 text-slate-200'
                }`}>
                  {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                </div>
                {msg.role === 'assistant' && msg.isMock && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertCircle className="w-3 h-3" /> Mock response (configure GROQ_API_KEY for real AI)
                  </div>
                )}
                {msg.role === 'assistant' && msg.referencedFiles && msg.referencedFiles.length > 0 && (
                  <div className="space-y-1 w-full">
                    {msg.referencedFiles.map((rf, ri) => {
                      const key = `${idx}-${ri}`;
                      const isExpanded = expandedRefs.has(key);
                      return (
                        <div key={ri} className="border border-slate-800 rounded text-xs overflow-hidden">
                          <button
                            onClick={() => toggleRef(key)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/60 hover:bg-slate-900 text-left transition-colors"
                          >
                            <FileCode className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="font-mono text-blue-400 flex-1 truncate">{rf.file_path}:{rf.line_start}-{rf.line_end}</span>
                            {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                          </button>
                          {isExpanded && (
                            <pre className="p-2.5 bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                              {rf.snippet}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <BotMessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-[#0a0f1d]">
          {!selectedRepoId && (
            <p className="text-xs text-amber-400 mb-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Select a repository to enable the assistant.
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={selectedRepoId ? "Ask about the repository…" : "Select a repository first…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={!selectedRepoId || isLoading}
              className="flex-1 bg-[#0d1424] border border-slate-800 rounded-md px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!selectedRepoId || !input.trim() || isLoading}
              className="p-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
