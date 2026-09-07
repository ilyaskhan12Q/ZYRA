import { type DependencyEvidence, type DependencyType } from '../types.js';

export function extractDependencies(
  packageJsonParsed?: Record<string, unknown> | null,
  manifestPath: string = 'package.json'
): DependencyEvidence[] {
  if (!packageJsonParsed || typeof packageJsonParsed !== 'object') {
    return [];
  }

  const result: DependencyEvidence[] = [];

  const sections: Array<{ key: string; type: DependencyType }> = [
    { key: 'dependencies', type: 'production' },
    { key: 'devDependencies', type: 'development' },
    { key: 'peerDependencies', type: 'peer' },
    { key: 'optionalDependencies', type: 'optional' }
  ];

  for (const { key, type } of sections) {
    const sectionObj = packageJsonParsed[key];
    if (sectionObj && typeof sectionObj === 'object') {
      for (const [name, versionRange] of Object.entries(sectionObj as Record<string, unknown>)) {
        if (typeof name === 'string' && typeof versionRange === 'string') {
          result.push({
            name,
            versionRange,
            dependencyType: type,
            sourceManifest: manifestPath
          });
        }
      }
    }
  }

  // Deterministic sorting by name
  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}
