export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'offline';
  version: string;
  project_name: string;
  environment: string;
  database_connected: boolean;
  groq_configured: boolean;
  groq_model: string;
  timestamp: string;
}

export interface SeverityCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
}

export interface RecentActivityItem {
  id: string;
  repo_name: string;
  event_type: string;
  status: string;
  quality_score?: number | null;
  created_at: string;
}

export interface DashboardSummary {
  repositories_count: number;
  analyzed_repositories_count: number;
  total_findings_count: number;
  critical_findings_count: number;
  security_findings_count: number;
  average_quality_score?: number | null;
  severity_breakdown: SeverityCount;
  recent_activities: RecentActivityItem[];
}

export interface Repository {
  id: string;
  name: string;
  url?: string | null;
  source_type: 'GITHUB' | 'ZIP_UPLOAD';
  default_branch: string;
  size_bytes: number;
  file_count: number;
  primary_language?: string | null;
  language_distribution: Record<string, number>;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size: number;
  language?: string | null;
  line_count?: number;
  children?: TreeNode[];
}

export interface RepositoryFileTreeResponse {
  repo_id: string;
  name: string;
  total_files: number;
  total_bytes: number;
  primary_language?: string | null;
  language_distribution: Record<string, number>;
  tree: TreeNode;
}

export interface RepositoryFileContentResponse {
  path: string;
  content: string;
  size: number;
  line_count: number;
}

export interface Finding {
  id: string;
  analysis_id: string;
  repo_id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  category: 'SECURITY' | 'BUG' | 'QUALITY' | 'PERFORMANCE' | 'TECH_DEBT';
  source: string;
  file_path: string;
  line_start: number;
  line_end: number;
  code_snippet?: string | null;
  explanation?: string | null;
  why_it_matters?: string | null;
  suggested_fix?: string | null;
  confidence: number;
  created_at: string;
}

export interface AnalysisJob {
  id: string;
  repo_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  quality_score: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  commit_hash?: string | null;
  summary?: string | null;
  metrics: Record<string, any>;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}

// -------------------------------------------------------------
// AI Engine Types
// -------------------------------------------------------------
export interface AIMetadata {
  model_used: string;
  is_mock: boolean;
  tokens_used?: number | null;
}

export interface CoreComponent {
  name: string;
  purpose: string;
  key_files: string[];
}

export interface RepoSummaryResponse extends AIMetadata {
  overview: string;
  architecture_style: string;
  primary_languages: string[];
  core_components: CoreComponent[];
  entry_points: string[];
  dependencies_summary: string;
  technical_debt_assessment: string;
  recommended_next_steps: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  description: string;
}

export interface OutputInfo {
  type: string;
  description: string;
}

export interface CodeExplanationResponse extends AIMetadata {
  file_path?: string | null;
  symbol_name?: string | null;
  explanation_level: string;
  what_it_does: string;
  how_it_works: string;
  inputs: ParameterInfo[];
  outputs: OutputInfo[];
  dependencies: string[];
  important_logic_steps: string[];
  potential_problems: string[];
  blast_radius_and_impact: string;
}

export interface BugItem {
  title: string;
  severity: string;
  line_number?: number | null;
  code_snippet?: string | null;
  root_cause: string;
  reproduction_scenario: string;
  suggested_fix: string;
}

export interface BugAnalysisResponse extends AIMetadata {
  file_path?: string | null;
  overall_bug_risk: string;
  bugs_found: BugItem[];
  recommendations: string[];
}

export interface SecurityVulnerability {
  title: string;
  cwe_id?: string | null;
  severity: string;
  affected_file?: string | null;
  line_number?: number | null;
  attack_vector: string;
  impact: string;
  remediation_code: string;
}

export interface SecurityAnalysisResponse extends AIMetadata {
  security_score: number;
  vulnerabilities: SecurityVulnerability[];
  compliance_notes?: string | null;
  hardened_code_recommendations: string[];
}

export interface PRReviewFinding {
  file: string;
  line?: number | null;
  severity: string;
  category: string;
  comment: string;
  suggested_diff?: string | null;
}

export interface PullRequestReviewResponse extends AIMetadata {
  summary: string;
  risk_level: string;
  changed_files_analyzed: number;
  key_changes: string[];
  review_findings: PRReviewFinding[];
  breaking_changes: string[];
  testing_recommendations: string[];
  approval_status: string;
}

export interface DocGenerationResponse extends AIMetadata {
  doc_type: string;
  title: string;
  content_markdown: string;
  table_of_contents: string[];
  suggested_filename: string;
}

export interface TestCaseItem {
  name: string;
  type: string;
  description: string;
}

export interface TestGenerationResponse extends AIMetadata {
  framework: string;
  test_code: string;
  test_cases: TestCaseItem[];
  coverage_notes: string;
}

export interface ToolStatus {
  name: string;
  installed: boolean;
  description: string;
}

export interface SystemSettings {
  project_name: string;
  environment: string;
  debug: boolean;
  database_backend: string;
  groq_model: string;
  groq_configured: boolean;
  groq_api_key_status: string;
  storage_dir: string;
  max_upload_size_mb: number;
  tools: ToolStatus[];
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ReferencedFile {
  file_path: string;
  line_start: number;
  line_end: number;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  referenced_files: ReferencedFile[];
  is_mock: boolean;
  model_used: string;
  repo_id: string;
  repo_name: string;
}

// PR Audit types
export interface AuditFinding {
  id: string;
  title: string;
  severity: string;
  category: string;
  file: string;
  line_number?: number | null;
  code_snippet?: string | null;
  explanation: string;
  why_it_matters: string;
  suggested_fix: string;
  source: 'STATIC_ANALYSIS' | 'GROQ_AI';
}

export interface ImpactAnalysisResult {
  impact_level: string;
  summary: string;
  modified_files: string[];
  direct_dependents: string[];
  transitive_dependents: string[];
  affected_callers: Array<{ symbol: string; defined_in: string; line: number; type: string }>;
  total_impacted_modules: number;
}

export interface PRAuditResponse {
  summary: string;
  risk_level: string;
  approval_status: string;
  total_findings: number;
  static_findings_count: number;
  ai_findings_count: number;
  findings: AuditFinding[];
  impact: ImpactAnalysisResult | null;
  breaking_changes: string[];
  testing_recommendations: string[];
  is_mock: boolean;
  model_used: string;
}

// Dependency graph types
export interface DependencyNode {
  id: string;
  label: string;
  path: string;
  symbols_count: number;
  in_degree: number;
  out_degree: number;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
}

export interface DependencyGraphResponse {
  repo_id: string;
  repo_name: string;
  total_files: number;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}
