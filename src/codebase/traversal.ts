/**
 * Safe Workspace Traversal, Security Boundaries, and File Inventory
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type FileInventoryItem,
  type FileCategory,
  type ScanWarning,
  type WorkspaceStats
} from './types.js';

export const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.vercel',
  'vendor',
  '.svn',
  '.hg'
]);

export const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key)$/i,
  /^id_rsa/i,
  /^id_ed25519/i,
  /secret/i,
  /credential/i
];

export const MAX_READ_SIZE_BYTES = 512 * 1024; // 512 KB limit for in-memory reading

export interface TraversalResult {
  canonicalRoot: string;
  files: FileInventoryItem[];
  readableFiles: Map<string, string>; // relativePath -> text content (only non-sensitive, under size limit)
  sensitiveFiles: Set<string>; // relativePaths of sensitive files
  oversizedFiles: Set<string>; // relativePaths of oversized files
  warnings: ScanWarning[];
  stats: WorkspaceStats;
}

export interface TraversalOptions {
  ignoredDirs?: Set<string>;
  maxFileSizeBytes?: number;
}

export function isSensitivePath(filename: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

export function categorizeFile(relativePath: string): FileCategory {
  const normalized = relativePath.toLowerCase();
  const filename = path.posix.basename(normalized);
  const ext = path.posix.extname(normalized);

  // 1. Tests
  if (
    normalized.includes('__tests__/') ||
    normalized.includes('tests/') ||
    normalized.includes('test/') ||
    /\.(test|spec)\.[a-z0-9]+$/i.test(filename)
  ) {
    return 'test';
  }

  // 2. Manifests
  if (
    filename === 'package.json' ||
    filename === 'package-lock.json' ||
    filename === 'pnpm-lock.yaml' ||
    filename === 'yarn.lock' ||
    filename === 'bun.lock' ||
    filename === 'bun.lockb'
  ) {
    return 'manifest';
  }

  // 3. Configurations
  if (
    filename.includes('.config.') ||
    filename.startsWith('tsconfig') ||
    filename.startsWith('jsconfig') ||
    filename.startsWith('.env') ||
    filename.startsWith('.eslint') ||
    filename.startsWith('.prettier')
  ) {
    return 'config';
  }

  // 4. Stylesheets
  if (['.css', '.scss', '.sass', '.less', '.styl'].includes(ext)) {
    return 'stylesheet';
  }

  // 5. Assets
  if (
    [
      '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico',
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.pdf'
    ].includes(ext)
  ) {
    return 'asset';
  }

  // 6. Documentation
  if (['.md', '.mdx', '.txt'].includes(ext) || filename === 'license') {
    return 'documentation';
  }

  // 7. Source Code
  if (
    ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.astro', '.mjs', '.cjs'].includes(ext)
  ) {
    return 'source';
  }

  return 'other';
}

function normalizePosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

function isInsideWorkspace(targetPath: string, canonicalRoot: string): boolean {
  const relative = path.relative(canonicalRoot, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Safely traverses the target workspace enforcing path safety, secret exclusion,
 * symlink containment, and memory limits.
 */
export async function traverseWorkspace(
  workspaceRoot: string,
  options: TraversalOptions = {}
): Promise<TraversalResult> {
  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(workspaceRoot);
  } catch (err) {
    throw new Error(
      `Invalid workspace path: Directory does not exist or cannot be accessed '${workspaceRoot}'.`
    );
  }

  const rootStat = await fs.stat(canonicalRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`Workspace path is not a directory: '${workspaceRoot}'.`);
  }

  const ignoredDirs = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? MAX_READ_SIZE_BYTES;

  const files: FileInventoryItem[] = [];
  const readableFiles = new Map<string, string>();
  const sensitiveFiles = new Set<string>();
  const oversizedFiles = new Set<string>();
  const warnings: ScanWarning[] = [];

  let filesScanned = 0;
  let filesSkipped = 0;
  let directoriesSkipped = 0;
  let totalSizeBytes = 0;

  async function walkDir(currentDir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(currentDir);
    } catch (err) {
      warnings.push({
        code: 'DIR_READ_FAILED',
        message: `Failed to read directory: ${(err as Error).message}`,
        targetPath: normalizePosixPath(path.relative(canonicalRoot, currentDir))
      });
      return;
    }

    // Sort entries for deterministic directory walking
    entries.sort((a, b) => a.localeCompare(b));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const relativePath = normalizePosixPath(path.relative(canonicalRoot, fullPath));

      let lstatResult;
      try {
        lstatResult = await fs.lstat(fullPath);
      } catch (err) {
        warnings.push({
          code: 'FILE_STAT_FAILED',
          message: `Failed to stat path: ${(err as Error).message}`,
          targetPath: relativePath
        });
        filesSkipped++;
        continue;
      }

      // Check symlinks
      if (lstatResult.isSymbolicLink()) {
        try {
          const resolvedPath = await fs.realpath(fullPath);
          if (!isInsideWorkspace(resolvedPath, canonicalRoot)) {
            warnings.push({
              code: 'SYMLINK_OUTSIDE_WORKSPACE',
              message: `Symlink '${relativePath}' points outside the workspace root and was skipped for safety.`,
              targetPath: relativePath
            });
            filesSkipped++;
            continue;
          }
          // Stat the resolved target
          lstatResult = await fs.stat(resolvedPath);
        } catch (err) {
          warnings.push({
            code: 'BROKEN_SYMLINK',
            message: `Symlink '${relativePath}' is broken or inaccessible: ${(err as Error).message}`,
            targetPath: relativePath
          });
          filesSkipped++;
          continue;
        }
      }

      if (lstatResult.isDirectory()) {
        if (ignoredDirs.has(entry)) {
          directoriesSkipped++;
          continue;
        }
        await walkDir(fullPath);
      } else if (lstatResult.isFile()) {
        filesScanned++;
        const sizeBytes = lstatResult.size;
        totalSizeBytes += sizeBytes;
        const ext = path.posix.extname(relativePath).toLowerCase();
        const category = categorizeFile(relativePath);

        files.push({
          relativePath,
          extension: ext,
          category,
          sizeBytes
        });

        // Check if file is sensitive
        if (isSensitivePath(entry)) {
          sensitiveFiles.add(relativePath);
          warnings.push({
            code: 'SECRET_FILE_EXCLUDED',
            message: `File '${relativePath}' matches sensitive file pattern and was excluded from content reading.`,
            targetPath: relativePath
          });
          continue;
        }

        // Check file size limits
        if (sizeBytes > maxFileSizeBytes) {
          oversizedFiles.add(relativePath);
          warnings.push({
            code: 'FILE_SIZE_LIMIT_EXCEEDED',
            message: `File '${relativePath}' exceeds ${Math.round(maxFileSizeBytes / 1024)} KB limit (${Math.round(sizeBytes / 1024)} KB) and was excluded from in-memory content parsing.`,
            targetPath: relativePath
          });
          continue;
        }

        // Only load text for code, config, manifest, documentation, stylesheet
        if (
          category === 'source' ||
          category === 'config' ||
          category === 'manifest' ||
          category === 'stylesheet' ||
          category === 'documentation'
        ) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            readableFiles.set(relativePath, content);
          } catch (err) {
            warnings.push({
              code: 'FILE_READ_FAILED',
              message: `Failed to read file content: ${(err as Error).message}`,
              targetPath: relativePath
            });
          }
        }
      }
    }
  }

  await walkDir(canonicalRoot);

  // Deterministic sorting of files by relativePath
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  warnings.sort((a, b) => {
    const c = a.code.localeCompare(b.code);
    if (c !== 0) return c;
    return (a.targetPath ?? '').localeCompare(b.targetPath ?? '');
  });

  return {
    canonicalRoot,
    files,
    readableFiles,
    sensitiveFiles,
    oversizedFiles,
    warnings,
    stats: {
      filesScanned,
      filesSkipped,
      directoriesSkipped,
      totalSizeBytes
    }
  };
}
