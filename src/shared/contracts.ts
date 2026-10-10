export const SCHEMA_VERSION = '0.1.1' as const;
// JavaScript UTF-16 code units; HTTP transport independently enforces bytes.
export const ANSWER_MAX_LENGTH = 1500;
export const REQUIREMENT_MAX_LENGTH = 800;
export type ToolEnvironment = 'codex-only' | 'claude-only' | 'mixed' | 'undecided';
export type Topic = 'goal' | 'audience' | 'core-scene' | 'storage' | 'tools' | 'constraints' | 'acceptance';
export type Status = 'proposed' | 'confirmed' | 'deferred' | 'rejected';
export type SourceKind = 'customer-input' | 'customer-answer' | 'ai-response' | 'mock-response' | 'customer-confirmation';
export interface Source { id: string; kind: SourceKind; text: string; atVersion: number }
export interface Brief { idea: string; tools: ToolEnvironment; constraints: string }
export interface Option { id: string; label: string; consequence: string }
export interface Question {
  id: string; topic: Topic; text: string; reason: string; example: string;
  options: Option[]; recommendation: { optionId: string; reason: string } | null;
}
export interface Answer {
  id: string; questionId: string; topic: Topic; disposition: 'answered' | 'unknown' | 'deferred';
  optionId: string | null; text: string; sourceId: string;
}
export interface Requirement {
  id: string; scope: 'user-project'; topic: Topic; kind: 'functional' | 'quality' | 'constraint';
  text: string; acceptance: string; priority: 'must' | 'should' | 'could' | 'undecided'; status: Status; origin: 'customer' | 'ai' | 'mock';
  sourceIds: string[]; version: number; locked: boolean; needsReview: boolean;
}
export interface Idea { text: string; problem: string; effect: string; placement: 'core' | 'future' }
export interface Suggestion extends Idea { id: string; sourceIds: string[]; status: 'proposed'; version: number }
export interface Proposal {
  key: string; topic: Topic; kind: Requirement['kind']; text: string; acceptance: string; sourceIds: string[];
}
export interface RequestPayload {
  schemaVersion: typeof SCHEMA_VERSION; projectId: string; baseVersion: number; requestId: string;
  stage: 'discover' | 'summarize'; brief: Brief; sources: Source[]; answers: Answer[];
  requirements: Requirement[];
}
export interface AiResult {
  projectId: string; baseVersion: number; requestId: string; summary: string;
  question: Question | null; proposals: Proposal[]; ideas: Idea[]; openItems: string[];
}
export interface Envelope { mode: 'mock' | 'deepseek'; result: AiResult }
export interface SelectionConflict {
  requirementId: string; topic: 'tools' | 'storage'; expectedText: string; sourceId: string;
  expectedAcceptance: string; expectedStatus: Status;
}
export interface SelectionResolutionPreview {
  requirementId: string; sourceId: string; baseVersion: number; choice: 'apply' | 'keep';
  text: string; acceptance: string; status: Status; priority: Requirement['priority']; needsReview: boolean;
}
export interface Project {
  schemaVersion: typeof SCHEMA_VERSION; id: string; version: number; brief: Brief;
  sources: Source[]; answers: Answer[]; requirements: Requirement[];
  question: Question | null; answeredQuestion: Question | null; conflicts: SelectionConflict[]; summary: string; ideas: Suggestion[]; openItems: string[];
  selectionResolutions: { requirementId: string; sourceId: string }[];
  phase: 'basic' | 'question' | 'summary'; pending: RequestPayload | null;
  error: string | null; responseMode: 'mock' | 'deepseek' | null;
}
