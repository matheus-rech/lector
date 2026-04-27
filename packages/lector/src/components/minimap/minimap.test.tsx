import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { type ReactNode, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	type ColoredHighlight,
	type InitialPDFState,
	PDFStore,
	type PDFVirtualizer,
	usePdf,
} from "../../internal";
import { MiniMap } from "./minimap";

// ---------- Test fixtures ----------

const makeViewports = (
	sizes: Array<{ width: number; height: number }>,
): PageViewport[] =>
	sizes.map(
		(s) => ({ width: s.width, height: s.height }) as unknown as PageViewport,
	);

const makePdfDocumentProxy = (numPages: number): PDFDocumentProxy =>
	({
		numPages,
		fingerprints: ["test", null],
	}) as unknown as PDFDocumentProxy;

const makeMockVirtualizer = (
	heights: number[],
	gap = 0,
	scrollOffset = 0,
	clientHeight = 600,
): PDFVirtualizer => {
	const starts: number[] = [];
	let cursor = 0;
	for (let i = 0; i < heights.length; i += 1) {
		starts.push(cursor);
		cursor += heights[i]! + gap;
	}
	return {
		scrollOffset,
		scrollElement: { clientHeight } as unknown as HTMLElement,
		options: { estimateSize: (i: number) => heights[i] ?? 0 },
		getOffsetForIndex: (i: number, a: "start") =>
			[starts[i] ?? 0, a] as [number, "start"],
		getTotalSize: () => (cursor === 0 ? 0 : cursor - gap),
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
		// coloredHighlights is part of PDFState defaults; the PDFStore.Provider
		// initializes it to []. To inject highlights, use VirtualizerInjector.
	}) as InitialPDFState;

const VirtualizerInjector = ({
	virtualizer,
	highlights = [],
	children,
}: {
	virtualizer: PDFVirtualizer | null;
	highlights?: ColoredHighlight[];
	children: ReactNode;
}) => {
	const setVirtualizer = usePdf((s) => s.setVirtualizer);
	const currentVirtualizer = usePdf((s) => s.virtualizer);
	const addColoredHighlight = usePdf((s) => s.addColoredHighlight);
	const injectedRef = useRef(false);
	if (
		virtualizer &&
		currentVirtualizer !== virtualizer &&
		!injectedRef.current
	) {
		injectedRef.current = true;
		setVirtualizer(virtualizer);
		for (const h of highlights) addColoredHighlight(h);
	}
	return <>{children}</>;
};

const renderMiniMap = ({
	viewports,
	virtualizer,
	highlights,
	miniMapProps,
}: {
	viewports: PageViewport[];
	virtualizer: PDFVirtualizer | null;
	highlights?: ColoredHighlight[];
	miniMapProps?: Parameters<typeof MiniMap>[0];
}) => {
	const initialState = makeInitialState(viewports);
	return render(
		<PDFStore.Provider initialValue={initialState}>
			<VirtualizerInjector virtualizer={virtualizer} highlights={highlights}>
				<MiniMap {...miniMapProps} />
			</VirtualizerInjector>
		</PDFStore.Provider>,
	);
};

// ---------- Tests ----------

describe("MiniMap orchestrator", () => {
	afterEach(cleanup);

	it("renders exactly N MiniMapPage children when virtualizer is ready", () => {
		const viewports = makeViewports(
			Array.from({ length: 5 }, () => ({ width: 100, height: 200 })),
		);
		const virtualizer = makeMockVirtualizer([200, 200, 200, 200, 200]);
		renderMiniMap({ viewports, virtualizer });
		const pages = screen.getAllByTestId("minimap-page");
		expect(pages).toHaveLength(5);
	});

	it("renders nothing if virtualizer is null (safe empty state)", () => {
		const viewports = makeViewports([{ width: 100, height: 200 }]);
		const initialState = makeInitialState(viewports);
		render(
			<PDFStore.Provider initialValue={initialState}>
				<MiniMap />
			</PDFStore.Provider>,
		);
		const pages = screen.queryAllByTestId("minimap-page");
		expect(pages).toHaveLength(0);
	});

	it("renders highlight pills only on the page they belong to", () => {
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200, 200]);
		const highlights: ColoredHighlight[] = [
			{
				uuid: "h1",
				color: "rgb(250, 204, 21)",
				pageNumber: 1,
				text: "a",
				rectangles: [
					{
						pageNumber: 1,
						top: 10,
						left: 0,
						height: 5,
						width: 100,
						type: "percent",
					},
				],
			},
			{
				uuid: "h2",
				color: "rgb(34, 197, 94)",
				pageNumber: 3,
				text: "b",
				rectangles: [
					{
						pageNumber: 3,
						top: 50,
						left: 0,
						height: 5,
						width: 100,
						type: "percent",
					},
					{
						pageNumber: 3,
						top: 60,
						left: 0,
						height: 5,
						width: 100,
						type: "percent",
					},
				],
			},
		];
		renderMiniMap({ viewports, virtualizer, highlights });
		const allPills = screen.getAllByTestId(/^minimap-highlight-pill/);
		expect(allPills).toHaveLength(3); // h1 has 1 rect + h2 has 2 rects
		const h1Pills = allPills.filter(
			(el) => el.getAttribute("data-highlight-uuid") === "h1",
		);
		const h2Pills = allPills.filter(
			(el) => el.getAttribute("data-highlight-uuid") === "h2",
		);
		expect(h1Pills).toHaveLength(1);
		expect(h2Pills).toHaveLength(2);
	});

	it("click on a MiniMapPage calls virtualizer.scrollToIndex with pageIndex (0-based, since usePdfJump.jumpToPage subtracts 1)", () => {
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200, 200]);
		renderMiniMap({ viewports, virtualizer });
		const pages = screen.getAllByTestId("minimap-page");
		fireEvent.click(pages[2]!); // click the third page (1-based pageNumber=3)
		expect(virtualizer.scrollToIndex).toHaveBeenCalledTimes(1);
		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(
			2,
			expect.any(Object),
		);
	});

	it("click on a MiniMapHighlight pill calls scrollToOffset (via jumpToHighlightRects) and fires onHighlightClick", () => {
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200]);
		const highlight: ColoredHighlight = {
			uuid: "click-me",
			color: "rgb(250, 204, 21)",
			pageNumber: 2,
			text: "x",
			rectangles: [
				{
					pageNumber: 2,
					top: 50,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
			],
		};
		const onHighlightClick = vi.fn();
		renderMiniMap({
			viewports,
			virtualizer,
			highlights: [highlight],
			miniMapProps: { onHighlightClick },
		});
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		fireEvent.click(pill);

		expect(onHighlightClick).toHaveBeenCalledTimes(1);
		expect(onHighlightClick).toHaveBeenCalledWith(highlight);
		expect(virtualizer.scrollToOffset).toHaveBeenCalledTimes(1);
	});

	it("highlight click stops propagation so the page click does NOT also fire", () => {
		const viewports = makeViewports([{ width: 100, height: 200 }]);
		const virtualizer = makeMockVirtualizer([200]);
		const highlight: ColoredHighlight = {
			uuid: "h-stop",
			color: "rgb(250, 204, 21)",
			pageNumber: 1,
			text: "x",
			rectangles: [
				{
					pageNumber: 1,
					top: 50,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
			],
		};
		renderMiniMap({ viewports, virtualizer, highlights: [highlight] });
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		fireEvent.click(pill);
		// Page click would call scrollToIndex; highlight click goes through scrollToOffset.
		expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
		expect(virtualizer.scrollToOffset).toHaveBeenCalledTimes(1);
	});

	it("renderPage prop replaces the default page rendering", () => {
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200]);
		renderMiniMap({
			viewports,
			virtualizer,
			miniMapProps: {
				renderPage: ({ page }) => (
					<div
						key={page.pageNumber}
						data-testid={`custom-page-${page.pageNumber}`}
					/>
				),
			},
		});
		expect(screen.queryAllByTestId("minimap-page")).toHaveLength(0);
		expect(screen.getByTestId("custom-page-1")).toBeTruthy();
		expect(screen.getByTestId("custom-page-2")).toBeTruthy();
	});

	it("renderViewport prop replaces the default viewport rendering", () => {
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200]);
		renderMiniMap({
			viewports,
			virtualizer,
			miniMapProps: {
				renderViewport: ({ top, height }) => (
					<div
						data-testid="custom-viewport"
						style={{ position: "absolute", top, height }}
					/>
				),
			},
		});
		expect(screen.queryAllByTestId("minimap-viewport")).toHaveLength(0);
		expect(screen.getByTestId("custom-viewport")).toBeTruthy();
	});

	it("respects width and gap props for layout", () => {
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200]);
		renderMiniMap({
			viewports,
			virtualizer,
			miniMapProps: { width: 100, gap: 8 },
		});
		const pages = screen.getAllByTestId("minimap-page");
		// pages are absolutely positioned at their cumulative top
		expect(pages[0]!.style.width).toBe("100px");
		expect(pages[0]!.style.height).toBe("200px"); // 200/100 * 100 = 200
		expect(pages[1]!.style.top).toBe("208px"); // 200 + 8
	});

	it("renders the viewport scrubber with pointerEvents:auto by default", () => {
		const viewports = makeViewports([{ width: 100, height: 200 }]);
		const virtualizer = makeMockVirtualizer([200]);
		renderMiniMap({ viewports, virtualizer });
		const vp = screen.getByTestId("minimap-viewport");
		expect(vp.style.pointerEvents).toBe("auto");
	});

	it("forwards className and style to the outer container", () => {
		const viewports = makeViewports([{ width: 100, height: 200 }]);
		const virtualizer = makeMockVirtualizer([200]);
		renderMiniMap({
			viewports,
			virtualizer,
			miniMapProps: {
				className: "my-minimap",
				style: { backgroundColor: "rgb(243, 244, 246)" },
			},
		});
		const root = screen.getByTestId("minimap");
		expect(root.className).toContain("my-minimap");
		expect(root.style.backgroundColor).toBe("rgb(243, 244, 246)");
	});

	it("page-click invokes scrollToIndex with the right page (1-based clarification)", () => {
		// MiniMap consumers think in 1-based page numbers; the virtualizer
		// (via usePdfJump.jumpToPage) subtracts 1. Verify clicking page 1
		// hits index 0.
		const viewports = makeViewports([
			{ width: 100, height: 200 },
			{ width: 100, height: 200 },
		]);
		const virtualizer = makeMockVirtualizer([200, 200]);
		renderMiniMap({ viewports, virtualizer });
		const pages = screen.getAllByTestId("minimap-page");
		fireEvent.click(pages[0]!); // page 1 → index 0
		expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(
			0,
			expect.any(Object),
		);
	});
});
