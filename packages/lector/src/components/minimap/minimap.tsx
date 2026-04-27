import {
	type CSSProperties,
	forwardRef,
	type HTMLProps,
	type ReactNode,
	useCallback,
	useMemo,
} from "react";
import { usePdfJump } from "../../hooks/pages/usePdfJump";
import {
	type MiniMapPageLayout,
	type MiniMapViewportRect,
	useMiniMap,
} from "../../hooks/useMiniMap";
import { type ColoredHighlight, usePdf } from "../../internal";
import { Primitive } from "../primitive";
import { MiniMapHighlight } from "./minimap-highlight";
import { MiniMapPage } from "./minimap-page";
import { MiniMapViewport } from "./minimap-viewport";

export interface MiniMapRenderPageArgs {
	page: MiniMapPageLayout;
	highlights: ColoredHighlight[];
	sourcePageHeight: number | undefined;
	onPageClick: () => void;
	onHighlightClick: (highlight: ColoredHighlight) => void;
}

export interface MiniMapProps extends Omit<HTMLProps<HTMLDivElement>, "ref"> {
	/** Width of the minimap in px. Default: 80. */
	width?: number;
	/** Vertical gap between mini pages in px. Default: 2. */
	gap?: number;
	/** Fired after a highlight pill is clicked + jumpToHighlightRects has been triggered. */
	onHighlightClick?: (highlight: ColoredHighlight) => void;
	/** Optional render-prop override for individual pages (with their highlights). */
	renderPage?: (args: MiniMapRenderPageArgs) => ReactNode;
	/** Optional render-prop override for the viewport scrubber overlay. */
	renderViewport?: (args: MiniMapViewportRect) => ReactNode;
}

const DEFAULT_WIDTH = 80;
const DEFAULT_GAP = 2;

/**
 * Headless mini-map / scroll-position indicator for `<Pages>`.
 *
 * Renders a vertical column of proportionally-sized page rectangles with
 * colored highlight overlays and a viewport scrubber. Click a page to
 * jump; click a highlight pill to jump to that highlight; (US-004) drag
 * the scrubber to scrub through the document.
 *
 * Composes inside `<Root>` alongside `<Pages>`. SSR-safe: when the
 * virtualizer hasn't mounted yet, renders empty.
 */
export const MiniMap = forwardRef<HTMLDivElement, MiniMapProps>(
	(
		{
			width = DEFAULT_WIDTH,
			gap = DEFAULT_GAP,
			onHighlightClick,
			renderPage,
			renderViewport,
			style,
			children,
			...rest
		},
		ref,
	) => {
		const viewports = usePdf((s) => s.viewports);
		const coloredHighlights = usePdf((s) => s.coloredHighlights);
		const virtualizer = usePdf((s) => s.virtualizer);

		const { pages, totalHeight, viewport, scrollOffsetForMinimapY } =
			useMiniMap({
				width,
				gap,
			});

		const { jumpToPage, jumpToHighlightRects } = usePdfJump();

		// Group highlights by 1-based page number for O(1) lookup per page.
		const highlightsByPage = useMemo(() => {
			const map = new Map<number, ColoredHighlight[]>();
			for (const h of coloredHighlights) {
				const list = map.get(h.pageNumber) ?? [];
				list.push(h);
				map.set(h.pageNumber, list);
			}
			return map;
		}, [coloredHighlights]);

		const handlePageClick = useCallback(
			(pageNumber: number) => {
				jumpToPage(pageNumber, { align: "start" });
			},
			[jumpToPage],
		);

		const handleHighlightClick = useCallback(
			(highlight: ColoredHighlight) => {
				const firstRect = highlight.rectangles[0];
				const type = firstRect?.type ?? "pixels";
				jumpToHighlightRects(highlight.rectangles, type, "center");
				onHighlightClick?.(highlight);
			},
			[jumpToHighlightRects, onHighlightClick],
		);

		const containerStyle: CSSProperties = {
			position: "relative",
			width,
			height: totalHeight,
			...style,
		};

		// Pre-mount safe state: if virtualizer hasn't mounted, render the empty
		// container only. Children include nothing — no pages, no scrubber, no
		// invocation of jump/scroll APIs (which would no-op anyway).
		if (!virtualizer || pages.length === 0) {
			return (
				<Primitive.div
					ref={ref}
					data-testid="minimap"
					{...rest}
					style={containerStyle}
				>
					{children}
				</Primitive.div>
			);
		}

		return (
			<Primitive.div
				ref={ref}
				data-testid="minimap"
				{...rest}
				style={containerStyle}
			>
				{pages.map((page) => {
					const pageHighlights = highlightsByPage.get(page.pageNumber) ?? [];
					const sourcePageHeight = viewports[page.pageNumber - 1]?.height;
					const args: MiniMapRenderPageArgs = {
						page,
						highlights: pageHighlights,
						sourcePageHeight,
						onPageClick: () => handlePageClick(page.pageNumber),
						onHighlightClick: handleHighlightClick,
					};
					if (renderPage) {
						return (
							<div
								// We don't have a render-prop key — use pageNumber.
								key={page.pageNumber}
							>
								{renderPage(args)}
							</div>
						);
					}
					return (
						<MiniMapPage
							key={page.pageNumber}
							pageNumber={page.pageNumber}
							width={page.width}
							height={page.height}
							style={{ position: "absolute", top: page.top, left: 0 }}
							onClick={() => handlePageClick(page.pageNumber)}
						>
							{pageHighlights.map((highlight) => (
								<MiniMapHighlight
									key={highlight.uuid}
									highlight={highlight}
									pageWidth={page.width}
									pageHeight={page.height}
									sourcePageHeight={sourcePageHeight}
									onClick={(e) => {
										e.stopPropagation();
										handleHighlightClick(highlight);
									}}
								/>
							))}
						</MiniMapPage>
					);
				})}
				{renderViewport ? (
					renderViewport(viewport)
				) : (
					<MiniMapViewport top={viewport.top} height={viewport.height} />
				)}
				{children}
				{/* `scrollOffsetForMinimapY` is exposed for US-004 drag handler;
				    this no-op reference keeps it in the closure without needing
				    a separate ref. */}
				{void scrollOffsetForMinimapY}
			</Primitive.div>
		);
	},
);

MiniMap.displayName = "MiniMap";

export { MiniMapHighlight, MiniMapPage, MiniMapViewport };
