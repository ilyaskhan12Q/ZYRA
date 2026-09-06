import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_CONTEXT_FILES,
  type ContextFileName,
  type ContextDocument,
  type ContextValidationResult,
  type ProjectContext
} from './types.js';

/**
 * Locate the ZYRA package root where .context/ is bundled.
 */
export async function getPackageRoot(): Promise<string | null> {
  try {
    const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
    let dir = currentFileDir;
    while (true) {
      const candidateContext = path.join(dir, '.context');
      try {
        const stats = await fs.stat(candidateContext);
        if (stats.isDirectory()) {
          return dir;
        }
      } catch {
        // traverse up
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Locate the ZYRA project root by walking upward from the given directory.
 * If not found in the directory hierarchy and fallbackToPackage is true,
 * falls back to ZYRA's own installed package root.
 */
export async function findProjectRoot(
  startDir: string = process.cwd(),
  fallbackToPackage: boolean = true
): Promise<string> {
  let currentDir = path.resolve(startDir);

  while (true) {
    const contextDir = path.join(currentDir, '.context');
    try {
      const stats = await fs.stat(contextDir);
      if (stats.isDirectory()) {
        return currentDir;
      }
    } catch {
      // Keep traversing up
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  if (fallbackToPackage) {
    const pkgRoot = await getPackageRoot();
    if (pkgRoot) {
      return pkgRoot;
    }
  }

  throw new Error(`Could not find ZYRA project root containing '.context/' starting from '${startDir}'.`);
}

/**
 * Validate that all required context files exist and are well-formed.
 */
export async function validateContext(projectRoot?: string): Promise<ContextValidationResult> {
  const root = projectRoot ? path.resolve(projectRoot) : await findProjectRoot();
  const contextDir = path.join(root, '.context');

  const missingFiles: ContextFileName[] = [];
  const malformedFiles: Array<{ name: string; reason: string }> = [];
  const foundFiles: ContextFileName[] = [];

  for (const fileName of REQUIRED_CONTEXT_FILES) {
    const filePath = path.join(contextDir, fileName);
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        malformedFiles.push({ name: fileName, reason: 'Path is a directory, not a file' });
        continue;
      }

      if (stats.size === 0) {
        malformedFiles.push({ name: fileName, reason: 'File is empty (0 bytes)' });
        continue;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      if (content.trim().length === 0) {
        malformedFiles.push({ name: fileName, reason: 'File contains only whitespace' });
        continue;
      }

      foundFiles.push(fileName);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'ENOENT') {
        missingFiles.push(fileName);
      } else {
        malformedFiles.push({ name: fileName, reason: (err as Error).message });
      }
    }
  }

  return {
    isValid: missingFiles.length === 0 && malformedFiles.length === 0,
    projectRoot: root,
    contextDir,
    missingFiles,
    malformedFiles,
    foundFiles
  };
}

/**
 * Extract field values from markdown files using simple regex.
 */
function extractFieldValue(content: string, fieldName: string): string {
  const regex = new RegExp(`(?:\\*\\*|#+ )?${fieldName}:?\\*\\*?\\s*([^\n\r]+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : 'Unknown';
}

/**
 * Load the entire persistent project context.
 * Throws an error if required context files are missing or malformed.
 */
export async function loadContext(projectRoot?: string): Promise<ProjectContext> {
  const root = projectRoot ? path.resolve(projectRoot) : await findProjectRoot();
  const validation = await validateContext(root);

  if (!validation.isValid) {
    const issues: string[] = [];
    if (validation.missingFiles.length > 0) {
      issues.push(`Missing required context files: ${validation.missingFiles.join(', ')}`);
    }
    if (validation.malformedFiles.length > 0) {
      issues.push(
        `Malformed files: ${validation.malformedFiles.map((m) => `${m.name} (${m.reason})`).join(', ')}`
      );
    }
    throw new Error(`Invalid ZYRA project context:\n- ${issues.join('\n- ')}`);
  }

  const documents = {} as Record<ContextFileName, ContextDocument>;

  for (const fileName of REQUIRED_CONTEXT_FILES) {
    const filePath = path.join(validation.contextDir, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);

    documents[fileName] = {
      name: fileName,
      path: filePath,
      content,
      exists: true,
      sizeBytes: stats.size
    };
  }

  const currentStateContent = documents['CURRENT_STATE.md']?.content ?? '';
  const currentPhase = extractFieldValue(currentStateContent, 'Current Phase');
  const status = extractFieldValue(currentStateContent, 'Status');

  return {
    projectRoot: root,
    contextDir: validation.contextDir,
    loadedAt: new Date().toISOString(),
    documents,
    summary: {
      projectName: 'ZYRA',
      currentPhase: currentPhase !== 'Unknown' ? currentPhase : 'Phase 01 — Foundation',
      status: status !== 'Unknown' ? status : 'Operational',
      totalDocuments: REQUIRED_CONTEXT_FILES.length
    }
  };
}
