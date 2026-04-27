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
 * Falls back to 0 if the virtualizer cannot resolve the offset.
 */
const realStartOf = (virtualizer: PDFVirtualizer, index: number): number => {
	const offset = virtualizer.getOffsetForIndex(index, "start");
	if (offset == null) return 0;
	// getOffsetForIndex returns [scrollOffset, alignment] | null
	return offset[0] ?? 0;
};

const realHeightOf = (virtualizer: PDFVirtualizer, index: number): number => {
	// The virtualizer's per-item size is what it actually uses for layout;
	// using estimateSize avoids needing to walk getVirtualItems().
	return virtualizer.options.estimateSize(index);
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
			const nextOffset = virtualizer.scrollOffset ?? 0;
			const nextClientHeight = virtualizer.scrollElement?.clientHeight ?? 0;

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
	// against viewports/width/gap only).
	const pages = useMemo<MiniMapPageLayout[]>(() => {
		if (!virtualizer || viewports.length === 0) return EMPTY_PAGES;

		const result: MiniMapPageLayout[] = new Array(viewports.length);
		let cursor = 0;
		for (let i = 0; i < viewports.length; i += 1) {
			const vp = viewports[i];
			if (!vp || vp.width === 0) {
				result[i] = { pageNumber: i + 1, top: cursor, width, height: 0 };
				continue;
			}
			const pageHeight = (vp.height / vp.width) * width;
			result[i] = {
				pageNumber: i + 1,
				top: cursor,
				width,
				height: pageHeight,
			};
			cursor += pageHeight + gap;
		}
		return result;
	}, [virtualizer, viewports, width, gap]);

	const totalHeight = useMemo(() => {
		if (pages.length === 0) return 0;
		const last = pages[pages.length - 1]!;
		return last.top + last.height;
	}, [pages]);

	// Forward map: real (virtualizer) scrollOffset -> minimap Y.
	// Per-page exact interpolation, NOT a global ratio (plan §3 item 2).
	const forwardMap = useCallback(
		(offset: number): number => {
			if (!virtualizer || pages.length === 0) return 0;
			if (offset <= 0) return 0;

			// Linear scan of N pages is fine for the projected page counts; the
			// alternative (binary search over getOffsetForIndex) costs the same
			// O(log N) virtualizer calls and is harder to read. Profiled: the
			// rAF tick stays well under a frame budget at N=500.
			for (let i = 0; i < pages.length; i += 1) {
				const realStart = realStartOf(virtualizer, i);
				const realHeight = realHeightOf(virtualizer, i);
				const realEnd = realStart + realHeight;
				if (offset < realEnd) {
					const frac = realHeight > 0 ? (offset - realStart) / realHeight : 0;
					return pages[i]!.top + frac * pages[i]!.height;
				}
			}
			// Past the last page — clamp to totalHeight.
			return totalHeight;
		},
		[virtualizer, pages, totalHeight],
	);

	// Inverse map: minimap Y -> real (virtualizer) scrollOffset.
	const inverseMap = useCallback(
		(minimapY: number): number => {
			if (!virtualizer || pages.length === 0) return 0;
			if (minimapY <= 0) return 0;

			for (let i = 0; i < pages.length; i += 1) {
				const page = pages[i]!;
				const pageEnd = page.top + page.height;
				if (minimapY < pageEnd) {
					const frac =
						page.height > 0 ? (minimapY - page.top) / page.height : 0;
					const realStart = realStartOf(virtualizer, i);
					const realHeight = realHeightOf(virtualizer, i);
					return realStart + frac * realHeight;
				}
			}
			// Past the last page — clamp to the end of the last real page.
			const lastIndex = pages.length - 1;
			return (
				realStartOf(virtualizer, lastIndex) +
				realHeightOf(virtualizer, lastIndex)
			);
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
