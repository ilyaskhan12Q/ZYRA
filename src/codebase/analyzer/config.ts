import { type BuildConfigurationEvidence, type FileInventoryItem } from '../types.js';

const KNOWN_CONFIG_REGEX =
  /^(?:next\.config\.(?:js|mjs|cjs|ts)|vite\.config\.(?:js|mjs|cjs|ts)|nuxt\.config\.(?:js|mjs|ts)|astro\.config\.(?:js|mjs|ts)|svelte\.config\.(?:js|cjs|mjs|ts)|webpack\.config\.(?:js|ts)|rollup\.config\.(?:js|mjs|ts)|tsconfig(?:\..+)?\.json|jsconfig(?:\..+)?\.json)$/i;

function stripJsonComments(str: string): string {
  let result = '';
  let inString = false;
  let inSingleComment = false;
  let inMultiComment = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];
    if (inString) {
      result += ch;
      if (ch === '\\' && next) {
        result += next;
        i++;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (inSingleComment) {
      if (ch === '\n') {
        inSingleComment = false;
        result += ch;
      }
    } else if (inMultiComment) {
      if (ch === '*' && next === '/') {
        inMultiComment = false;
        i++;
      }
    } else {
      if (ch === '"') {
        inString = true;
        result += ch;
      } else if (ch === '/' && next === '/') {
        inSingleComment = true;
        i++;
      } else if (ch === '/' && next === '*') {
        inMultiComment = true;
        i++;
      } else {
        result += ch;
      }
    }
  }
  return result;
}

export function inspectConfiguration(
  files: readonly FileInventoryItem[],
  readableFiles: Map<string, string>,
  detectedFramework?: string
): BuildConfigurationEvidence {
  const configFiles: string[] = [];
  const evidenceRefs: string[] = [];
  let hasSourceMaps = false;

  for (const file of files) {
    if (KNOWN_CONFIG_REGEX.test(file.relativePath)) {
      configFiles.push(file.relativePath);
      evidenceRefs.push(file.relativePath);
    }
    if (file.extension.toLowerCase() === '.map') {
      hasSourceMaps = true;
    }
  }

  // Detect bundler
  let bundler: string | undefined = undefined;
  if (configFiles.some((c) => c.startsWith('vite.config.'))) {
    bundler = 'Vite';
  } else if (configFiles.some((c) => c.startsWith('next.config.'))) {
    bundler = 'Next.js (Turbopack / Webpack)';
  } else if (configFiles.some((c) => c.startsWith('nuxt.config.'))) {
    bundler = 'Nuxt (Vite / Webpack)';
  } else if (configFiles.some((c) => c.startsWith('astro.config.'))) {
    bundler = 'Astro (Vite)';
  } else if (configFiles.some((c) => c.startsWith('webpack.config.'))) {
    bundler = 'Webpack';
  } else if (configFiles.some((c) => c.startsWith('rollup.config.'))) {
    bundler = 'Rollup';
  } else if (detectedFramework) {
    if (detectedFramework.includes('Vite')) bundler = 'Vite';
    else if (detectedFramework.includes('Next.js')) bundler = 'Next.js (Turbopack / Webpack)';
  }

  // Check build tool configs (e.g. vite.config, next.config, webpack.config) for sourcemap configurations
  for (const cfgFile of configFiles) {
    const content = readableFiles.get(cfgFile);
    if (content) {
      if (
        /\bsourcemap\s*:\s*true\b/i.test(content) ||
        /\bsourceMap\s*:\s*true\b/i.test(content) ||
        /\bproductionBrowserSourceMaps\s*:\s*true\b/i.test(content)
      ) {
        hasSourceMaps = true;
        evidenceRefs.push(`${cfgFile} (sourcemap: true)`);
      }
    }
  }

  // Check tsconfig.json for sourceMap and path aliases
  let aliases: Record<string, string> | undefined = undefined;
  const tsconfigContent = readableFiles.get('tsconfig.json') ?? readableFiles.get('jsconfig.json');
  if (tsconfigContent) {
    try {
      const cleanJson = stripJsonComments(tsconfigContent).replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(cleanJson);
      const compilerOptions = parsed?.compilerOptions;

      if (compilerOptions?.sourceMap === true) {
        hasSourceMaps = true;
        evidenceRefs.push('tsconfig.json (compilerOptions.sourceMap)');
      }

      if (compilerOptions?.paths && typeof compilerOptions.paths === 'object') {
        aliases = {};
        for (const [aliasKey, targetArr] of Object.entries(compilerOptions.paths)) {
          if (Array.isArray(targetArr) && typeof targetArr[0] === 'string') {
            aliases[aliasKey] = targetArr[0];
          }
        }
      }
    } catch {
      // JSON parsing failure in tsconfig (untrusted content) - gracefully ignored
    }
  }

  configFiles.sort((a, b) => a.localeCompare(b));
  evidenceRefs.sort((a, b) => a.localeCompare(b));

  return {
    bundler,
    configFiles,
    hasSourceMaps,
    aliases,
    evidenceRefs
  };
}
