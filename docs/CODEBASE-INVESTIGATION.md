# ZYRA Codebase Investigation Subsystem

## Overview

The ZYRA Codebase Investigation Subsystem (Phase 04) provides a strictly read-only, safe, and deterministic static scanner for target workspace repositories. It inspects a target project to extract structured, empirical **Codebase Evidence** adhering to `CodebaseEvidence` Schema Version 1.0.

This evidence layer serves as the foundation for future correlation with browser telemetry (Phase 05), bridging the gap between what users experience in the browser (e.g. slow LCP, high TBT, render-blocking scripts) and the specific routes, dependencies, assets, and entry points inside the codebase.

```
TARGET WEBSITE                   TARGET WORKSPACE
     ↓                                  ↓
LIGHTHOUSE                       CODEBASE SCANNER
     ↓                           (Read-Only Safe)
BROWSER EVIDENCE                        ↓
     ↓                           CODEBASE EVIDENCE
DETERMINISTIC FINDINGS                  │
     │                                  │
     └──────────────┬───────────────────┘
                    ▼
          CORRELATION ENGINE
             (Phase 05)
```

---

## Strict Negative Boundaries

To preserve absolute safety and determinism, the Codebase Investigation subsystem operates under strict negative boundaries:

1. **Strictly Read-Only**: Never creates, modifies, deletes, or alters any file in the target project directory.
2. **Zero Code Execution**: Never runs build commands, installs packages, executes user scripts, or imports untrusted code (`no npm run build`, `no npm install`, `no eval`, `no child_process.exec`).
3. **No Network Requests**: Traversal and analysis occur 100% locally and offline.
4. **No LLM / AI Dependencies**: All detection, parsing, route extraction, and inventorying are deterministic, heuristic, and rule-based.
5. **No Speculative Causality**: Does not claim "this file is responsible for 400ms LCP". It merely facts-finds workspace attributes, routes, dependencies, and imports. Causal correlation is reserved for Phase 05.

---

## Security & Traversal Guarantees

The safe directory walker in `src/codebase/traversal.ts` enforces four security guarantees:

1. **Path Safety & Containment**: Resolves realpaths, normalizes to POSIX paths, and asserts that every accessed file is strictly contained within the canonical workspace directory.
2. **Symlink Escape Protection**: Symlinks pointing outside the workspace boundary are skipped and recorded with a `SYMLINK_OUTSIDE_WORKSPACE` warning. Broken symlinks are logged with `BROKEN_SYMLINK`.
3. **Secret & Sensitive File Exclusion**: Files matching sensitive patterns (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `secret*`, `credential*`) are NEVER loaded into memory for content analysis. Their presence is recorded in warnings (`SECRET_FILE_EXCLUDED`).
4. **Memory Limits**: Files exceeding the 512 KB threshold are inventoried by name, path, extension, and size, but excluded from in-memory content parsing to prevent heap exhaustion (`FILE_SIZE_LIMIT_EXCEEDED`).
5. **Directory Exclusions**: Automatically skips standard dependency, build, and version control directories (`node_modules`, `.git`, `dist`, `build`, `.next`, `.nuxt`, `.turbo`, `.vercel`, `vendor`).

---

## Detection Capabilities

### 1. Framework Detection (`src/codebase/detector/framework.ts`)
Inspects dependencies, config files, and directory layouts to classify the primary framework with a confidence score:
- **Next.js**: App Router (`app/`), Pages Router (`pages/`), config files (`next.config.*`), version from `next`.
- **Vite**: UI library pairings (`React (Vite)`, `Vue (Vite)`, `Svelte (Vite)`).
- **Nuxt**: `nuxt.config.*`, directory conventions.
- **SvelteKit**: `@sveltejs/kit`, `svelte.config.*`.
- **Astro**: `astro.config.*`, `src/pages/*.astro`.
- **Angular**: `angular.json`, `@angular/core`.
- **Standalone React / Vue / Svelte**.
- **Ambiguity Detection**: Projects with conflicting meta-framework indicators (e.g. both `next` and `nuxt` present) are assigned `confidence: 'ambiguous'` rather than guessing.

### 2. Package Manager & Conflict Detection (`src/codebase/detector/packageManager.ts`)
- Detects lockfiles for `npm` (`package-lock.json`), `pnpm` (`pnpm-lock.yaml`), `yarn` (`yarn.lock`), and `bun` (`bun.lock`, `bun.lockb`).
- Identifies **Lockfile Conflicts**: When multiple lockfiles coexist, flags `hasConflict: true`, assigns `name: 'unknown'`, and logs a `LOCKFILE_CONFLICT` warning.
- Falls back to `package.json` `packageManager` field if lockfiles are missing.

### 3. Runtime Detection (`src/codebase/detector/runtime.ts`)
- Extracts declared Node.js engines version from `package.json` (`engines.node`).
- Inspects `.nvmrc` and `.node-version` version declaration files.

### 4. Route Extraction (`src/codebase/detector/routes.ts`)
Deterministic route mapping based on framework directory conventions:
- **Next.js App Router**: Maps `app/**/page.{tsx,jsx,ts,js}` to URL paths (stripping route groups like `(marketing)` and parallel routes). Flags dynamic routes (`[slug]`, `[...catchAll]`).
- **Next.js Pages Router**: Maps `pages/**` to URL paths (excluding `_app`, `_document`, `_error`, `api/*`).
- **SvelteKit**: Maps `src/routes/**/+page.{svelte,ts,js}`.
- **Astro**: Maps `src/pages/**/*.{astro,md,mdx}`.

### 5. Entry Point Identification (`src/codebase/detector/entryPoints.ts`)
Locates primary application bootstrapping roots:
- Next.js root layout (`app/layout.tsx`) and Pages root (`pages/_app.tsx`).
- Vite / Webpack main entry points (`src/main.tsx`, `src/index.tsx`).
- Root application components (`src/App.tsx`, `src/App.vue`).

### 6. Dependency Analysis (`src/codebase/analyzer/dependencies.ts`)
Parses `package.json` to categorize dependencies into production, development, peer, and optional, preserving declared semantic version ranges.

### 7. Asset Inventory (`src/codebase/analyzer/assets.ts`)
Inventories and categorizes static assets by file extension:
- `image`: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.svg`, `.ico`, `.gif`
- `font`: `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`
- `stylesheet`: `.css`, `.scss`, `.sass`, `.less`, `.styl`
- `media`: `.mp4`, `.webm`, `.ogg`, `.mp3`, `.wav`

### 8. Import Graph & Syntax Analysis (`src/codebase/analyzer/imports.ts`)
Deterministic regex-based static analysis without code execution:
- Extracts static ES imports (`import ... from "..."`, `import "..."`, `export ... from "..."`).
- Extracts CommonJS `require("...")`.
- Extracts dynamic `import("...")`.
- Resolves relative file paths against the repository file inventory.
- Preserves unresolved external packages and path aliases.

### 9. Build Configuration & Source Maps (`src/codebase/analyzer/config.ts`)
- Identifies build tool configurations (`next.config.*`, `vite.config.*`, `tsconfig.json`, `webpack.config.*`).
- String-aware JSONC parser for `tsconfig.json` extracting `compilerOptions.paths` aliases.
- Inspects configs for source map generation (`sourceMap: true`, `productionBrowserSourceMaps: true`, or presence of `*.map` files).

---

## CLI Usage

### Human Summary Output
```bash
zyra codebase ./my-project
# or alias:
zyra inspect ./my-project
```

Output:
```text
============================================================
 ZYRA — Codebase Investigation
============================================================

 WORKSPACE
 ------------------------------------------------------------
 Root:              my-project
 Scanned At:        2026-09-06T10:50:00.000Z
 Scanner:           v0.4.0
 Files Scanned:     14 (28.4 KB total)
 Files Skipped:     0
 Dirs Skipped:      2

 FRAMEWORK
 ------------------------------------------------------------
 Primary Framework: Next.js (Confidence: detected)
 Version:           14.2.5
 Evidence:          package.json (next@14.2.5), next.config.js, app/ (App Router)

 PACKAGE MANAGER & RUNTIME
 ------------------------------------------------------------
 Package Manager:   npm
 Lockfile:          package-lock.json
 Conflict:          No
 Declared Node:     >=18.17.0 (package.json engines.node)

 DEPENDENCIES (4 declared)
 ------------------------------------------------------------
 Breakdown:         4 production, 0 development
 Notable:           next@14.2.5, react@^18.3.1, react-dom@^18.3.1, lucide-react@^0.428.0

 ROUTES (3 detected)
 ------------------------------------------------------------
 /                         -> app/page.tsx [Next.js (App Router)]
 /dashboard                -> app/dashboard/page.tsx [Next.js (App Router)]
 /blog/[slug]              -> app/blog/[slug]/page.tsx [Next.js (App Router)]

 ENTRY POINTS (1 detected)
 ------------------------------------------------------------
 app/layout.tsx            (Next.js App Router Root Layout)

 ASSETS (2 inventoried)
 ------------------------------------------------------------
 Total Assets:      2 (1.2 KB)
 [image     ] public/hero.png (0.0 KB)
 [stylesheet] app/globals.css (0.1 KB)

 CONFIGURATION & SOURCE MAPS
 ------------------------------------------------------------
 Bundler:           Next.js (Turbopack / Webpack)
 Config Files:      next.config.js, tsconfig.json
 Source Maps:       Detected
```

### Structured JSON Output
```bash
zyra codebase ./my-project --json
```

Emits the complete, machine-readable `CodebaseEvidence` document conforming to Schema Version 1.0.
