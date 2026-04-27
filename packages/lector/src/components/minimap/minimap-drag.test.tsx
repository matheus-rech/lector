import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { type ReactNode, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	type InitialPDFState,
	PDFStore,
	type PDFVirtualizer,
	usePdf,
} from "../../internal";
import { MiniMap } from "./minimap";

// ---------- Test fixtures ----------

const makeViewports = (n: number): PageViewport[] =>
	Array.from(
		{ length: n },
		() => ({ width: 100, height: 200 }) as unknown as PageViewport,
	);

const makePdfDocumentProxy = (numPages: number): PDFDocumentProxy =>
	({
		numPages,
		fingerprints: ["test", null],
	}) as unknown as PDFDocumentProxy;

const makeMockVirtualizer = ({
	heights,
	scrollOffset = 0,
	clientHeight = 600,
	totalSize,
}: {
	heights: number[];
	scrollOffset?: number;
	clientHeight?: number;
	totalSize?: number;
}): PDFVirtualizer => {
	const starts: number[] = [];
	let cursor = 0;
	for (let i = 0; i < heights.length; i += 1) {
		starts.push(cursor);
		cursor += heights[i]!;
	}
	const total = totalSize ?? cursor;
	return {
		scrollOffset,
		scrollElement: { clientHeight } as unknown as HTMLElement,
		options: { estimateSize: (i: number) => heights[i] ?? 0 },
		getOffsetForIndex: (i: number, a: "start") =>
			[starts[i] ?? 0, a] as [number, "start"],
		getTotalSize: () => total,
		scrollToIndex: vi.fn(),
		scrollToOffset: vi.fn(),
	} as unknown as PDFVirtualizer;
};

const makeInitialState = (viewports: PageViewport[]): InitialPDFState =>
	({
		pdfDocumentProxy: makePdfDocumentProxy(viewports.length),
		pageProxies: [] as PDFPageProxy[],
		viewports,
		zoom: 1,
	}) as InitialPDFState;

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

const renderMiniMap = ({
	virtualizer,
	pageCount = 5,
}: {
	virtualizer: PDFVirtualizer;
	pageCount?: number;
}) => {
	const viewports = makeViewports(pageCount);
	const initialState = makeInitialState(viewports);
	return render(
		<PDFStore.Provider initialValue={initialState}>
			<VirtualizerInjector virtualizer={virtualizer}>
				<MiniMap width={80} gap={0} />
			</VirtualizerInjector>
		</PDFStore.Provider>,
	);
};

/**
 * Force a known getBoundingClientRect on the minimap container so
 * (clientY - rect.top) yields a deterministic local Y.
 */
const stubBoundingRect = (top: number) => {
	// Stub on Element.prototype just for elements whose data-testid is "minimap"
	const original = HTMLElement.prototype.getBoundingClientRect;
	const stub = function (this: HTMLElement) {
		if (this.getAttribute?.("data-testid") === "minimap") {
			return {
				top,
				left: 0,
				right: 80,
				bottom: top + 1000,
				width: 80,
				height: 1000,
				x: 0,
				y: top,
				toJSON: () => ({}),
			} as DOMRect;
		}
		return original.call(this);
	};
	HTMLElement.prototype.getBoundingClientRect = stub as typeof original;
	return () => {
		HTMLElement.prototype.getBoundingClientRect = original;
	};
};

const drainOneFrame = async (cb: () => void): Promise<void> => {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => {
			cb();
			resolve();
		}),
	);
};

// ---------- Tests ----------

describe("MiniMap drag-scrub (US-004)", () => {
	afterEach(cleanup);

	it("pointerdown on the viewport calls setPointerCapture and immediately scrubs", () => {
		const restoreRect = stubBoundingRect(0);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200, 200],
				clientHeight: 100,
			});
			renderMiniMap({ virtualizer, pageCount: 3 });
			const vp = screen.getByTestId("minimap-viewport");
			const setPointerCapture = vi.fn();
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: setPointerCapture,
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => true,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: vi.fn(),
			});

			fireEvent.pointerDown(vp, { pointerId: 1, clientY: 80, button: 0 });

			expect(setPointerCapture).toHaveBeenCalledWith(1);
			// Immediate scrub on the press point: minimapY=80 -> per-page mapping
			// 3 portrait pages width=80 produce minimap heights of 160 each (gap=0),
			// totalHeight=480. minimapY=80 falls in page 0 body, frac=80/160=0.5,
			// real offset = (80 / 160) * 200 = 100.
			expect(virtualizer.scrollToOffset).toHaveBeenCalledTimes(1);
			expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(
				100,
				expect.objectContaining({ behavior: "auto" }),
			);
		} finally {
			restoreRect();
		}
	});

	it("uses behavior:'auto' (NOT 'smooth') so smooth scroll does not fight the pointer", () => {
		const restoreRect = stubBoundingRect(0);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				clientHeight: 100,
			});
			renderMiniMap({ virtualizer, pageCount: 2 });
			const vp = screen.getByTestId("minimap-viewport");
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: vi.fn(),
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => true,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: vi.fn(),
			});

			fireEvent.pointerDown(vp, { pointerId: 1, clientY: 50, button: 0 });
			const calls = (virtualizer.scrollToOffset as ReturnType<typeof vi.fn>)
				.mock.calls;
			expect(calls[0]?.[1]).toMatchObject({ behavior: "auto" });
			expect(calls[0]?.[1]).not.toMatchObject({ behavior: "smooth" });
		} finally {
			restoreRect();
		}
	});

	it("clamps to 0 when drag goes past the top of the minimap (negative localY)", () => {
		const restoreRect = stubBoundingRect(100);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				clientHeight: 100,
			});
			renderMiniMap({ virtualizer, pageCount: 2 });
			const vp = screen.getByTestId("minimap-viewport");
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: vi.fn(),
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => true,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: vi.fn(),
			});

			// clientY=50 with rect.top=100 → localY=-50 (above top). Must clamp.
			fireEvent.pointerDown(vp, { pointerId: 1, clientY: 50, button: 0 });
			const calls = (virtualizer.scrollToOffset as ReturnType<typeof vi.fn>)
				.mock.calls;
			expect(calls[0]?.[0]).toBe(0);
		} finally {
			restoreRect();
		}
	});

	it("clamps to maxOffset (totalSize - clientHeight) when drag goes past the bottom", () => {
		const restoreRect = stubBoundingRect(0);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200, 200],
				clientHeight: 100,
				totalSize: 600,
			});
			renderMiniMap({ virtualizer, pageCount: 3 });
			const vp = screen.getByTestId("minimap-viewport");
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: vi.fn(),
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => true,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: vi.fn(),
			});

			// clientY=10000 — way past the bottom of the minimap.
			fireEvent.pointerDown(vp, { pointerId: 1, clientY: 10000, button: 0 });
			const calls = (virtualizer.scrollToOffset as ReturnType<typeof vi.fn>)
				.mock.calls;
			// maxOffset = totalSize - clientHeight = 600 - 100 = 500
			expect(calls[0]?.[0]).toBe(500);
		} finally {
			restoreRect();
		}
	});

	it("pointermove without prior pointerdown does NOT call scrollToOffset", async () => {
		const restoreRect = stubBoundingRect(0);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				clientHeight: 100,
			});
			renderMiniMap({ virtualizer, pageCount: 2 });
			const vp = screen.getByTestId("minimap-viewport");
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: vi.fn(),
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => false,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: vi.fn(),
			});

			fireEvent.pointerMove(vp, { pointerId: 1, clientY: 50 });
			// Drain any scheduled rAF
			await drainOneFrame(() => {});
			expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
		} finally {
			restoreRect();
		}
	});

	it("pointerup releases pointer capture and clears the dragging flag", () => {
		const restoreRect = stubBoundingRect(0);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				clientHeight: 100,
			});
			renderMiniMap({ virtualizer, pageCount: 2 });
			const vp = screen.getByTestId("minimap-viewport");
			const releasePointerCapture = vi.fn();
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: vi.fn(),
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => true,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: releasePointerCapture,
			});

			fireEvent.pointerDown(vp, { pointerId: 1, clientY: 80, button: 0 });
			fireEvent.pointerUp(vp, { pointerId: 1, clientY: 80 });
			expect(releasePointerCapture).toHaveBeenCalledWith(1);
		} finally {
			restoreRect();
		}
	});

	it("pointermove during drag is rAF-throttled (no synchronous scrollToOffset spam)", () => {
		const restoreRect = stubBoundingRect(0);
		try {
			const virtualizer = makeMockVirtualizer({
				heights: [200, 200],
				clientHeight: 100,
			});
			renderMiniMap({ virtualizer, pageCount: 2 });
			const vp = screen.getByTestId("minimap-viewport");
			Object.defineProperty(vp, "setPointerCapture", {
				configurable: true,
				value: vi.fn(),
			});
			Object.defineProperty(vp, "hasPointerCapture", {
				configurable: true,
				value: () => true,
			});
			Object.defineProperty(vp, "releasePointerCapture", {
				configurable: true,
				value: vi.fn(),
			});

			fireEvent.pointerDown(vp, { pointerId: 1, clientY: 10, button: 0 });
			const callsAfterDown = (
				virtualizer.scrollToOffset as ReturnType<typeof vi.fn>
			).mock.calls.length;

			// Fire 5 pointermove events synchronously.
			for (let i = 0; i < 5; i += 1) {
				fireEvent.pointerMove(vp, { pointerId: 1, clientY: 20 + i });
			}

			// Without rAF flush, no additional sync calls beyond initial.
			const callsAfterMoves = (
				virtualizer.scrollToOffset as ReturnType<typeof vi.fn>
			).mock.calls.length;
			expect(callsAfterMoves - callsAfterDown).toBe(0);
		} finally {
			restoreRect();
		}
	});
});
