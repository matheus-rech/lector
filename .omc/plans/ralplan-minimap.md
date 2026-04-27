# RALPLAN: `<MiniMap />` for `@anaralabs/lector`

**Status**: Planner v2 (post-Architect revision) — Critic approved
**Target package**: `packages/lector` (`@anaralabs/lector`)
**Date**: 2026-04-26

### Revision log
- **v1**: Initial Planner draft.
- **v2** (this version): Architect feedback applied:
  1. Removed `scrollOffset`/`setScrollOffset` from `PDFState`. `useMiniMap` now reads `virtualizer.scrollOffset` via a local `requestAnimationFrame` loop with skip-frame-on-no-change. Eliminates re-render-storm risk for unrelated store consumers.
  2. Removed `pages.tsx` from "Modified files" — no `<Pages>` change needed.
  3. Deleted the approximate `ratio = scrollOffset / totalSize` mapping. Forward and inverse mappings are both per-page exact (binary search over virtualizer item starts). Eliminates visible drift on mixed-orientation docs.
  4. Documented that `usePdfJump.jumpToPage`'s `pageIndex` parameter is actually 1-based.
  5. Added explicit "safe empty state when virtualizer is null" contract to `useMiniMap` hook signature.
  6. Refined Principle 3 wording to allow local high-frequency tracking while still discouraging parallel store mutations.
  7. Updated Risk #3 to reflect new rAF-leak risk class (small) instead of obsolete store-storm risk.
  8. Renumbered implementation tasks (was 8 tasks, now 7 — removed obsolete store-delta task).

---

## 1. RALPLAN-DR Summary

### Principles
1. **Headless first.** Component ships zero opinionated styles. Consumer controls width, gap, container CSS, scrubber appearance.
2. **No main-thread jank on long docs.** A 200-page doc must render the minimap in < 16 ms per frame and scroll without dropping frames. This rules out rendering 200 real PDF page bitmaps simultaneously.
3. **Reuse the store for canonical state; keep high-frequency derived values local.** Build on the existing Zustand store (`coloredHighlights`, `viewports`, `virtualizer`, `currentPage`) and `usePdfJump`. *Do* read the virtualizer instance from the store. Do *not* promote 60 Hz scroll offset into the shared store — that creates re-render coupling for all current and future store consumers. Track scroll offset locally in `useMiniMap` via a `requestAnimationFrame` read of `virtualizer.scrollOffset`.
4. **Tree-shakeable + bundle-disciplined.** Component must be importable in isolation; the package must stay under the 150 kB size-limit budget. Net delta target: ≤ 4 kB minified.
5. **SSR-safe.** All `window` / `ResizeObserver` / DOM access guarded by `useLayoutEffect` or runtime `typeof` checks. Module top-level must be import-side-effect-free.
6. **Coexists with `<Thumbnails>`.** This is an additional primitive, not a replacement. Different ergonomics: `<Thumbnails>` = full-fidelity navigator pane; `<MiniMap>` = compact glanceable overview + scrubber.

### Decision Drivers (top 3)
1. **Perceived performance on 100–500 page docs** (primary user is a researcher reviewing systematic reviews, RoB 2 assessments, multi-trial meta-analyses)
2. **Bundle size budget** — net delta must stay well inside the 150 kB ceiling; a thumbnail-rendering minimap would blow the budget on memory + CPU even if not on bytes
3. **API ergonomics** — must compose like the rest of lector (`<Root><MiniMap><Page>{...}</Page></MiniMap></Root>`-style or simpler), with a children render-prop pattern for the page representation

### Viable Options

#### Option A — DOM-only proportional rectangles + colored highlight overlays (RECOMMENDED)
Each page is a plain `<div>` sized proportionally to its `viewport.width × viewport.height`. Highlights are absolutely-positioned colored bars derived from `coloredHighlight.rectangles[].top/height` (already in pixels or percent of page). Current viewport is a translucent overlay rectangle whose `transform: translateY(...)` is bound to `virtualizer.scrollOffset` mapped onto the minimap coordinate space.

| Pros | Cons |
|------|------|
| **Zero PDF rendering** — handles 1000-page docs trivially | No page preview content (just shape + highlights) |
| Bundle delta ~1.5–2 kB (no canvas, no PDF.js usage) | Less visually rich than canvas thumbnails |
| Pure layout — no render task cancellation, no Safari canvas-memory limits | If consumer wants page previews they have to layer `<Thumbnails>` instead |
| Highlight positions mathematically exact (same `HighlightRect` data) | |
| Works during SSR with zero special handling | |

**Bundle impact**: ~1.5 kB minified component + ~0.5 kB hook. ✅ Well within 4 kB target.
**Perf**: O(numPages + numHighlights) single layout pass. No raster work. ✅

#### Option B — Canvas thumbnails reused from `useThumbnail`
Run `useThumbnail` on every page at very small `maxWidth` (e.g., 60 px), render the bitmaps into the minimap, overlay highlight pills.

| Pros | Cons |
|------|------|
| Visually richer — see page content | Creates N render tasks; for a 200-page doc, overwhelms PDF.js worker even at small scale |
| Reuses existing hook | Each canvas has memory cost; iOS Safari 384 MB ceiling becomes a real risk |
| | Still needs DOM overlay layer for highlights anyway (so doesn't simplify code) |
| | Bundle neutral but **runtime cost** is the killer |
| | First-paint latency on long docs becomes seconds |

**Verdict**: Rejected. The existing `<Thumbnails>` already exists for users who want canvas-backed previews. Forcing canvas into a minimap defeats the "glanceable overview" purpose.

#### Option C — Single SVG rendering all pages + highlights
One `<svg>` element for the entire minimap; pages are `<rect>`s, highlights are `<rect>`s, viewport is a `<rect>` with `<animate>` (or `transform`) for scrub.

| Pros | Cons |
|------|------|
| Single DOM node — minimal layout cost | SVG event handling for click-to-jump-on-pill is fiddlier than DOM |
| Crisp at any zoom | Headless styling story weaker (consumers can't easily restyle SVG with className/CSS-in-JS) |
| | No real perf advantage vs. Option A at this scale |

**Verdict**: Reasonable alternative but loses on the "headless-first / consumer styling" principle. Option A wins on ergonomics.

### Recommendation
**Option A — DOM-only proportional rectangles + colored highlight overlays.** It's the only option that satisfies all three top decision drivers (perf, bundle, ergonomics) without compromise. Option B is the obvious "fancy" choice but fails the perf driver on long docs (lector's main differentiator). Option C trades nothing for nothing and complicates styling.

---

## 2. Public API

### New exports (added to `packages/lector/src/index.ts`)

```ts
export { MiniMap, MiniMapPage, MiniMapHighlight, MiniMapViewport } from "./components/minimap";
export { useMiniMap } from "./hooks/useMiniMap";
export type { MiniMapProps } from "./components/minimap";
```

### Component signatures

```tsx
type MiniMapProps = HTMLProps<HTMLDivElement> & {
  /** Width of the minimap in pixels. Default: 80. Pages are sized proportionally. */
  width?: number;
  /** Vertical gap between pages in px. Default: 2. */
  gap?: number;
  /** When true, dragging the viewport overlay scrubs the main scroll position. Default: true. */
  draggable?: boolean;
  /** Callback fired when a highlight pill is clicked. */
  onHighlightClick?: (highlight: ColoredHighlight) => void;
  /**
   * Optional render-prop override for an individual page representation.
   * Receives pageNumber + width/height + this page's highlights.
   * If omitted, default rendering uses MiniMapPage + MiniMapHighlight.
   */
  renderPage?: (args: {
    pageNumber: number;
    width: number;
    height: number;
    highlights: ColoredHighlight[];
  }) => ReactNode;
  /**
   * Optional render-prop override for the viewport-position scrubber.
   * Receives top + height in minimap-pixel coordinates.
   */
  renderViewport?: (args: { top: number; height: number }) => ReactNode;
};

// Sub-components (used by default render or available standalone)
const MiniMapPage: FC<{ pageNumber: number; width: number; height: number; children?: ReactNode }>;
const MiniMapHighlight: FC<{ highlight: ColoredHighlight; pageWidth: number; pageHeight: number }>;
const MiniMapViewport: FC<{ top: number; height: number }>;
```

### Hook signature

```ts
function useMiniMap(opts?: { width?: number; gap?: number }): {
  /** Per-page layout in minimap pixel coordinates. Empty array when virtualizer is null. */
  pages: Array<{ pageNumber: number; top: number; width: number; height: number }>;
  /** Total minimap height in px. 0 when virtualizer is null. */
  totalHeight: number;
  /** Current viewport overlay position in minimap coordinates. { top: 0, height: 0 } when virtualizer is null. */
  viewport: { top: number; height: number };
  /** Map a minimap-Y coordinate back to a virtualizer scrollOffset. Returns 0 when virtualizer is null. */
  scrollOffsetForMinimapY: (minimapY: number) => number;
  /** Inverse: map a virtualizer scrollOffset to a minimap-Y coordinate. Returns 0 when virtualizer is null. */
  minimapYForScrollOffset: (scrollOffset: number) => number;
};

/**
 * SSR / pre-mount safety: when `virtualizer` is null (server, or before <Pages>
 * has mounted and called setVirtualizer), useMiniMap returns the safe empty
 * state above. No DOM access, no useLayoutEffect runs in that path.
 */
```

### Usage example

```tsx
<Root source="/paper.pdf" className="grid grid-cols-[1fr_80px] h-screen">
  <Pages>
    <Page>
      <CanvasLayer />
      <TextLayer />
      <ColoredHighlightLayer />
    </Page>
  </Pages>
  <MiniMap
    width={80}
    gap={2}
    style={{ borderLeft: "1px solid #e5e7eb", overflowY: "auto" }}
    onHighlightClick={(h) => console.log("clicked highlight", h.uuid)}
  />
</Root>
```

Power-user composition with render props:

```tsx
<MiniMap width={100}>
  {/* implicit defaults */}
</MiniMap>

<MiniMap
  renderPage={({ pageNumber, width, height, highlights }) => (
    <div data-page={pageNumber} style={{ width, height, background: "#fafafa" }}>
      {highlights.map((h) => (
        <MiniMapHighlight key={h.uuid} highlight={h} pageWidth={width} pageHeight={height} />
      ))}
    </div>
  )}
  renderViewport={({ top, height }) => (
    <div style={{ position: "absolute", top, height, width: "100%", background: "rgba(59,130,246,0.18)" }} />
  )}
/>
```

---

## 3. Internal Architecture

### New files
| Path | Purpose |
|------|---------|
| `packages/lector/src/components/minimap/index.ts` | Barrel export |
| `packages/lector/src/components/minimap/minimap.tsx` | `<MiniMap />` main component |
| `packages/lector/src/components/minimap/minimap-page.tsx` | Default page-cell renderer |
| `packages/lector/src/components/minimap/minimap-highlight.tsx` | Default highlight pill renderer |
| `packages/lector/src/components/minimap/minimap-viewport.tsx` | Default scrubber overlay |
| `packages/lector/src/hooks/useMiniMap.tsx` | Layout math + scroll-offset bridging |

### Modified files
| Path | Change |
|------|--------|
| `packages/lector/src/index.ts` | Add the new exports listed above |

**No store changes. No `pages.tsx` changes.** (See "Scroll-offset subscription" below for rationale.)

### Scroll-offset subscription (revised per Architect feedback)
The earlier draft proposed adding a `scrollOffset: number` slot to `PDFState` updated on every scroll frame. That promotes a 60 Hz value into a shared store that is otherwise quiescent during scroll (`currentPage` only updates on page-boundary crossings via `useVisiblePage`). Promoting it would:
- Create a new re-render-storm vector for *any* future store consumer that selects a broad slice
- Couple all current store consumers to scroll frequency by latent risk
- Provide no benefit to consumers other than the minimap

**Revised approach**: `useMiniMap` reads `virtualizer.scrollOffset` imperatively inside a `requestAnimationFrame` loop, storing the latest value in hook-local `useState`. The hook re-renders only when the value actually changes (referential equality on the number).

```ts
// Inside useMiniMap (sketch — NOT the full implementation):
const virtualizer = usePdf((s) => s.virtualizer);
const [scrollOffset, setScrollOffset] = useState(0);

useEffect(() => {
  if (!virtualizer) return;
  let rafId: number;
  let last = -1;
  const tick = () => {
    const next = virtualizer.scrollOffset ?? 0;
    if (next !== last) {
      last = next;
      setScrollOffset(next);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}, [virtualizer]);
```

This:
- Keeps the high-frequency value local to the consuming hook (Architect-recommended)
- Re-renders only when the rounded value changes (skips frames where `scrollOffset` is unchanged)
- Costs one rAF tick per frame *only while a `<MiniMap />` is mounted*; unmounted = zero cost
- Does not touch `pages.tsx`, `internal.ts`, or any other consumer
- Naturally pauses with the browser's rAF scheduler when the tab is backgrounded

### Layout math (`useMiniMap`)

Given `viewports[i] = { width, height }` (true page sizes in PDF.js units):

1. **Compute per-page minimap height** preserving aspect ratio at the configured minimap `width`:
   ```
   pageWidth_i  = width                              // all pages occupy minimap width
   pageHeight_i = (viewports[i].height / viewports[i].width) * width
   top_i        = sum(pageHeight_0..pageHeight_{i-1}) + i * gap
   totalHeight  = top_{last} + pageHeight_{last}
   ```
   Handles mixed page sizes correctly.

2. **Map viewport scrollOffset → minimap Y (per-page interpolation, exact).** The virtualizer's coordinate space is the *real* (zoomed) page heights. The minimap is in *minimap* coordinates. A globally-linear `ratio = scrollOffset / totalSize` mapping is **rejected** — it produces visible error on mixed-orientation docs (e.g., a single landscape page among portrait pages). Use exact per-page interpolation:

   - Binary-search the virtualizer's measured item starts (or compute on the fly from `viewports[i].height * zoom`) to find which page index `i` the current `scrollOffset` falls in
   - Compute the fractional offset within page `i`: `frac = (scrollOffset - realPageStart_i) / realPageHeight_i`
   - Map to minimap: `viewport.top = pages[i].top + frac * pages[i].height`
   - `viewport.height = (virtualizer.scrollElement.clientHeight / realPageHeight_i) * pages[i].height` (clamped, may span across mini-pages on small viewports — handle by computing top + bottom independently and using their delta)

   **Worked example for the multi-page viewport span case.** The viewport often shows parts of multiple pages at once (e.g., bottom of page 3 + all of page 4 + top of page 5). Algorithm:
   ```
   viewportTopPx    = scrollOffset
   viewportBottomPx = scrollOffset + virtualizer.scrollElement.clientHeight

   minimapTop    = forwardMap(viewportTopPx)     // per-page interpolation, returns minimap Y
   minimapBottom = forwardMap(viewportBottomPx)  // per-page interpolation, returns minimap Y

   viewport = { top: minimapTop, height: minimapBottom - minimapTop }
   ```
   This works correctly whether the viewport sits entirely within one page or straddles 2+ pages. Each call to `forwardMap` does the same per-page binary search described above. Cost: 2 × O(log N) per scroll frame.

3. **Inverse for click/drag (per-page, exact).** Given a minimap Y:
   - Binary-search `pages[]` to find which minimap page index `i` the Y falls in
   - Compute fractional position within that page in minimap coords: `frac = (minimapY - pages[i].top) / pages[i].height`
   - Multiply by the *real* page height for page `i` to get an offset within the real page
   - Add the virtualizer-reported offset for page `i` (via `virtualizer.getOffsetForIndex(i, "start")`) → final `scrollOffset`
   - Pass to `virtualizer.scrollToOffset(offset, { align: "start", behavior: "auto" })` directly during drag, or to `usePdfJump.jumpToOffset(offset)` for click-to-jump (smooth)

Both forward and inverse use the same per-page logic, so they are mathematically inverses (test G in §5 verifies this).

### Highlight overlay positioning
Each `ColoredHighlight` has `rectangles: HighlightRect[]` with either `type: "pixels"` or `type: "percent"`. For each rect:

```
if (rect.type === "percent") {
  topPx_minimap    = (rect.top    / 100) * pageHeight_minimap
  heightPx_minimap = (rect.height / 100) * pageHeight_minimap
} else {
  // pixels — relative to true page size, so scale into minimap coords
  topPx_minimap    = (rect.top    / viewports[i].height) * pageHeight_minimap
  heightPx_minimap = (rect.height / viewports[i].height) * pageHeight_minimap
}
```

Width is the full minimap page width (visually a horizontal pill). For very thin highlights (< 2 px in minimap coords) clamp to 2 px so they remain visible.

### Drag-scrub interaction
- `onPointerDown` on the viewport overlay sets a "dragging" flag in component-local state and captures the pointer (`event.currentTarget.setPointerCapture`).
- `onPointerMove` while dragging: compute new `minimapY = event.clientY - container.getBoundingClientRect().top - grabOffset`; convert to scrollOffset via `scrollOffsetForMinimapY`; call `virtualizer.scrollToOffset(offset, { align: "start", behavior: "auto" })`. Use `auto` not `smooth` during drag — smooth fights the pointer.
- `onPointerUp` releases capture and clears the flag.
- During drag, set `isPinching: true` analog? **No** — `isPinching` is a different concept. Just use local state.

### Click-to-jump
- Page click → `jumpToPage(pageNumber, { align: "start" })`
  - **Note for implementer**: `usePdfJump.jumpToPage`'s parameter is named `pageIndex` in the source, but it's actually a **1-based page number** (the implementation does `scrollToIndex(pageIndex - 1)`). Pass the 1-based number; do not subtract 1.
- Highlight pill click → `jumpToHighlightRects(highlight.rectangles, type, "center")` then `onHighlightClick(highlight)`
  - The `type` argument here is the per-rect `HighlightRect.type` (`"pixels" | "percent"`); since highlights from `<ColoredHighlightLayer>` are stored as a `ColoredHighlight.rectangles[]` with possibly mixed types, use the type of the first rect (the implementation in `usePdfJump.jumpToHighlightRects` only inspects the first rect for positioning anyway).
- `event.stopPropagation()` on highlight click so it doesn't also trigger the page-click

---

## 4. Step-by-step implementation plan

Each task is sized for one commit. Verification listed for each.

| # | Task | Files | Verify |
|---|------|-------|--------|
| 1 | Create `useMiniMap` hook: layout math (per-page sizes, totalHeight, exact per-page forward + inverse mapping) **plus** local rAF subscription to `virtualizer.scrollOffset` with skip-frame-on-no-change, plus null-virtualizer safe empty state | `hooks/useMiniMap.tsx` | Vitest browser tests: (a) layout math on mixed-aspect viewports; (b) forward∘inverse ≈ identity; (c) returns safe empty state when virtualizer is null; (d) rAF tick updates state when scrollOffset changes and skips when it doesn't |
| 2 | Implement `<MiniMapPage>`, `<MiniMapHighlight>`, `<MiniMapViewport>` default sub-components (pure presentational divs) | `components/minimap/minimap-{page,highlight,viewport}.tsx` | Vitest: render in isolation, assert correct width/height/top styles for both `percent` and `pixels` highlight types |
| 3 | Implement `<MiniMap>` orchestrator: composes hook + sub-components, handles render-prop overrides, click handlers | `components/minimap/minimap.tsx` | Vitest: render inside a mock `<Root>` (using a stub `PDFStore.Provider`); assert N pages render, assert click on page i calls `jumpToPage(i)` with 1-based page number |
| 4 | Implement drag-scrub on viewport overlay (pointer capture + per-page inverse offset math + rAF throttle inside `pointermove`) | `components/minimap/minimap.tsx` | Vitest: simulate pointerdown/move/up; assert `virtualizer.scrollToOffset` is called with the per-page-interpolated offset; assert clamping at top/bottom; assert pointer capture is released on `pointerup` and on unmount |
| 5 | Add public exports + barrel | `index.ts`, `components/minimap/index.ts` | `pnpm build` succeeds; `dist/index.d.ts` includes `MiniMap`, `MiniMapPage`, `MiniMapHighlight`, `MiniMapViewport`, `useMiniMap`, `MiniMapProps` |
| 6 | Add docs page in `packages/docs` (MDX) with live example | `packages/docs/content/docs/components/minimap.mdx` (or matching path), example app update | `pnpm dev` from docs runs without errors; minimap visible & functional in browser |
| 7 | Verify bundle size | — | `pnpm test:size` from `packages/lector`: total ≤ 150 kB; record delta vs. baseline; fail if delta > 4 kB |

Suggested commit messages (conventional commits per repo policy):
- `feat: add useMiniMap layout + scroll subscription hook`
- `feat: add MiniMapPage / MiniMapHighlight / MiniMapViewport primitives`
- `feat: add MiniMap component with click-to-jump`
- `feat: add MiniMap drag-scrub interaction`
- `feat: export MiniMap from public API`
- `doc: add MiniMap component docs`

---

## 5. Testable acceptance criteria

A. **Renders all pages.** Given an N-page PDF, `<MiniMap />` renders exactly N page cells in document order. ✓ verifiable via Vitest count assertion.

B. **Proportional sizing.** Mixed-aspect-ratio pages (e.g., portrait + landscape mixed) render at correct proportional heights given a fixed minimap width. ✓ verifiable via computed style assertions.

C. **Highlight overlays positioned correctly.** A highlight at percent `{top:50, height:5}` on page 3 renders at exactly the geometric center band of minimap page 3. ✓ verifiable via getBoundingClientRect math.

D. **Click on page jumps.** Clicking minimap page i scrolls the main viewport so that the top of real page i is at the top of the viewport. ✓ verifiable via Vitest mock + `scrollToIndex` call assertion; manual via example app.

E. **Click on highlight jumps to highlight.** Clicking a highlight pill scrolls the main viewport so the highlight is centered (or at least visible). Fires `onHighlightClick`. ✓ verifiable via mock + assertion.

F. **Viewport overlay tracks scroll.** Scrolling the main `<Pages>` viewport updates the minimap overlay position within the next animation frame. ✓ verifiable via scrollOffset state + style assertion.

G. **Drag scrubs.** Pointer-down + drag on the overlay smoothly scrolls the main viewport in proportion. Pointer-up cleanly ends the interaction. ✓ verifiable via simulated events.

H. **SSR import doesn't crash.** `import { MiniMap } from "@anaralabs/lector"` evaluated in a Node environment must not throw. ✓ verifiable via a Node-only import smoke test.

I. **Bundle delta ≤ 4 kB.** `pnpm test:size` after the change vs. before shows delta within budget. Total stays ≤ 150 kB. ✓ verifiable via size-limit JSON output diff.

J. **No render of canvas thumbnails.** No PDF.js `getDocument`/page-render calls happen as a result of mounting the minimap on a 200-page doc. ✓ verifiable via spying `pdfPageProxy.render` is not invoked.

K. **Coexists with `<Thumbnails>`.** Mounting both side-by-side does not double-render thumbnails or interfere with scroll. ✓ verifiable manually in example app.

---

## 6. Test plan

### Unit (Vitest browser-mode, Chrome via webdriverio)

| File | Tests |
|------|-------|
| `hooks/useMiniMap.test.tsx` | (a) layout math: portrait-only / landscape-only / mixed sizes; (b) viewport→minimap mapping at 0%, 50%, 100% scrollOffset; (c) inverse mapping is the true inverse of the forward mapping; (d) handles 0 pages gracefully (returns empty arrays, totalHeight 0) |
| `components/minimap/minimap.test.tsx` | (a) renders N page cells; (b) renders highlights at expected positions; (c) page click invokes virtualizer.scrollToIndex with right index; (d) highlight click invokes scrollToHighlightRects + onHighlightClick; (e) viewport overlay style updates when scrollOffset changes; (f) renderPage / renderViewport overrides take effect |
| `components/minimap/minimap-drag.test.tsx` | (a) pointerdown → captures pointer; (b) pointermove → scrollToOffset called with linear interpolation; (c) pointerup → no further updates; (d) drag past top clamps to 0; (e) drag past bottom clamps to maxOffset |
| `components/minimap/ssr.test.ts` | Import the module in a `vi.mock`'d Node env without DOM globals; assert no throw |

Mocks needed: a mock `PDFStore.Provider` factory that takes `{ viewports, numPages, virtualizer, scrollOffset, coloredHighlights }` and returns a wrapped tree.

### Manual

1. **Long doc test**: load a 200+ page PDF (e.g., a Cochrane review or a textbook). Confirm minimap renders in < 100 ms after document ready. Scroll — overlay tracks. Drag — smooth.
2. **Mixed orientation test**: a PDF with mixed portrait/landscape pages. Confirm minimap pages have visibly different aspect ratios.
3. **Highlight density test**: open a paper, color-highlight 30+ passages across 10 pages with 3 different colors. Confirm pills render at correct positions and clicking a pill jumps + invokes the callback.
4. **Side-by-side with Thumbnails test**: render `<Thumbnails>` and `<MiniMap>` simultaneously. Confirm both work, no double-render, no scroll fight.
5. **Mobile/touch test**: drag-scrub via touch. Pointer events should handle this; verify on iOS Safari (relevant per the existing Safari memory note in `useThumbnail`).

### Bundle size

Run `pnpm test:size` from `packages/lector` before and after the change:
```
Before: <baseline>
After:  <new value>  (delta: +X.X kB)
Limit:  150 kB
```
Fail the PR if delta > 4 kB or total > 150 kB.

---

## 7. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | **Drag handler fights virtualizer's smooth scroll** — concurrent `scrollToOffset({ behavior: "smooth" })` calls during `pointermove` can produce stuttery movement | Medium | Medium | Use `behavior: "auto"` during drag; only restore smooth on click-to-jump. Throttle `pointermove` handler to one update per `requestAnimationFrame`. |
| 2 | **Highlight Y math wrong for rotated pages** — `viewports[i]` includes rotation; `top` may be measured in pre- or post-rotation coords depending on consumer. | Medium | High (silent visual bug) | Always compute `pageHeight_minimap` from `viewports[i].height` (which is post-rotation per `usePDFDocumentContext`). Add a rotated-PDF test fixture in step 3. |
| 3 | **rAF subscription leaks if `useMiniMap` consumer remounts under StrictMode or fast prop changes** — `useEffect` cleanup must reliably `cancelAnimationFrame`. | Low | Low | Cleanup function in the rAF effect always cancels. Vitest test (task 1d) explicitly mounts → triggers scroll → unmounts → asserts no further `setState` warnings. Tested under React StrictMode in the example app. |
| 4 | **Pointer capture not released on unexpected unmount mid-drag** | Low | Low | Cleanup in `useEffect` return / `onLostPointerCapture` handler. |
| 5 | **Mixed `pixels` and `percent` highlight coords from different consumers** | Low | Medium | Handle both branches in `MiniMapHighlight` with a `viewports[i]` reference for the pixels branch. Unit-tested in step 3. |

---

## 8. Out of scope (explicitly)

- Rendering page bitmap previews inside minimap pages (use `<Thumbnails>` for that — different primitive)
- Hover tooltips on highlights (consumer can build via `onHighlightClick` + their own `onMouseEnter`)
- Annotation (non-colored) overlay on minimap (could be future work; current scope is `coloredHighlights` only because they're the user's review/extraction primitive)
- Search-result overlays on minimap (future; would follow the same pattern using `useSearch` results)
- Horizontal minimap orientation (minimap is vertical-only in v1)

---

## 9. ADR (Architecture Decision Record)

- **Decision**: Build `<MiniMap />` as a DOM-only proportional-rectangle minimap with colored-highlight overlays and a draggable viewport scrubber. Track scroll offset locally in `useMiniMap` via a `requestAnimationFrame` loop reading `virtualizer.scrollOffset` (no shared-store mutation). No new dependencies. No changes to `internal.ts` or `pages.tsx`.
- **Drivers**: Perf on long docs (top), bundle budget, API ergonomics consistent with existing headless primitives, no global re-render coupling.
- **Alternatives considered**:
  - Canvas thumbnails (rejected: runtime cost on 200+ page docs)
  - SVG-based minimap (rejected: weaker styling story, no real perf win)
  - Promote `scrollOffset` to `PDFStore` (rejected per Architect: creates 60 Hz re-render coupling for all current and future store consumers)
  - Globally-linear forward/inverse scroll-offset mapping (rejected per Architect: visibly wrong on mixed-orientation docs)
- **Why chosen**: Only option that satisfies all top-3 drivers without compromise.
- **Consequences**:
  - (+) Trivially handles arbitrary doc lengths
  - (+) Composes with existing `coloredHighlights` workflow with zero data plumbing
  - (–) No page preview content — consumers wanting that must layer `<Thumbnails>` separately or write a custom `renderPage`
  - (+) Bundle delta projected ≤ 4 kB
- **Follow-ups**:
  - V2: search-result overlays on minimap
  - V2: optional small thumbnail-cell variant via `renderPage` example in docs (consumer opt-in to the perf cost)
  - V2: keyboard navigation on minimap (PageUp/PageDown maps to overlay step)
