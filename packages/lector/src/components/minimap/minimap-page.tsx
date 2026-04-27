import {
	type CSSProperties,
	forwardRef,
	type HTMLProps,
	type ReactNode,
} from "react";

import { Primitive } from "../primitive";

interface MiniMapPageProps extends Omit<HTMLProps<HTMLDivElement>, "ref"> {
	pageNumber: number;
	width: number;
	height: number;
	children?: ReactNode;
}

/**
 * One mini-page cell in the minimap. Sized proportionally to the source PDF
 * page. Acts as the positioning context (`position: relative`) for any
 * absolutely-positioned children — typically MiniMapHighlight pills.
 */
export const MiniMapPage = forwardRef<HTMLDivElement, MiniMapPageProps>(
	({ pageNumber, width, height, children, style, ...props }, ref) => {
		const computedStyle: CSSProperties = {
			position: "relative",
			width,
			height,
			...style,
		};

		return (
			<Primitive.div
				ref={ref}
				data-testid="minimap-page"
				data-page-number={pageNumber}
				{...props}
				style={computedStyle}
			>
				{children}
			</Primitive.div>
		);
	},
);

MiniMapPage.displayName = "MiniMapPage";
