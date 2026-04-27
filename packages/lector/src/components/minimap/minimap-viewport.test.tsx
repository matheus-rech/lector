import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MiniMapViewport } from "./minimap-viewport";

describe("MiniMapViewport", () => {
	afterEach(cleanup);

	it("renders absolute-positioned div with top and height from props", () => {
		render(<MiniMapViewport top={20} height={80} />);
		const el = screen.getByTestId("minimap-viewport");
		expect(el.style.position).toBe("absolute");
		expect(el.style.top).toBe("20px");
		expect(el.style.height).toBe("80px");
	});

	it("spans the full minimap width by default (left:0, width:100%)", () => {
		render(<MiniMapViewport top={0} height={60} />);
		const el = screen.getByTestId("minimap-viewport");
		expect(el.style.left).toBe("0px");
		expect(el.style.width).toBe("100%");
	});

	it("has pointerEvents: auto by default so US-004 drag handler can receive pointers", () => {
		render(<MiniMapViewport top={0} height={60} />);
		const el = screen.getByTestId("minimap-viewport");
		expect(el.style.pointerEvents).toBe("auto");
	});

	it("renders children inside the viewport (composition)", () => {
		render(
			<MiniMapViewport top={10} height={40}>
				<span data-testid="child">scrubber</span>
			</MiniMapViewport>,
		);
		expect(screen.getByTestId("child")).toBeTruthy();
	});

	it("merges consumer style after defaults so consumer wins", () => {
		render(
			<MiniMapViewport
				top={0}
				height={60}
				style={{ backgroundColor: "rgba(59, 130, 246, 0.18)" }}
			/>,
		);
		const el = screen.getByTestId("minimap-viewport");
		expect(el.style.backgroundColor).toBe("rgba(59, 130, 246, 0.18)");
		expect(el.style.position).toBe("absolute");
	});

	it("forwards className", () => {
		render(<MiniMapViewport top={0} height={60} className="my-viewport" />);
		const el = screen.getByTestId("minimap-viewport");
		expect(el.className).toContain("my-viewport");
	});

	it("respects consumer-provided pointerEvents:none override", () => {
		render(
			<MiniMapViewport top={0} height={60} style={{ pointerEvents: "none" }} />,
		);
		const el = screen.getByTestId("minimap-viewport");
		expect(el.style.pointerEvents).toBe("none");
	});
});
