import { type CSSProperties, forwardRef, type HTMLProps } from "react";

import type { ColoredHighlight, HighlightRect } from "../../internal";
import { Primitive } from "../primitive";

interface MiniMapHighlightProps
	extends Omit<HTMLProps<HTMLDivElement>, "ref" | "color"> {
	highlight: ColoredHighlight;
	pageWidth: number;
	pageHeight: number;
	/**
	 * Real source PDF page height in PDF.js units. Used only when a rect
	 * has `type: "pixels"` (or no type, which defaults to pixels) — the
	 * pixels are scaled into the minimap coordinate space using this ratio.
	 * If omitted and a rect is in pixels mode, falls back to treating
	 * rect.top/height as already in minimap pixels (defensive).
	 */
	sourcePageHeight?: number;
}

const MIN_VISIBLE_HEIGHT_PX = 2;

const computeRectGeometry = (
	rect: HighlightRect,
	pageHeight: number,
	sourcePageHeight: number | undefined,
): { topPx: number; heightPx: number } => {
	if (rect.type === "percent") {
		return {
			topPx: (rect.top / 100) * pageHeight,
			heightPx: (rect.height / 100) * pageHeight,
		};
	}
	// "pixels" or undefined: scale by sourcePageHeight if available.
	if (sourcePageHeight && sourcePageHeight > 0) {
		return {
			topPx: (rect.top / sourcePageHeight) * pageHeight,
			heightPx: (rect.height / sourcePageHeight) * pageHeight,
		};
	}
	// Fallback: assume the values are already in minimap pixels.
	return { topPx: rect.top, heightPx: rect.height };
};

/**
 * Renders one absolutely-positioned colored pill per rect inside a
 * `ColoredHighlight`. Coordinates the percent vs. pixels conversion
 * documented in plan §3 ("Highlight overlay positioning"). Min-height
 * clamps to 2px so very small highlights remain glanceable.
 *
 * Should be mounted inside a `MiniMapPage` (which provides
 * `position: relative` so the pills anchor correctly).
 */
export const MiniMapHighlight = forwardRef<
	HTMLDivElement,
	MiniMapHighlightProps
>(
	(
		{
			highlight,
			pageWidth,
			pageHeight,
			sourcePageHeight,
			onClick,
			style,
			...rest
		},
		ref,
	) => {
		return (
			<Primitive.div
				ref={ref}
				data-testid={`minimap-highlight-${highlight.uuid}`}
				{...rest}
			>
				{highlight.rectangles.map((rect, index) => {
					const { topPx, heightPx } = computeRectGeometry(
						rect,
						pageHeight,
						sourcePageHeight,
					);
					const clampedHeight = Math.max(MIN_VISIBLE_HEIGHT_PX, heightPx);
					const pillStyle: CSSProperties = {
						position: "absolute",
						top: topPx,
						left: 0,
						width: pageWidth,
						height: clampedHeight,
						backgroundColor: highlight.color,
						pointerEvents: "auto",
						cursor: onClick ? "pointer" : "default",
						...style,
					};
					return (
						<div
							key={`${highlight.uuid}-${index}`}
							data-testid={`minimap-highlight-pill-${index}`}
							data-highlight-uuid={highlight.uuid}
							data-rect-index={index}
							style={pillStyle}
							onClick={onClick}
							onKeyDown={(e) => {
								if ((e.key === "Enter" || e.key === " ") && onClick) {
									onClick(
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										e as unknown as React.MouseEvent<HTMLDivElement>,
									);
								}
							}}
							role={onClick ? "button" : undefined}
							tabIndex={onClick ? 0 : undefined}
						/>
					);
				})}
			</Primitive.div>
		);
	},
);

MiniMapHighlight.displayName = "MiniMapHighlight";
