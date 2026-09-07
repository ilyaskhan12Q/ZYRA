import { type RuntimeEvidence } from '../types.js';

export function detectRuntime(
  readableFiles: Map<string, string>,
  packageJsonParsed?: Record<string, unknown> | null
): RuntimeEvidence {
  // 1. Check package.json engines.node
  if (
    packageJsonParsed &&
    packageJsonParsed.engines &&
    typeof (packageJsonParsed.engines as Record<string, unknown>).node === 'string'
  ) {
    const nodeEngines = (packageJsonParsed.engines as Record<string, string>).node.trim();
    return {
      declaredNodeVersion: nodeEngines,
      source: 'package.json engines.node',
      evidenceRefs: ['package.json']
    };
  }

  // 2. Check .nvmrc
  if (readableFiles.has('.nvmrc')) {
    const nvmrc = readableFiles.get('.nvmrc')?.trim();
    if (nvmrc) {
      return {
        declaredNodeVersion: nvmrc,
        source: '.nvmrc',
        evidenceRefs: ['.nvmrc']
      };
    }
  }

  // 3. Check .node-version
  if (readableFiles.has('.node-version')) {
    const nodeVersion = readableFiles.get('.node-version')?.trim();
    if (nodeVersion) {
      return {
        declaredNodeVersion: nodeVersion,
        source: '.node-version',
        evidenceRefs: ['.node-version']
      };
    }
  }

  return {
    declaredNodeVersion: undefined,
    source: undefined,
    evidenceRefs: []
  };
}
