/**
 * ZYRA Context System Types
 */

export const REQUIRED_CONTEXT_FILES = [
  'MISSION.md',
  'PROJECT.md',
  'ARCHITECTURE.md',
  'CURRENT_STATE.md',
  'ROADMAP.md',
  'DECISIONS.md',
  'RULES.md',
  'CONTRACTS.md',
  'TASKS.md',
  'CHANGELOG.md'
] as const;

export type ContextFileName = (typeof REQUIRED_CONTEXT_FILES)[number];

export interface ContextDocument {
  name: ContextFileName;
  path: string;
  content: string;
  exists: boolean;
  sizeBytes: number;
}

export interface ContextValidationResult {
  isValid: boolean;
  projectRoot: string;
  contextDir: string;
  missingFiles: ContextFileName[];
  malformedFiles: Array<{ name: string; reason: string }>;
  foundFiles: ContextFileName[];
}

export interface ProjectContext {
  projectRoot: string;
  contextDir: string;
  loadedAt: string;
  documents: Record<ContextFileName, ContextDocument>;
  summary: {
    projectName: string;
    currentPhase: string;
    status: string;
    totalDocuments: number;
  };
}
