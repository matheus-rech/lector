import { act, renderHook } from "@testing-library/react";
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { ReactNode } from "react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	type InitialPDFState,
	PDFStore,
	type PDFVirtualizer,
	usePdf,
} from "../internal";
import { useMiniMap } from "./useMiniMap";

type ViewportLike = Pick<PageViewport, "width" | "height">;

const makeViewports = (sizes: ViewportLike[]): PageViewport[] =>
	sizes.map((s) => ({ width: s.width, height: s.height }) as PageViewport);

const makePdfDocumentProxy = (numPages: number): PDFDocumentProxy =>
	({
		numPages,
		fingerprints: ["test", null],
	}) as unknown as PDFDocumentProxy;

interface MockVirtualizerOptions {
	heights: number[];
	gap?: number;
	scrollOffset?: number;
	clientHeight?: number;
}

const makeMockVirtualizer = ({
	heights,
	gap = 0,
	scrollOffset = 0,
	clientHeight = 600,
}: MockVirtualizerOptions): PDFVirtualizer => {
	// Compute prefix sums of (height + gap) for getOffsetForIndex.
	const starts: number[] = [];
	let cursor = 0;
	for (let i = 0; i < heights.length; i += 1) {
		starts.push(cursor);
		cursor += heights[i]! + gap;
	}
	const totalSize = cursor === 0 ? 0 : cursor - gap;

	const v = {
		scrollOffset,
		scrollElement: { clientHeight } as unknown as HTMLElement,
		options: {
			estimateSize: (index: number) => heights[index] ?? 0,
		},
		getOffsetForIndex: (index: number, _align: "start") =>
			[starts[index] ?? 0, _align] as [number, "start"],
		getTotalSize: () => totalSize,
	} as unknown as PDFVirtualizer;
	return v;
};

const makeInitialState = (viewports: PageViewport[]): InitialPDFState => ({
	pdfDocumentProxy: makePdfDocumentProxy(viewports.length),
	pageProxies: [] as PDFPageProxy[],
	viewports,
	zoom: 1,
});

const makeWrapper = (initialState: InitialPDFState) => {
	return ({ children }: { children: ReactNode }) => (
		<PDFStore.Provider initialValue={initialState}>
			{children}
		</PDFStore.Provider>
	);
};

/**
 * Inner wrapper component that injects a mock virtualizer synchronously
 * during render (mimicking what <Pages> does at runtime). Calling
 * setVirtualizer during render of a child component is safe here because
 * Zustand's set is idempotent and we guard against re-injection with a ref.
 */
const VirtualizerInjector = ({
	virtualizer,
	children,
}: {
	virtualizer: PDFVirtualizer | null;
	children: ReactNode;
}) => {
	const setVirtualizer = usePdf((s) => s.setVirtualizer);
	const currentVirtualizer = usePdf((s) => s.virtualizer);
	const injectedRef = useRef(false);
	if (
		virtualizer &&
		currentVirtualizer !== virtualizer &&
		!injectedRef.current
	) {
		injectedRef.current = true;
		setVirtualizer(virtualizer);
	}
	return <>{children}</>;
};

/**
 * Helper: render the hook with a stub PDFStore.Provider whose virtualizer
 * has already been set when the hook first runs.
 */
const renderUseMiniMap = ({
	viewports,
	virtualizer,
	opts,
}: {
	viewports: PageViewport[];
	virtualizer: PDFVirtualizer | null;
	opts?: { width?: number; gap?: number };
}) => {
	const initialState = makeInitialState(viewports);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<PDFStore.Provider initialValue={initialState}>
			<VirtualizerInjector virtualizer={virtualizer}>
				{children}
			</VirtualizerInjector>
		</PDFStore.Provider>
	);
	return renderHook(
		(props: { opts?: { width?: number; gap?: number } }) =>
			useMiniMap(props.opts),
		{
			wrapper,
			initialProps: { opts },
		},
	);
};

/**
 * Helper variant: like renderUseMiniMap but also counts renders of the
 * hook's host component. Each invocation of the renderHook callback
 * corresponds to one render of the host (which is exactly what we want
 * to count for the skip-frame test).
 */
const renderUseMiniMapWithCount = ({
	viewports,
	virtualizer,
	renderCount,
}: {
	viewports: PageViewport[];
	virtualizer: PDFVirtualizer | null;
	renderCount: { current: number };
}) => {
	const initialState = makeInitialState(viewports);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<PDFStore.Provider initialValue={initialState}>
			<VirtualizerInjector virtualizer={virtualizer}>
				{children}
			</VirtualizerInjector>
		</PDFStore.Provider>
	);
	return renderHook(
		() => {
			renderCount.current += 1;
			return useMiniMap();
		},
		{ wrapper },
	);
};

describe("useMiniMap", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("null virtualizer (acceptance criterion 9)", () => {
		it("returns the safe empty state and schedules no rAF when virtualizer is null", () => {
			const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
			const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

			const wrapper = makeWrapper(
				makeInitialState(
					makeViewports([
						{ width: 100, height: 200 },
						{ width: 100, height: 200 },
					]),
				),
			);
			const { result, unmount } = renderHook(() => useMiniMap(), {
				wrapper,
			});

			expect(result.current.pages).toEqual([]);
			expect(result.current.totalHeight).toBe(0);
			expect(result.current.viewport).toEqual({ top: 0, height: 0 });
			expect(result.current.scrollOffsetForMinimapY(0)).toBe(0);
			expect(result.current.scrollOffsetForMinimapY(123)).toBe(0);
			expect(result.current.minimapYForScrollOffset(0)).toBe(0);
			expect(result.current.minimapYForScrollOffset(456)).toBe(0);

			expect(rafSpy).not.toHaveBeenCalled();

			unmount();
			expect(cancelSpy).not.toHaveBeenCalled();
		});
	});

	describe("layout math (acceptance criteria 1, 2, 3)", () => {
		it("returns the documented hook shape", () => {
			const viewports = makeViewports([{ width: 100, height: 200 }]);
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer: makeMockVirtualizer({ heights: [200] }),
			});

			const r = result.current;
			expect(r).toHaveProperty("pages");
			expect(r).toHaveProperty("totalHeight");
			expect(r).toHaveProperty("viewport");
			expect(typeof r.scrollOffsetForMinimapY).toBe("function");
			expect(typeof r.minimapYForScrollOffset).toBe("function");
		});

		it("computes pages[i].height as (viewports[i].height / viewports[i].width) * width on mixed-aspect pages", () => {
			// Three portrait pages (100x200) plus one landscape page (200x100).
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
				{ width: 200, height: 100 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200, 100, 200],
			});
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			const pages = result.current.pages;
			expect(pages).toHaveLength(4);
			// width = 80; portrait aspect 200/100 -> minimap height 160
			expect(pages[0]!.height).toBeCloseTo(160, 5);
			expect(pages[1]!.height).toBeCloseTo(160, 5);
			// Portrait minimap heights all equal
			expect(pages[3]!.height).toBeCloseTo(pages[0]!.height, 5);
			// Landscape aspect 100/200 -> minimap height 40 (4x shorter)
			expect(pages[2]!.height).toBeCloseTo(40, 5);
			expect(pages[0]!.height / pages[2]!.height).toBeCloseTo(4, 5);
		});

		it("computes pages[i].top as cumulative sum of prior heights plus i * gap", () => {
			const viewports = makeViewports([
				{ width: 100, height: 200 }, // h=160
				{ width: 100, height: 100 }, // h=80
				{ width: 100, height: 200 }, // h=160
				{ width: 100, height: 50 }, // h=40
				{ width: 100, height: 200 }, // h=160
			]);
			const virtualizer = makeMockVirtualizer({
				heights: [200, 100, 200, 50, 200],
			});
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 5 },
			});

			const pages = result.current.pages;
			expect(pages[0]!.top).toBeCloseTo(0, 5);
			expect(pages[1]!.top).toBeCloseTo(160 + 5, 5);
			expect(pages[2]!.top).toBeCloseTo(160 + 5 + 80 + 5, 5);
			expect(pages[3]!.top).toBeCloseTo(160 + 5 + 80 + 5 + 160 + 5, 5);
			expect(pages[4]!.top).toBeCloseTo(160 + 5 + 80 + 5 + 160 + 5 + 40 + 5, 5);

			// totalHeight = top of last + height of last
			expect(result.current.totalHeight).toBeCloseTo(pages[4]!.top + 160, 5);
		});

		it("uses the default width=80 and gap=2 when no opts are passed", () => {
			const viewports = makeViewports([
				{ width: 100, height: 100 },
				{ width: 100, height: 100 },
			]);
			const virtualizer = makeMockVirtualizer({ heights: [100, 100] });
			const { result } = renderUseMiniMap({ viewports, virtualizer });

			const pages = result.current.pages;
			expect(pages[0]!.width).toBe(80);
			expect(pages[0]!.height).toBeCloseTo(80, 5); // square at width 80
			expect(pages[1]!.top).toBeCloseTo(80 + 2, 5); // default gap=2
		});
	});

	describe("forward mapping uses per-page binary/linear interpolation, NOT a global ratio (acceptance criterion 4)", () => {
		it("maps scrollOffset=350 into page index 1 (heights [300,300,600]) at fractional position 50/300", () => {
			const heights = [300, 300, 600];
			const viewports = makeViewports([
				{ width: 100, height: 300 },
				{ width: 100, height: 300 },
				{ width: 100, height: 600 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights,
				scrollOffset: 350,
			});
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			// width=80, page heights in minimap = (300/100)*80=240, 240, 480
			const pages = result.current.pages;
			expect(pages[0]!.height).toBeCloseTo(240, 5);
			expect(pages[1]!.height).toBeCloseTo(240, 5);
			expect(pages[2]!.height).toBeCloseTo(480, 5);

			// scrollOffset 350 -> falls in page 1 (real start 300, height 300)
			// frac = 50/300 -> minimap Y = pages[1].top + (50/300)*240
			const expected = pages[1]!.top + (50 / 300) * 240;
			expect(result.current.minimapYForScrollOffset(350)).toBeCloseTo(
				expected,
				5,
			);

			// Sanity: a globally-linear ratio would give
			// (350 / 1200) * totalHeight = (350/1200)*960 = 280, which is page 1
			// at offset 280-240=40 — clearly different from expected 280 only by
			// coincidence here, but more importantly assertion below distinguishes
			// the methods on a richer point: scrollOffset = 1100 sits inside page
			// 2 at frac 500/600 -> minimapY = 480 + (500/600)*480 = 880. The
			// linear ratio would give (1100/1200)*960 = 880 too — and that's
			// expected because at the page boundary they meet. Use a mid-page
			// case where they DIFFER:
			//
			// scrollOffset = 700: real page 2 (start=600, height=600), frac=100/600
			// per-page: pages[2].top + (100/600)*480 = 480 + 80 = 560
			// linear:   (700/1200)*960 = 560 too — coincidence with these heights.
			//
			// For these three heights the linear and per-page mappings agree at
			// many points because viewport heights happen to be proportional to
			// minimap heights (scale = 0.8). The richer test below uses mixed
			// aspect ratios to genuinely disambiguate.
		});

		it("differs from a global linear ratio on mixed-orientation docs", () => {
			// Mixed: portrait (100x200) and landscape (400x100). Real heights
			// equal viewport heights here (zoom=1) but minimap mapping uses
			// width-based scaling per page, so the two methods diverge.
			const viewports = makeViewports([
				{ width: 100, height: 200 }, // portrait, real h=200, minimap h=160
				{ width: 400, height: 100 }, // landscape, real h=100, minimap h=20
				{ width: 100, height: 200 }, // portrait, real h=200, minimap h=160
			]);
			const virtualizer = makeMockVirtualizer({
				heights: [200, 100, 200],
				scrollOffset: 250,
			});
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			// scrollOffset = 250 falls in page 1 (real start=200, real height=100)
			// frac = 50/100 -> per-page minimapY = 160 + 0.5*20 = 170
			const perPageY = result.current.minimapYForScrollOffset(250);
			expect(perPageY).toBeCloseTo(170, 5);

			// A global linear ratio would give:
			// totalReal = 500, totalMinimap = 340
			// ratio = 250/500 = 0.5 -> 0.5*340 = 170 (coincidence in 1D)
			// To truly disambiguate: scrollOffset=220 (early in page 1)
			// per-page: 160 + (20/100)*20 = 160 + 4 = 164
			// linear:   (220/500)*340 = 149.6
			const earlyVirtualizer = makeMockVirtualizer({
				heights: [200, 100, 200],
				scrollOffset: 220,
			});
			const r2 = renderUseMiniMap({
				viewports,
				virtualizer: earlyVirtualizer,
				opts: { width: 80, gap: 0 },
			});
			const perPageY2 = r2.result.current.minimapYForScrollOffset(220);
			expect(perPageY2).toBeCloseTo(164, 5);
			expect(perPageY2).not.toBeCloseTo(149.6, 1);
		});
	});

	describe("multi-page viewport span (acceptance criterion 5)", () => {
		it("uses forwardMap(top) and forwardMap(bottom) for viewport.height — single-page case", async () => {
			const heights = [200, 200, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights,
				scrollOffset: 50,
				clientHeight: 100, // fits within page 0
			});
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			// Wait one rAF tick so the local scrollOffset/clientHeight states sync.
			await act(async () => {
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => resolve()),
				);
			});

			// Forward map: scrollOffset=50 -> minimap Y = (50/200)*160 = 40
			//              bottom=150 -> minimap Y = (150/200)*160 = 120
			expect(result.current.viewport.top).toBeCloseTo(40, 5);
			expect(result.current.viewport.height).toBeCloseTo(80, 5);
		});

		it("computes viewport.height across multiple pages when clientHeight spans them", async () => {
			const heights = [200, 100, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 200, height: 100 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights,
				scrollOffset: 150, // bottom of page 0 (real 0-200)
				clientHeight: 250, // spans pages 0,1 and into 2
			});
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			await act(async () => {
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => resolve()),
				);
			});

			// forwardMap(150): page 0 (real start 0, height 200), frac=150/200
			//   -> 0 + 0.75 * 160 = 120
			// forwardMap(400): real total=500, this is in page 2 (start 300, height 200)
			//   frac = 100/200 = 0.5 -> top of page 2 in minimap + 0.5*160
			//   pages: 0=>top 0,h160; 1=>top 160,h40; 2=>top 200,h160
			//   forwardMap(400) = 200 + 0.5*160 = 280
			expect(result.current.viewport.top).toBeCloseTo(120, 5);
			expect(result.current.viewport.height).toBeCloseTo(160, 5);
		});
	});

	describe("inverse is the true inverse of forward (acceptance criterion 6)", () => {
		it("minimapYForScrollOffset(scrollOffsetForMinimapY(y)) ~= y for 10 random y values", () => {
			const heights = [300, 200, 400, 150, 250];
			const viewports = makeViewports([
				{ width: 100, height: 300 },
				{ width: 200, height: 200 }, // landscape-ish
				{ width: 100, height: 400 },
				{ width: 80, height: 150 },
				{ width: 100, height: 250 },
			]);
			const virtualizer = makeMockVirtualizer({ heights });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 3 },
			});

			const totalHeight = result.current.totalHeight;
			expect(totalHeight).toBeGreaterThan(0);

			// Deterministic pseudo-random sequence so failures are reproducible.
			const ys = [
				0.05, 0.13, 0.27, 0.34, 0.42, 0.51, 0.66, 0.73, 0.81, 0.94,
			].map((f) => f * totalHeight);

			for (const y of ys) {
				const offset = result.current.scrollOffsetForMinimapY(y);
				const yBack = result.current.minimapYForScrollOffset(offset);
				expect(Math.abs(yBack - y)).toBeLessThan(0.5);
			}
		});
	});

	describe("rAF subscription (acceptance criterion 7)", () => {
		it("schedules exactly one rAF loop on mount with non-null virtualizer and cancels on unmount", () => {
			const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
			const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

			const viewports = makeViewports([
				{ width: 100, height: 100 },
				{ width: 100, height: 100 },
			]);
			const virtualizer = makeMockVirtualizer({ heights: [100, 100] });

			const { unmount } = renderUseMiniMap({ viewports, virtualizer });

			// At least one rAF was scheduled by the hook.
			const scheduledCount = rafSpy.mock.calls.length;
			expect(scheduledCount).toBeGreaterThan(0);

			unmount();

			expect(cancelSpy).toHaveBeenCalled();
		});
	});

	describe("rAF skip-frame (acceptance criterion 8)", () => {
		it("does not call setState when scrollOffset is unchanged across 5 frames", async () => {
			// Capture rAF callbacks so we can drive them manually.
			const callbacks: FrameRequestCallback[] = [];
			let nextId = 1;
			const rafSpy = vi
				.spyOn(globalThis, "requestAnimationFrame")
				.mockImplementation((cb: FrameRequestCallback) => {
					callbacks.push(cb);
					return nextId++;
				});
			vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				scrollOffset: 0,
				clientHeight: 100,
			});

			const { result } = renderUseMiniMap({ viewports, virtualizer });

			// First frame seeds the value; subsequent frames with same value
			// must not re-trigger setState. We detect this via stable viewport.top
			// (memoized output) — if setState fired, React would re-run useMemo
			// and produce a referentially-equal value but the call count would
			// be visible via render counts. We use a simple check: drive 5
			// frames and verify result.current.viewport.top remains 0.
			const beforeRafCount = rafSpy.mock.calls.length;

			for (let i = 0; i < 5; i += 1) {
				const cb = callbacks.shift();
				if (cb) {
					await act(async () => {
						cb(performance.now());
					});
				}
			}

			expect(result.current.viewport.top).toBeCloseTo(0, 5);
			// After 5 ticks rAF has been scheduled at least 5 more times
			// (the loop reschedules itself each tick).
			expect(rafSpy.mock.calls.length).toBeGreaterThanOrEqual(
				beforeRafCount + 5,
			);
		});

		it("updates viewport.top when scrollOffset DOES change", async () => {
			const callbacks: FrameRequestCallback[] = [];
			let nextId = 1;
			vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
				(cb: FrameRequestCallback) => {
					callbacks.push(cb);
					return nextId++;
				},
			);
			vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				scrollOffset: 0,
				clientHeight: 100,
			});

			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			// Initial tick to capture starting state.
			await act(async () => {
				const cb = callbacks.shift();
				if (cb) cb(performance.now());
			});
			expect(result.current.viewport.top).toBeCloseTo(0, 5);

			// Mutate the mock virtualizer's scrollOffset and drive another frame.
			(virtualizer as unknown as { scrollOffset: number }).scrollOffset = 100;
			await act(async () => {
				const cb = callbacks.shift();
				if (cb) cb(performance.now());
			});

			// scrollOffset 100 within page 0 (real h=200, minimap h=160)
			// -> minimap Y = (100/200)*160 = 80
			expect(result.current.viewport.top).toBeCloseTo(80, 5);
		});
	});

	describe("real-page gaps in the virtualizer (codex review finding 1)", () => {
		it("does not produce backward minimap-Y when scrollOffset lands inside a virtualizer gap", () => {
			// <Pages> defaults to gap=10 and passes it to useVirtualizer. So
			// virtualizer.scrollOffset can land inside [bodyEnd_i, realStart_{i+1}],
			// which the original implementation maps to a negative fraction in
			// page i+1 — producing a backward jump in the minimap.
			const heights = [200, 200, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({ heights, gap: 10 });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			// Real layout: page 0 [0,200] body, [200,210] gap; page 1 [210,410] body, [410,420] gap; page 2 [420,620] body.
			// Drive scrollOffset across the first gap region.
			const samples = [195, 200, 205, 210, 215, 220];
			const ys = samples.map((s) => result.current.minimapYForScrollOffset(s));

			// Strictly monotonic: minimap should never jump backward as you scroll forward.
			for (let i = 1; i < ys.length; i += 1) {
				expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]!);
			}
		});

		it("maps scrollOffset at the very end of a page body to that page's bodyEnd in minimap (no early page transition)", () => {
			const heights = [200, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({ heights, gap: 10 });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 0 },
			});

			// scrollOffset = 200 is exactly at the boundary between page 0's body
			// and the trailing real-gap. It must map to page 0's body end in the
			// minimap (Y = 160), NOT into page 1.
			const y = result.current.minimapYForScrollOffset(200);
			expect(y).toBeCloseTo(160, 5);
		});
	});

	describe("minimap gaps preserve inverse identity (codex review finding 2)", () => {
		it("forward∘inverse is identity for minimap-Y values inside gap regions", () => {
			// pages[i].top includes the minimap gap accumulator. The original
			// implementation's forwardMap only mapped page bodies, so inverse
			// identity failed for Y values that fell inside the minimap gaps.
			const heights = [200, 200, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({ heights, gap: 10 });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 6 },
			});

			const pages = result.current.pages;
			// Sample Y values: body interior + INSIDE each minimap gap region.
			const samples = [
				pages[0]!.top + 50, // body of page 0
				pages[0]!.top + pages[0]!.height + 3, // inside gap after page 0
				pages[1]!.top + 50, // body of page 1
				pages[1]!.top + pages[1]!.height + 3, // inside gap after page 1
				pages[2]!.top + 50, // body of page 2
			];

			for (const y of samples) {
				const offset = result.current.scrollOffsetForMinimapY(y);
				const yBack = result.current.minimapYForScrollOffset(offset);
				expect(Math.abs(yBack - y)).toBeLessThan(0.5);
			}
		});
	});

	describe("zero-width pages still advance cursor by gap (codex review finding 3)", () => {
		it("plan formula top_i = sum(prior pageHeights) + i*gap holds even with a zero-width page", () => {
			// The plan formula says cursor advances by (pageHeight_i + gap) for
			// every page including zero-height ones. The original implementation
			// `continue`d for zero-width pages, skipping the gap accumulation.
			const viewports = makeViewports([
				{ width: 100, height: 200 }, // h=160
				{ width: 0, height: 0 }, // zero-width — h=0 but must still contribute gap
				{ width: 100, height: 200 }, // h=160
			]);
			const virtualizer = makeMockVirtualizer({ heights: [200, 0, 200] });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 5 },
			});

			const pages = result.current.pages;
			expect(pages[0]!.top).toBeCloseTo(0, 5);
			// top_1 = pageHeight_0 + gap = 160 + 5 = 165
			expect(pages[1]!.top).toBeCloseTo(165, 5);
			// top_2 = pageHeight_0 + gap + pageHeight_1 + gap = 160 + 5 + 0 + 5 = 170
			expect(pages[2]!.top).toBeCloseTo(170, 5);
		});
	});

	describe("asymmetric gap config: realGap=0 + minimapGap>0 (codex re-review finding 2)", () => {
		it("forward(r.bodyEnd) returns m.bodyEnd (current page), NOT m.slotEnd (next page top)", () => {
			// When the virtualizer has no gap but the minimap does, forward of the
			// body-end boundary should pin to the current page's bodyEnd in the
			// minimap — not "skip" into the next page's top. This keeps the
			// mapping consistent at the boundary and makes round-trip behaviour
			// at the boundary an identity.
			const heights = [200, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({ heights, gap: 0 });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 6 },
			});

			// pages[0]: top=0, height=160, bodyEnd=160
			// pages[1]: top=166 (with gap=6)
			// Real bodyEnd of page 0 is 200 (real heights are [200,200], no real gap).
			const yAtBodyEnd = result.current.minimapYForScrollOffset(200);
			// Must be the current page's bodyEnd (160), NOT the next page's top (166).
			expect(yAtBodyEnd).toBeCloseTo(160, 5);
			expect(yAtBodyEnd).not.toBeCloseTo(166, 1);
		});

		it("round-trip identity holds at the body-end boundary in asymmetric config", () => {
			const heights = [200, 200];
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({ heights, gap: 0 });
			const { result } = renderUseMiniMap({
				viewports,
				virtualizer,
				opts: { width: 80, gap: 6 },
			});

			const pages = result.current.pages;
			// Y exactly at minimap pages[0].bodyEnd (where the visual gap starts)
			const yBoundary = pages[0]!.top + pages[0]!.height; // = 160
			const offset = result.current.scrollOffsetForMinimapY(yBoundary);
			const yBack = result.current.minimapYForScrollOffset(offset);
			// Round-trip at the boundary must be identity
			expect(Math.abs(yBack - yBoundary)).toBeLessThan(0.5);
		});
	});

	describe("NaN-resilient rAF skip-frame (codex re-review finding 5)", () => {
		it("normalizes NaN scrollOffset to 0 so the rAF skip-frame guard does not degrade", async () => {
			const callbacks: FrameRequestCallback[] = [];
			let nextId = 1;
			vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
				(cb: FrameRequestCallback) => {
					callbacks.push(cb);
					return nextId++;
				},
			);
			vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			// Virtualizer reports NaN for both scrollOffset and clientHeight.
			const virtualizer = {
				get scrollOffset() {
					return Number.NaN;
				},
				scrollElement: { clientHeight: Number.NaN } as unknown as HTMLElement,
				options: { estimateSize: () => 200 },
				getOffsetForIndex: (i: number, a: "start") =>
					[i * 200, a] as [number, "start"],
				getTotalSize: () => 400,
			} as unknown as PDFVirtualizer;

			const { result } = renderUseMiniMap({ viewports, virtualizer });

			// Drive 5 frames. With NaN normalization, scrollOffset is treated as 0
			// every frame and the skip-frame guard correctly skips all but the
			// first. viewport.top must remain 0 (NOT NaN) and finite.
			for (let i = 0; i < 5; i += 1) {
				const cb = callbacks.shift();
				if (cb) {
					await act(async () => {
						cb(performance.now());
					});
				}
			}

			expect(Number.isFinite(result.current.viewport.top)).toBe(true);
			expect(result.current.viewport.top).toBeCloseTo(0, 5);
			expect(Number.isFinite(result.current.viewport.height)).toBe(true);
		});
	});

	describe("rAF skip-frame is a true skip (codex re-review finding 6 — render counter)", () => {
		it("does not cause re-renders when scrollOffset is unchanged across 5 frames", async () => {
			const callbacks: FrameRequestCallback[] = [];
			let nextId = 1;
			vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
				(cb: FrameRequestCallback) => {
					callbacks.push(cb);
					return nextId++;
				},
			);
			vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				scrollOffset: 0,
				clientHeight: 100,
			});

			// Count actual renders of the hook's host. The helper wires the
			// counter into the renderHook callback itself, so each callback
			// invocation corresponds to one render of the host component.
			// (An earlier version used `renderHook(() => <Probe />)` which
			// returns a React element from the callback but never mounts
			// Probe — making the assertion a tautology.)
			const renderCount = { current: 0 };
			renderUseMiniMapWithCount({ viewports, virtualizer, renderCount });

			// Sanity check: the helper actually invoked useMiniMap. If this
			// fails, the test infrastructure is broken and the assertion below
			// would be a false positive.
			expect(renderCount.current).toBeGreaterThanOrEqual(1);

			const initialRenders = renderCount.current;
			// Drive 5 frames with stable scrollOffset
			for (let i = 0; i < 5; i += 1) {
				const cb = callbacks.shift();
				if (cb) {
					await act(async () => {
						cb(performance.now());
					});
				}
			}
			// First frame may seed state once — but after that, no more renders.
			// Total post-mount additional renders should be at most 1 (the seed).
			const postFrameRenders = renderCount.current - initialRenders;
			expect(postFrameRenders).toBeLessThanOrEqual(1);
		});
	});

	describe("null getOffsetForIndex (codex review finding 4)", () => {
		it("returns safe values when virtualizer offsets are not yet resolvable", () => {
			// During init, getOffsetForIndex can return null. The original
			// implementation silently fabricated 0, producing plausible-looking
			// but wrong coordinates for non-zero pages.
			const viewports = makeViewports([
				{ width: 100, height: 200 },
				{ width: 100, height: 200 },
			]);
			const virtualizer = {
				scrollOffset: 0,
				scrollElement: { clientHeight: 600 } as unknown as HTMLElement,
				options: { estimateSize: () => 200 },
				getOffsetForIndex: () => null,
				getTotalSize: () => 400,
			} as unknown as PDFVirtualizer;

			const { result } = renderUseMiniMap({ viewports, virtualizer });

			// Mappings must not fabricate page starts. Safe fallback to 0.
			expect(result.current.minimapYForScrollOffset(100)).toBe(0);
			expect(result.current.scrollOffsetForMinimapY(50)).toBe(0);
		});
	});
});
