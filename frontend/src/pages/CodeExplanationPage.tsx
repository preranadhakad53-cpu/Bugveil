import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCode2,
  Sparkles,
  Bug,
  TestTube,
  BookOpen,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import {
  Repository,
  CodeExplanationResponse,
  BugAnalysisResponse,
  TestGenerationResponse,
} from '../types';

export const CodeExplanationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoIdParam = searchParams.get('repoId');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [codeSnippet, setCodeSnippet] = useState<string>(
    'def calculate_tax(income: float, deductions: float = 0.0) -> float:\n' +
    '    """Calculates progressive tax bracket."""\n' +
    '    taxable = max(0.0, income - deductions)\n' +
    '    if taxable <= 10000:\n' +
    '        return taxable * 0.10\n' +
    '    elif taxable <= 50000:\n' +
    '        return 1000 + (taxable - 10000) * 0.20\n' +
    '    return 9000 + (taxable - 50000) * 0.30\n'
  );
  const [language, setLanguage] = useState('python');
  const [level, setLevel] = useState<'technical' | 'beginner'>('technical');
  const [activeTab, setActiveTab] = useState<'explain' | 'bugs' | 'tests'>('explain');

  // AI Output States
  const [explanation, setExplanation] = useState<CodeExplanationResponse | null>(null);
  const [bugAnalysis, setBugAnalysis] = useState<BugAnalysisResponse | null>(null);
  const [testGen, setTestGen] = useState<TestGenerationResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const repos = await api.getRepositories();
        setRepositories(repos);
        if (repos.length > 0) {
          const target = repoIdParam && repos.some((r) => r.id === repoIdParam)
            ? repoIdParam
            : repos[0].id;
          setSelectedRepoId(target);
        }
      } catch (err) {
        console.error('Failed to load repositories', err);
      }
    };
    fetchRepos();
  }, [repoIdParam]);

  const handleRunAI = async () => {
    if (!codeSnippet.trim()) return;
    setIsLoading(true);

    try {
      if (activeTab === 'explain') {
        const res = await api.aiExplainCode({
          code: codeSnippet,
          language,
          explanation_level: level,
        });
        setExplanation(res);
      } else if (activeTab === 'bugs') {
        const res = await api.aiAnalyzeBugs({
          code: codeSnippet,
          language,
        });
        setBugAnalysis(res);
      } else if (activeTab === 'tests') {
        const res = await api.aiGenerateTests({
          code: codeSnippet,
          language,
          framework: language === 'typescript' || language === 'javascript' ? 'jest' : 'pytest',
        });
        setTestGen(res);
      }
    } catch (err: any) {
      alert(`AI execution failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="panel-card p-5 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Legacy Code Explorer & Deep Explainer
              </h3>
              <Badge variant="purple">Groq AI Agent</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Decipher undocumented legacy code, inputs/outputs, dependencies, and blast radius.
            </p>
          </div>
        </div>

        {/* Level Toggle */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setLevel('technical')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              level === 'technical'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Technical View
          </button>
          <button
            onClick={() => setLevel('beginner')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              level === 'beginner'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Beginner Friendly
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Code Editor & Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="panel-card p-4 space-y-3">
            {repositories.length > 0 && (
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                  Context Repository
                </label>
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.primary_language || 'Polyglot'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-blue-400" />
                Source Code Input
              </span>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#090d16] border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono"
              >
                <option value="python">Python</option>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="sql">SQL</option>
              </select>
            </div>

            <textarea
              rows={14}
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              placeholder="Paste legacy code or select from repository..."
              className="w-full bg-[#090d16] border border-slate-800 rounded-md p-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 leading-5"
            />

            {/* Action Tabs */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => {
                  setActiveTab('explain');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                  activeTab === 'explain'
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Explain</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('bugs');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                  activeTab === 'bugs'
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-400 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Find Bugs</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('tests');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                  activeTab === 'tests'
                    ? 'bg-purple-600/20 border-purple-500/40 text-purple-400 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <TestTube className="w-3.5 h-3.5" />
                <span>Generate Tests</span>
              </button>
            </div>

            <button
              onClick={handleRunAI}
              disabled={isLoading || !codeSnippet.trim()}
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing with Groq AI Agent...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {activeTab === 'explain'
                      ? 'Analyze & Explain Code'
                      : activeTab === 'bugs'
                      ? 'Analyze Bugs & Edge Cases'
                      : 'Generate Unit Test Suite'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Structured AI Response */}
        <div className="lg:col-span-7">
          <div className="panel-card p-6 min-h-[500px] flex flex-col justify-between">
            {isLoading ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                <p className="text-xs font-medium text-slate-200">
                  Groq AI agent is synthesizing structured analysis...
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Extracting input/output contracts, logic checkpoints, and testing criteria.
                </p>
              </div>
            ) : activeTab === 'explain' && explanation ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Code Explanation ({explanation.explanation_level})
                    </span>
                    {explanation.is_mock && (
                      <Badge variant="warning">Simulated Output</Badge>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Model: {explanation.model_used}
                  </span>
                </div>

                {/* What it does */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> What It Does
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded border border-slate-800">
                    {explanation.what_it_does}
                  </p>
                </div>

                {/* How it works */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> How It Works
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded border border-slate-800">
                    {explanation.how_it_works}
                  </p>
                </div>

                {/* Inputs & Outputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-slate-900/60 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Inputs & Parameters
                    </span>
                    {explanation.inputs.map((inp, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-mono text-blue-300 font-medium">{inp.name}</span>
                        <span className="text-slate-500 text-[11px] ml-1">({inp.type}):</span>
                        <p className="text-slate-400 text-[11px]">{inp.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded bg-slate-900/60 border border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Outputs & Return Values
                    </span>
                    {explanation.outputs.map((out, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-mono text-purple-300 font-medium">{out.type}</span>
                        <p className="text-slate-400 text-[11px]">{out.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logic Steps */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-300">Logic Checkpoints</h4>
                  <ul className="space-y-1 text-xs text-slate-400 list-disc list-inside bg-slate-900/40 p-3 rounded border border-slate-800/80">
                    {explanation.important_logic_steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>

                {/* Blast Radius & Potential Problems */}
                <div className="p-3.5 rounded bg-rose-950/20 border border-rose-900/40 text-xs text-rose-300 space-y-1">
                  <strong className="block text-[11px] uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Modification Impact & Blast Radius
                  </strong>
                  <p className="text-rose-200/90 leading-relaxed">{explanation.blast_radius_and_impact}</p>
                </div>
              </div>
            ) : activeTab === 'bugs' && bugAnalysis ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Bug Analysis & Edge Cases
                  </span>
                  <Badge variant={bugAnalysis.overall_bug_risk === 'LOW' ? 'success' : 'warning'}>
                    Risk: {bugAnalysis.overall_bug_risk}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {bugAnalysis.bugs_found.map((bug, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                          <Bug className="w-3.5 h-3.5" />
                          {bug.title}
                        </h4>
                        <Badge variant="warning">{bug.severity}</Badge>
                      </div>
                      <p className="text-xs text-slate-300"><strong className="text-slate-400">Root Cause:</strong> {bug.root_cause}</p>
                      <p className="text-xs text-slate-300"><strong className="text-slate-400">Scenario:</strong> {bug.reproduction_scenario}</p>
                      <div className="p-2.5 rounded bg-[#090d16] border border-slate-800 text-[11px] font-mono text-emerald-300">
                        <strong>Suggested Fix:</strong> {bug.suggested_fix}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'tests' && testGen ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Generated Unit Tests ({testGen.framework})
                  </span>
                  <button
                    onClick={() => copyToClipboard(testGen.test_code)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Tests'}</span>
                  </button>
                </div>

                <div className="rounded bg-[#090d16] border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                  <pre><code>{testGen.test_code}</code></pre>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Test Cases Covered:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {testGen.test_cases.map((tc, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="font-mono text-blue-400 block">{tc.name}</span>
                        <span className="text-[11px] text-slate-400">{tc.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Sparkles className="w-10 h-10 text-slate-700 mb-3" />
                <h4 className="text-xs font-medium text-slate-300">No AI Analysis Generated Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Click 'Analyze & Explain Code' to synthesize technical explanations, inspect potential bugs, or generate unit test suites.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
