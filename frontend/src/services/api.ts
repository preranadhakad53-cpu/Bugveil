import { apiClient } from './client';
import {
  HealthResponse,
  DashboardSummary,
  Repository,
  SystemSettings,
  RepositoryFileTreeResponse,
  RepositoryFileContentResponse,
  Finding,
  AnalysisJob,
  RepoSummaryResponse,
  CodeExplanationResponse,
  BugAnalysisResponse,
  SecurityAnalysisResponse,
  PullRequestReviewResponse,
  DocGenerationResponse,
  TestGenerationResponse,
  ChatMessage,
  ChatResponse,
  PRAuditResponse,
  DependencyGraphResponse,
  ImpactAnalysisResult,
} from '../types';

export const api = {
  // Health
  getHealth: async (): Promise<HealthResponse> => {
    const response = await apiClient.get<HealthResponse>('/health');
    return response.data;
  },

  // Dashboard
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },

  // Repositories
  getRepositories: async (): Promise<Repository[]> => {
    const response = await apiClient.get<Repository[]>('/repositories');
    return response.data;
  },

  getRepository: async (id: string): Promise<Repository> => {
    const response = await apiClient.get<Repository>(`/repositories/${id}`);
    return response.data;
  },

  importRepositoryUrl: async (url: string, branch: string = 'main', name?: string): Promise<Repository> => {
    const response = await apiClient.post<Repository>('/repositories/import-url', {
      url,
      branch,
      name: name || undefined,
    });
    return response.data;
  },

  uploadRepositoryZip: async (file: File, name?: string): Promise<Repository> => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }
    const response = await apiClient.post<Repository>('/repositories/upload-zip', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getRepositoryFiles: async (repoId: string): Promise<RepositoryFileTreeResponse> => {
    const response = await apiClient.get<RepositoryFileTreeResponse>(`/repositories/${repoId}/files`);
    return response.data;
  },

  getRepositoryFileContent: async (repoId: string, path: string): Promise<RepositoryFileContentResponse> => {
    const response = await apiClient.get<RepositoryFileContentResponse>(`/repositories/${repoId}/file-content`, {
      params: { path },
    });
    return response.data;
  },

  deleteRepository: async (repoId: string): Promise<void> => {
    await apiClient.delete(`/repositories/${repoId}`);
  },

  // Analysis & Findings
  triggerAnalysis: async (repoId: string): Promise<AnalysisJob> => {
    const response = await apiClient.post<AnalysisJob>('/analysis/run', { repo_id: repoId });
    return response.data;
  },

  getAnalysis: async (analysisId: string): Promise<AnalysisJob> => {
    const response = await apiClient.get<AnalysisJob>(`/analysis/${analysisId}`);
    return response.data;
  },

  getAnalysisFindings: async (
    analysisId: string,
    severity?: string,
    category?: string,
    source?: string
  ): Promise<Finding[]> => {
    const response = await apiClient.get<Finding[]>(`/analysis/${analysisId}/findings`, {
      params: { severity, category, source },
    });
    return response.data;
  },

  getRepositoryAnalyses: async (repoId: string): Promise<AnalysisJob[]> => {
    const response = await apiClient.get<AnalysisJob[]>(`/analysis/repository/${repoId}`);
    return response.data;
  },

  // -----------------------------------------------------------
  // Single AI Service (Groq)
  // -----------------------------------------------------------
  aiSummarizeRepo: async (data: {
    repo_name: string;
    repo_id?: string;
    primary_language?: string;
    file_tree_summary?: string;
    context_notes?: string;
  }): Promise<RepoSummaryResponse> => {
    const response = await apiClient.post<RepoSummaryResponse>('/ai/summarize-repo', data);
    return response.data;
  },

  aiExplainCode: async (data: {
    code: string;
    language?: string;
    file_path?: string;
    symbol_name?: string;
    explanation_level?: string;
  }): Promise<CodeExplanationResponse> => {
    const response = await apiClient.post<CodeExplanationResponse>('/ai/explain-code', data);
    return response.data;
  },

  aiAnalyzeBugs: async (data: {
    code: string;
    language?: string;
    file_path?: string;
    context?: string;
    static_findings?: any[];
  }): Promise<BugAnalysisResponse> => {
    const response = await apiClient.post<BugAnalysisResponse>('/ai/analyze-bugs', data);
    return response.data;
  },

  aiAnalyzeSecurity: async (data: {
    code: string;
    language?: string;
    file_path?: string;
    context?: string;
    static_findings?: any[];
  }): Promise<SecurityAnalysisResponse> => {
    const response = await apiClient.post<SecurityAnalysisResponse>('/ai/analyze-security', data);
    return response.data;
  },

  aiReviewPR: async (data: {
    diff_text: string;
    base_ref?: string;
    target_ref?: string;
    title?: string;
    description?: string;
  }): Promise<PullRequestReviewResponse> => {
    const response = await apiClient.post<PullRequestReviewResponse>('/ai/review-pr', data);
    return response.data;
  },

  aiGenerateDocs: async (data: {
    repo_name: string;
    doc_type: string;
    context_summary?: string;
    file_manifest?: string[];
  }): Promise<DocGenerationResponse> => {
    const response = await apiClient.post<DocGenerationResponse>('/ai/generate-docs', data);
    return response.data;
  },

  aiGenerateTests: async (data: {
    code: string;
    language?: string;
    framework?: string;
    context?: string;
  }): Promise<TestGenerationResponse> => {
    const response = await apiClient.post<TestGenerationResponse>('/ai/generate-tests', data);
    return response.data;
  },

  // Settings
  getSettings: async (): Promise<SystemSettings> => {
    const response = await apiClient.get<SystemSettings>('/settings/config');
    return response.data;
  },

  // Chatbot
  chatWithRepository: async (data: {
    repo_id: string;
    query: string;
    history?: ChatMessage[];
  }): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/chat/message', data);
    return response.data;
  },

  // PR Audit (enhanced endpoint)
  auditPullRequest: async (data: {
    repo_id?: string;
    diff_text: string;
    base_ref?: string;
    target_ref?: string;
    title?: string;
  }): Promise<PRAuditResponse> => {
    const response = await apiClient.post<PRAuditResponse>('/pull-requests/audit', data);
    return response.data;
  },

  // Dependencies
  getDependencyGraph: async (repoId: string): Promise<DependencyGraphResponse> => {
    const response = await apiClient.get<DependencyGraphResponse>(`/dependencies/${repoId}`);
    return response.data;
  },

  getImpactAnalysis: async (
    repoId: string,
    data: { modified_files: string[]; modified_symbols?: string[] }
  ): Promise<ImpactAnalysisResult> => {
    const response = await apiClient.post<ImpactAnalysisResult>(`/dependencies/${repoId}/impact`, data);
    return response.data;
  },
};
