import { useCallback, useEffect, useMemo, useState } from "react";

import { type PDFVirtualizer, usePdf } from "../internal";

interface UseMiniMapOptions {
	/** Width of the minimap in pixels. Default: 80. */
	width?: number;
	/** Vertical gap between pages in px. Default: 2. */
	gap?: number;
}

export interface MiniMapPageLayout {
	pageNumber: number;
	top: number;
	width: number;
	height: number;
}

export interface MiniMapViewportRect {
	top: number;
	height: number;
}

export interface UseMiniMapResult {
	pages: MiniMapPageLayout[];
	totalHeight: number;
	viewport: MiniMapViewportRect;
	scrollOffsetForMinimapY: (minimapY: number) => number;
	minimapYForScrollOffset: (scrollOffset: number) => number;
}

const DEFAULT_WIDTH = 80;
const DEFAULT_GAP = 2;

const EMPTY_PAGES: MiniMapPageLayout[] = [];
const EMPTY_VIEWPORT: MiniMapViewportRect = { top: 0, height: 0 };
const ZERO_FN = () => 0;
const EMPTY_RESULT: UseMiniMapResult = {
	pages: EMPTY_PAGES,
	totalHeight: 0,
	viewport: EMPTY_VIEWPORT,
	scrollOffsetForMinimapY: ZERO_FN,
	minimapYForScrollOffset: ZERO_FN,
};

/**
 * Read the real (zoomed) start offset of page `index` from the virtualizer.
 * Returns null when the virtualizer cannot resolve the offset yet (e.g. during
 * init). Callers must propagate null as a "not ready, return safe value"
 * signal — never silently fabricate a page start.
 */
const realStartOf = (
	virtualizer: PDFVirtualizer,
	index: number,
): number | null => {
	const offset = virtualizer.getOffsetForIndex(index, "start");
	if (offset == null) return null;
	const start = offset[0];
	return start == null ? null : start;
};

const realHeightOf = (virtualizer: PDFVirtualizer, index: number): number => {
	// estimateSize is the per-item size the virtualizer uses for layout.
	return virtualizer.options.estimateSize(index);
};

interface RealPageInfo {
	start: number;
	bodyEnd: number;
	slotEnd: number; // = realStartOf(i+1) for i<N-1, else bodyEnd
	realGap: number; // slotEnd - bodyEnd; 0 for last page
}

/**
 * Real-coordinate slot bounds for page `i`. The slot includes the page body
 * and the trailing real-gap (the space the virtualizer reserves between this
 * page and the next). Returns null if any required offset is unresolved.
 */
const realPageInfo = (
	virtualizer: PDFVirtualizer,
	index: number,
	pageCount: number,
): RealPageInfo | null => {
	const start = realStartOf(virtualizer, index);
	if (start == null) return null;
	const bodyEnd = start + realHeightOf(virtualizer, index);
	if (index === pageCount - 1) {
		return { start, bodyEnd, slotEnd: bodyEnd, realGap: 0 };
	}
	const nextStart = realStartOf(virtualizer, index + 1);
	if (nextStart == null) return null;
	const slotEnd = Math.max(bodyEnd, nextStart);
	return { start, bodyEnd, slotEnd, realGap: slotEnd - bodyEnd };
};

interface MiniMapPageInfo {
	top: number;
	bodyEnd: number;
	slotEnd: number;
	minimapGap: number;
}

const minimapPageInfo = (
	pages: MiniMapPageLayout[],
	index: number,
): MiniMapPageInfo => {
	const page = pages[index]!;
	const bodyEnd = page.top + page.height;
	if (index === pages.length - 1) {
		return { top: page.top, bodyEnd, slotEnd: bodyEnd, minimapGap: 0 };
	}
	const nextTop = pages[index + 1]!.top;
	const slotEnd = Math.max(bodyEnd, nextTop);
	return { top: page.top, bodyEnd, slotEnd, minimapGap: slotEnd - bodyEnd };
};

/**
 * Layout math + scroll-offset bridging for the MiniMap component.
 *
 * SSR / pre-mount safety: when `virtualizer` is null (server, or before
 * <Pages> has mounted and called setVirtualizer), this returns the safe
 * empty result with no DOM access and no rAF scheduled.
 */
export const useMiniMap = (opts?: UseMiniMapOptions): UseMiniMapResult => {
	const width = opts?.width ?? DEFAULT_WIDTH;
	const gap = opts?.gap ?? DEFAULT_GAP;

	const virtualizer = usePdf((s) => s.virtualizer);
	const viewports = usePdf((s) => s.viewports);

	const [scrollOffset, setScrollOffset] = useState(0);
	const [clientHeight, setClientHeight] = useState(0);

	// Track virtualizer.scrollOffset locally via rAF, only re-rendering on
	// actual change (skip-frame-on-no-change). The high-frequency value is
	// kept out of the shared store on purpose — see plan §3.
	useEffect(() => {
		if (!virtualizer) return;

		let rafId = 0;
		let lastOffset = Number.NaN;
		let lastClientHeight = Number.NaN;

		const tick = () => {
			// Normalize NaN/Infinity/null to 0 — without this, `NaN !== NaN` would
			// defeat the skip-frame guard and call setState every frame if the
			// virtualizer ever reported NaN for either value (defensive).
			// Note: `Number.isFinite` is not a TypeScript type guard, so we use
			// `??` first to rule out null/undefined, then `Number.isFinite` to
			// rule out NaN/Infinity.
			const rawOffset: number = virtualizer.scrollOffset ?? 0;
			const nextOffset = Number.isFinite(rawOffset) ? rawOffset : 0;
			const rawClientHeight: number =
				virtualizer.scrollElement?.clientHeight ?? 0;
			const nextClientHeight = Number.isFinite(rawClientHeight)
				? rawClientHeight
				: 0;

			if (nextOffset !== lastOffset) {
				lastOffset = nextOffset;
				setScrollOffset(nextOffset);
			}
			if (nextClientHeight !== lastClientHeight) {
				lastClientHeight = nextClientHeight;
				setClientHeight(nextClientHeight);
			}

			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [virtualizer]);

	// Per-page minimap layout (independent of scrollOffset, so memoized
	// against viewports/width/gap only). Cursor advances by (pageHeight + gap)
	// for every page including zero-width ones — matches the plan's formula
	// `top_i = sum(prior pageHeights) + i*gap`.
	const pages = useMemo<MiniMapPageLayout[]>(() => {
		if (!virtualizer || viewports.length === 0) return EMPTY_PAGES;

		const result: MiniMapPageLayout[] = new Array(viewports.length);
		let cursor = 0;
		for (let i = 0; i < viewports.length; i += 1) {
			const vp = viewports[i];
			const pageHeight =
				vp && vp.width > 0 ? (vp.height / vp.width) * width : 0;
			result[i] = {
				pageNumber: i + 1,
				top: cursor,
				width,
				height: pageHeight,
			};
			cursor += pageHeight + gap;
		}
		// totalHeight excludes the trailing gap after the last page.
		return result;
	}, [virtualizer, viewports, width, gap]);

	const totalHeight = useMemo(() => {
		if (pages.length === 0) return 0;
		const last = pages[pages.length - 1]!;
		return last.top + last.height;
	}, [pages]);

	// Forward map: real (virtualizer) scrollOffset -> minimap Y.
	// Slot-aware: each page has a body sub-slot and a trailing-gap sub-slot.
	// Body↔body and gap↔gap mappings are linear within their sub-slot.
	// forward∘inverse is identity for all Y in body regions, and for Y in
	// gap regions when sign(realGap) === sign(minimapGap). In the asymmetric
	// case (realGap=0, minimapGap>0) the visual minimap-gap has no real-space
	// counterpart, so Y values strictly inside that gap collapse to the body
	// boundary (m.bodyEnd) on round-trip — best achievable given the missing
	// real-space dimension.
	const forwardMap = useCallback(
		(offset: number): number => {
			if (!virtualizer || pages.length === 0) return 0;
			if (offset <= 0) return 0;

			const N = pages.length;
			for (let i = 0; i < N; i += 1) {
				const r = realPageInfo(virtualizer, i, N);
				if (r === null) return 0; // virtualizer not ready — safe value
				const m = minimapPageInfo(pages, i);

				if (offset < r.bodyEnd) {
					// body sub-slot
					const bodyHeight = r.bodyEnd - r.start;
					const frac = bodyHeight > 0 ? (offset - r.start) / bodyHeight : 0;
					const minimapBodyHeight = m.bodyEnd - m.top;
					return m.top + frac * minimapBodyHeight;
				}
				if (i < N - 1 && offset < r.slotEnd) {
					// gap sub-slot (only exists when realGap > 0)
					if (r.realGap === 0) return m.bodyEnd;
					const frac = (offset - r.bodyEnd) / r.realGap;
					return m.bodyEnd + frac * m.minimapGap;
				}
				// Boundary case: offset === r.bodyEnd. With realGap > 0 this is
				// already handled by the gap branch above (offset < r.slotEnd is
				// true). With realGap === 0, r.slotEnd === r.bodyEnd and the gap
				// branch is skipped. Without this clamp, we'd fall through to
				// the next iteration's body branch and return m_{i+1}.top —
				// breaking forward∘inverse identity at the boundary in the
				// asymmetric (realGap=0, minimapGap>0) configuration.
				if (i < N - 1 && offset === r.bodyEnd && r.realGap === 0) {
					return m.bodyEnd;
				}
				// otherwise continue to next page
			}
			// Past all slots — clamp to totalHeight
			return totalHeight;
		},
		[virtualizer, pages, totalHeight],
	);

	// Inverse map: minimap Y -> real (virtualizer) scrollOffset.
	// Symmetric slot-aware logic, the true inverse of forwardMap.
	const inverseMap = useCallback(
		(minimapY: number): number => {
			if (!virtualizer || pages.length === 0) return 0;
			if (minimapY <= 0) return 0;

			const N = pages.length;
			for (let i = 0; i < N; i += 1) {
				const r = realPageInfo(virtualizer, i, N);
				if (r === null) return 0; // virtualizer not ready — safe value
				const m = minimapPageInfo(pages, i);

				if (minimapY < m.bodyEnd) {
					// body sub-slot
					const minimapBodyHeight = m.bodyEnd - m.top;
					const frac =
						minimapBodyHeight > 0 ? (minimapY - m.top) / minimapBodyHeight : 0;
					const realBodyHeight = r.bodyEnd - r.start;
					return r.start + frac * realBodyHeight;
				}
				if (i < N - 1 && minimapY < m.slotEnd) {
					// gap sub-slot
					if (m.minimapGap === 0) return r.bodyEnd;
					const frac = (minimapY - m.bodyEnd) / m.minimapGap;
					return r.bodyEnd + frac * r.realGap;
				}
				// otherwise continue to next page
			}
			// Past all minimap slots — clamp to end of last real page body
			const last = realPageInfo(virtualizer, N - 1, N);
			return last === null ? 0 : last.bodyEnd;
		},
		[virtualizer, pages],
	);

	// Multi-page span case: viewport.height is the delta of forwardMap at
	// scrollOffset and scrollOffset + clientHeight, which correctly handles
	// a viewport that straddles multiple mini-pages (plan §3 worked example).
	const viewport = useMemo<MiniMapViewportRect>(() => {
		if (!virtualizer || pages.length === 0) return EMPTY_VIEWPORT;
		const top = forwardMap(scrollOffset);
		const bottom = forwardMap(scrollOffset + clientHeight);
		return { top, height: Math.max(0, bottom - top) };
	}, [virtualizer, pages, forwardMap, scrollOffset, clientHeight]);

	// Stable empty result when the virtualizer is null — avoids any DOM /
	// rAF code path running during SSR or before <Pages> mounts.
	if (!virtualizer) return EMPTY_RESULT;

	return {
		pages,
		totalHeight,
		viewport,
		scrollOffsetForMinimapY: inverseMap,
		minimapYForScrollOffset: forwardMap,
	};
};
