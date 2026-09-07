/**
 * ZYRA Codebase Investigation Subsystem — Data Contracts & Types (Schema Version 1.0)
 */

export const CODEBASE_EVIDENCE_SCHEMA_VERSION = '1.0' as const;

export type FrameworkConfidence = 'detected' | 'probable' | 'ambiguous' | 'unknown';

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type DependencyType = 'production' | 'development' | 'peer' | 'optional';

export type FileCategory =
  | 'source'
  | 'config'
  | 'manifest'
  | 'stylesheet'
  | 'asset'
  | 'test'
  | 'documentation'
  | 'other';

export type AssetCategory =
  | 'image'
  | 'font'
  | 'stylesheet'
  | 'script'
  | 'media'
  | 'document'
  | 'other';

export interface WorkspaceStats {
  filesScanned: number;
  filesSkipped: number;
  directoriesSkipped: number;
  totalSizeBytes: number;
}

export interface WorkspaceEvidence {
  root: string;
  scannedAt: string; // ISO 8601
  scannerVersion: string;
  stats: WorkspaceStats;
}

export interface FrameworkEvidence {
  name: string;
  confidence: FrameworkConfidence;
  version?: string;
  evidenceRefs: string[];
  details?: Record<string, unknown>;
}

export interface PackageManagerEvidence {
  name: PackageManagerName;
  lockfile?: string;
  hasConflict: boolean;
  conflicts?: string[];
  evidenceRefs: string[];
}

export interface RuntimeEvidence {
  declaredNodeVersion?: string;
  source?: string;
  evidenceRefs: string[];
}

export interface DependencyEvidence {
  name: string;
  versionRange: string;
  dependencyType: DependencyType;
  sourceManifest: string;
}

export interface FileInventoryItem {
  relativePath: string;
  extension: string;
  category: FileCategory;
  sizeBytes: number;
}

export interface RouteEvidence {
  path: string;
  sourceFile: string;
  framework: string;
  detectionMethod: string;
  isDynamic: boolean;
  evidenceRefs: string[];
}

export interface EntryPointEvidence {
  path: string;
  detectionReason: string;
  framework?: string;
  evidenceRefs: string[];
}

export interface AssetEvidence {
  relativePath: string;
  extension: string;
  category: AssetCategory;
  sizeBytes: number;
}

export interface FileImportSummary {
  sourceFile: string;
  staticImports: string[];
  dynamicImports: string[];
  unresolvedImports: string[];
}

export interface BuildConfigurationEvidence {
  bundler?: string;
  configFiles: string[];
  hasSourceMaps: boolean;
  aliases?: Record<string, string>;
  evidenceRefs: string[];
}

export interface ScanWarning {
  code: string;
  message: string;
  targetPath?: string;
}

export interface CodebaseEvidence {
  schemaVersion: typeof CODEBASE_EVIDENCE_SCHEMA_VERSION;
  workspace: WorkspaceEvidence;
  framework: FrameworkEvidence;
  packageManager: PackageManagerEvidence;
  runtime: RuntimeEvidence;
  dependencies: DependencyEvidence[];
  files: FileInventoryItem[];
  routes: RouteEvidence[];
  entryPoints: EntryPointEvidence[];
  assets: AssetEvidence[];
  imports: FileImportSummary[];
  configuration: BuildConfigurationEvidence;
  warnings: ScanWarning[];
}

export interface CodebaseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
