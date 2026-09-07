import * as path from 'node:path';
import { type FileImportSummary, type FileInventoryItem } from '../types.js';

const RESOLUTION_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
  '.css',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx'
];

/**
 * Strips comments from JavaScript/TypeScript code to avoid matching commented-out imports.
 */
function stripComments(source: string): string {
  // Replace multi-line comments with spaces (preserving newlines) and single-line comments with empty lines
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
    .replace(/\/\/.*/g, '');
}

/**
 * Deterministically analyzes static and dynamic imports across readable source files.
 * Uses regex-based static analysis without executing target code.
 */
export function analyzeImports(
  readableFiles: Map<string, string>,
  files: readonly FileInventoryItem[]
): FileImportSummary[] {
  const fileSet = new Set(files.map((f) => f.relativePath));
  const summaries: FileImportSummary[] = [];

  for (const [sourceFile, content] of readableFiles.entries()) {
    // Only analyze source code files
    const ext = path.posix.extname(sourceFile).toLowerCase();
    if (!['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro'].includes(ext)) {
      continue;
    }

    const cleanCode = stripComments(content);
    const staticImportsSet = new Set<string>();
    const dynamicImportsSet = new Set<string>();
    const unresolvedImportsSet = new Set<string>();

    // 1. Static ES imports & exports with from:
    // import ... from "specifier"
    // export ... from "specifier"
    const fromImportRegex = /(?:import|export)\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = fromImportRegex.exec(cleanCode)) !== null) {
      const specifier = match[2].trim();
      if (specifier) {
        resolveSpecifier(specifier, sourceFile, fileSet, staticImportsSet, unresolvedImportsSet);
      }
    }

    // 2. Side-effect imports:
    // import "specifier";
    const sideEffectRegex = /(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectRegex.exec(cleanCode)) !== null) {
      const specifier = match[1].trim();
      if (specifier) {
        resolveSpecifier(specifier, sourceFile, fileSet, staticImportsSet, unresolvedImportsSet);
      }
    }

    // 2. CommonJS require:
    // require("specifier")
    const requireRegex = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(cleanCode)) !== null) {
      const specifier = match[1].trim();
      if (specifier) {
        resolveSpecifier(specifier, sourceFile, fileSet, staticImportsSet, unresolvedImportsSet);
      }
    }

    // 3. Dynamic imports:
    // import("specifier")
    const dynamicImportRegex = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(cleanCode)) !== null) {
      const specifier = match[1].trim();
      if (specifier) {
        resolveSpecifier(specifier, sourceFile, fileSet, dynamicImportsSet, unresolvedImportsSet);
      }
    }

    summaries.push({
      sourceFile,
      staticImports: Array.from(staticImportsSet).sort(),
      dynamicImports: Array.from(dynamicImportsSet).sort(),
      unresolvedImports: Array.from(unresolvedImportsSet).sort()
    });
  }

  summaries.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
  return summaries;
}

function resolveSpecifier(
  specifier: string,
  sourceFile: string,
  fileSet: Set<string>,
  targetSet: Set<string>,
  unresolvedSet: Set<string>
): void {
  // Relative path import
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const dir = path.posix.dirname(sourceFile);
    const candidateBase = path.posix.normalize(path.posix.join(dir, specifier));

    let resolved: string | null = null;
    for (const extension of RESOLUTION_EXTENSIONS) {
      const trial = candidateBase + extension;
      if (fileSet.has(trial)) {
        resolved = trial;
        break;
      }
    }

    if (resolved) {
      targetSet.add(resolved);
    } else {
      unresolvedSet.add(specifier);
    }
  } else {
    // Bare specifier or package alias (e.g. 'react', '@scope/pkg', '@/components/Button')
    targetSet.add(specifier);
  }
}
