import {
  type PackageManagerEvidence,
  type PackageManagerName,
  type FileInventoryItem
} from '../types.js';

export function detectPackageManager(
  files: readonly FileInventoryItem[],
  packageJsonParsed?: Record<string, unknown> | null
): PackageManagerEvidence {
  const fileSet = new Set(files.map((f) => f.relativePath));
  const detectedLockfiles: Array<{ name: PackageManagerName; path: string }> = [];

  if (fileSet.has('package-lock.json')) {
    detectedLockfiles.push({ name: 'npm', path: 'package-lock.json' });
  }
  if (fileSet.has('pnpm-lock.yaml')) {
    detectedLockfiles.push({ name: 'pnpm', path: 'pnpm-lock.yaml' });
  }
  if (fileSet.has('yarn.lock')) {
    detectedLockfiles.push({ name: 'yarn', path: 'yarn.lock' });
  }
  if (fileSet.has('bun.lock') || fileSet.has('bun.lockb')) {
    detectedLockfiles.push({
      name: 'bun',
      path: fileSet.has('bun.lock') ? 'bun.lock' : 'bun.lockb'
    });
  }

  // Conflict case
  if (detectedLockfiles.length > 1) {
    const conflicts = detectedLockfiles.map((l) => l.path).sort();
    return {
      name: 'unknown',
      hasConflict: true,
      conflicts,
      evidenceRefs: conflicts
    };
  }

  // Single lockfile
  if (detectedLockfiles.length === 1) {
    const single = detectedLockfiles[0];
    return {
      name: single.name,
      lockfile: single.path,
      hasConflict: false,
      evidenceRefs: [single.path]
    };
  }

  // Fallback: check package.json "packageManager" property (e.g. "pnpm@8.15.0")
  if (packageJsonParsed && typeof packageJsonParsed.packageManager === 'string') {
    const pmString = packageJsonParsed.packageManager.toLowerCase();
    let name: PackageManagerName = 'unknown';
    if (pmString.startsWith('npm')) name = 'npm';
    else if (pmString.startsWith('pnpm')) name = 'pnpm';
    else if (pmString.startsWith('yarn')) name = 'yarn';
    else if (pmString.startsWith('bun')) name = 'bun';

    if (name !== 'unknown') {
      return {
        name,
        hasConflict: false,
        evidenceRefs: ['package.json']
      };
    }
  }

  return {
    name: 'unknown',
    hasConflict: false,
    evidenceRefs: []
  };
}
