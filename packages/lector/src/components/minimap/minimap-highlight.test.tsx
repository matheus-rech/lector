import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ColoredHighlight } from "../../internal";
import { MiniMapHighlight } from "./minimap-highlight";

const makeHighlight = (
	overrides: Partial<ColoredHighlight> = {},
): ColoredHighlight => ({
	uuid: "h1",
	color: "rgb(250, 204, 21)",
	pageNumber: 1,
	text: "sample text",
	rectangles: [
		{ pageNumber: 1, top: 50, left: 0, height: 5, width: 100, type: "percent" },
	],
	...overrides,
});

describe("MiniMapHighlight", () => {
	afterEach(cleanup);

	it("renders a pill per rect (multi-rect highlight produces N pills)", () => {
		const highlight = makeHighlight({
			rectangles: [
				{
					pageNumber: 1,
					top: 10,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
				{
					pageNumber: 1,
					top: 30,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
				{
					pageNumber: 1,
					top: 50,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
			],
		});
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
			/>,
		);
		const pills = screen.getAllByTestId(/^minimap-highlight-pill/);
		expect(pills).toHaveLength(3);
	});

	it("percent rect: top=50 height=5 on pageHeight=200 → topPx=100, heightPx=10", () => {
		const highlight = makeHighlight({
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
		});
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
			/>,
		);
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		expect(pill.style.top).toBe("100px");
		expect(pill.style.height).toBe("10px");
	});

	it("pixels rect: top=100 height=10 on sourcePageHeight=400, pageHeight=80 → topPx=20, heightPx=2", () => {
		const highlight = makeHighlight({
			rectangles: [
				{
					pageNumber: 1,
					top: 100,
					left: 0,
					height: 10,
					width: 200,
					type: "pixels",
				},
			],
		});
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={80}
				sourcePageHeight={400}
			/>,
		);
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		expect(pill.style.top).toBe("20px");
		// 10/400 * 80 = 2 — at the floor; stays at 2
		expect(pill.style.height).toBe("2px");
	});

	it("clamps minimum visible height to 2px when computed heightPx < 2", () => {
		const highlight = makeHighlight({
			rectangles: [
				{
					pageNumber: 1,
					top: 0,
					left: 0,
					height: 0.5,
					width: 100,
					type: "percent",
				},
			],
		});
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
			/>,
		);
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		// 0.5/100 * 200 = 1 → clamps to 2
		expect(pill.style.height).toBe("2px");
	});

	it("applies highlight.color as background", () => {
		const highlight = makeHighlight({ color: "rgb(34, 197, 94)" });
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
			/>,
		);
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		expect(pill.style.backgroundColor).toBe("rgb(34, 197, 94)");
	});

	it("pill spans full minimap page width (left:0, width:pageWidth)", () => {
		const highlight = makeHighlight();
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
			/>,
		);
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		expect(pill.style.left).toBe("0px");
		expect(pill.style.width).toBe("80px");
		expect(pill.style.position).toBe("absolute");
	});

	it("forwards data-highlight-uuid and data-rect-index for testability", () => {
		const highlight = makeHighlight({
			uuid: "abc-xyz",
			rectangles: [
				{
					pageNumber: 1,
					top: 10,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
				{
					pageNumber: 1,
					top: 20,
					left: 0,
					height: 5,
					width: 100,
					type: "percent",
				},
			],
		});
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
			/>,
		);
		const pill0 = screen.getByTestId("minimap-highlight-pill-0");
		const pill1 = screen.getByTestId("minimap-highlight-pill-1");
		expect(pill0.getAttribute("data-highlight-uuid")).toBe("abc-xyz");
		expect(pill0.getAttribute("data-rect-index")).toBe("0");
		expect(pill1.getAttribute("data-rect-index")).toBe("1");
	});

	it("forwards onClick — fires when a pill is clicked", () => {
		const handleClick = vi.fn();
		const highlight = makeHighlight();
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={200}
				onClick={handleClick}
			/>,
		);
		fireEvent.click(screen.getByTestId("minimap-highlight-pill-0"));
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("rect with no explicit type is treated as pixels (default)", () => {
		const highlight = makeHighlight({
			rectangles: [
				// No `type` field — should default to pixels
				{ pageNumber: 1, top: 100, left: 0, height: 10, width: 200 },
			],
		});
		render(
			<MiniMapHighlight
				highlight={highlight}
				pageWidth={80}
				pageHeight={80}
				sourcePageHeight={400}
			/>,
		);
		const pill = screen.getByTestId("minimap-highlight-pill-0");
		// Should match the pixels-mode worked example
		expect(pill.style.top).toBe("20px");
	});
});
