# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                  # Install all dependencies
pnpm build                    # Build all packages (turbo)
pnpm dev                      # Dev mode with watch (turbo, persistent)
pnpm lint                     # Lint all packages (biome check)
pnpm format                   # Format all packages (biome format --write)
pnpm test                     # Run all tests (turbo)

# Lector package only (from packages/lector/)
pnpm test:unit                # Vitest unit tests (browser-mode, Chrome via webdriverio)
pnpm test:size                # Bundle size check (size-limit, 150 kB limit)
```

## Architecture

**Monorepo** managed by pnpm workspaces + Turborepo. Three workspace packages:

| Package | Path | Description |
|---------|------|-------------|
| `@anaralabs/lector` | `packages/lector` | Core library - headless PDF viewer React components |
| `docs` | `packages/docs` | Documentation site (Next.js 15 + fumadocs) |
| `basic` | `examples/basic` | Example app (Vite + React) |

### Core Library (`packages/lector`)

Headless, composable PDF viewer for React 19, built on PDF.js. Published as `@anaralabs/lector` on npm. The build (tsup) prepends `"use client"` to the output.

**State management:** Zustand store (`PDFStore` in `src/internal.ts`) created via a custom `createZustandContext` pattern (`src/lib/zustand.tsx`) - creates a React context-scoped store rather than a global singleton. The `usePdf` hook is the primary way to read state. All PDF state (zoom, current page, viewports, highlights, rendered-pages tracking) lives in this store.

**Component tree:** `Root` loads the PDF document and provides the Zustand store + link service context. `Pages` virtualizes pages via `@tanstack/react-virtual`. `Page` wraps individual pages. Layers (`CanvasLayer`, `TextLayer`, `AnnotationLayer`, etc.) render inside each `Page`.

**PDF.js loading:** Lazy-loaded via `src/lib/pdfjs.ts` - uses the legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) for browser compatibility. Document loading happens in the `usePDFDocumentContext` hook.

**Canvas rendering:** `useCanvasLayer` renders pages to canvas with an LRU `ImageBitmap` cache (max 60 entries). Supports DPR-aware rendering and debounced zoom. Canvas scale is clamped to avoid exceeding browser max canvas area.

**Viewport invalidation:** `src/lib/viewport-invalidation.ts` - WeakMap-based registry that batches scroll/resize/ResizeObserver events through `requestAnimationFrame` to notify layer hooks.

**Zoom:** Supports manual zoom, fit-width (auto-adjusts on resize via ResizeObserver in `useFitWidth`), and pinch-to-zoom. Zoom is clamped between configurable min/max (default 0.5-10).

## Code Style

- **Formatter:** Biome with tabs, double quotes, semicolons
- **Linting:** Biome recommended rules; `noExplicitAny` and `noNonNullAssertion` are off; `useExhaustiveDependencies` is warn
- **Commits:** Conventional commits enforced by commitlint. Types: `build`, `chore`, `ci`, `clean`, `doc`, `feat`, `fix`, `perf`, `ref`, `revert`, `style`, `test`
- **Peer dependencies:** `react >=19`, `pdfjs-dist ^5.5.207`
