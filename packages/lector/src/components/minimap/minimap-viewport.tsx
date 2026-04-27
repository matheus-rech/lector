import {
	type CSSProperties,
	forwardRef,
	type HTMLProps,
	type ReactNode,
} from "react";

import { Primitive } from "../primitive";

interface MiniMapViewportProps extends Omit<HTMLProps<HTMLDivElement>, "ref"> {
	top: number;
	height: number;
	children?: ReactNode;
}

/**
 * The viewport-position scrubber overlay on the minimap. Absolutely
 * positioned, full minimap width, with `pointerEvents: "auto"` by default
 * so the drag-scrub handler in <MiniMap> can capture pointers.
 */
export const MiniMapViewport = forwardRef<HTMLDivElement, MiniMapViewportProps>(
	({ top, height, children, style, ...props }, ref) => {
		const computedStyle: CSSProperties = {
			position: "absolute",
			top,
			left: 0,
			width: "100%",
			height,
			pointerEvents: "auto",
			...style,
		};

		return (
			<Primitive.div
				ref={ref}
				data-testid="minimap-viewport"
				data-minimap-viewport=""
				{...props}
				style={computedStyle}
			>
				{children}
			</Primitive.div>
		);
	},
);

MiniMapViewport.displayName = "MiniMapViewport";
