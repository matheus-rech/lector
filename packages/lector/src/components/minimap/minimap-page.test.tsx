import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MiniMapPage } from "./minimap-page";

describe("MiniMapPage", () => {
	afterEach(cleanup);

	it("renders a div with the exact width and height from props", () => {
		render(
			<MiniMapPage pageNumber={1} width={80} height={120}>
				<span data-testid="child">child</span>
			</MiniMapPage>,
		);
		const el = screen.getByTestId("minimap-page");
		expect(el.style.width).toBe("80px");
		expect(el.style.height).toBe("120px");
	});

	it("uses position: relative so absolutely-positioned children anchor to it", () => {
		render(<MiniMapPage pageNumber={1} width={80} height={120} />);
		const el = screen.getByTestId("minimap-page");
		expect(el.style.position).toBe("relative");
	});

	it("forwards data-page-number for testability and debug", () => {
		render(<MiniMapPage pageNumber={7} width={80} height={120} />);
		const el = screen.getByTestId("minimap-page");
		expect(el.getAttribute("data-page-number")).toBe("7");
	});

	it("renders children", () => {
		render(
			<MiniMapPage pageNumber={1} width={80} height={120}>
				<span data-testid="pill">highlight</span>
			</MiniMapPage>,
		);
		expect(screen.getByTestId("pill")).toBeTruthy();
	});

	it("merges consumer style after defaults so consumer wins", () => {
		render(
			<MiniMapPage
				pageNumber={1}
				width={80}
				height={120}
				style={{ backgroundColor: "rgb(250, 250, 250)" }}
			/>,
		);
		const el = screen.getByTestId("minimap-page");
		expect(el.style.backgroundColor).toBe("rgb(250, 250, 250)");
		// Defaults still present
		expect(el.style.width).toBe("80px");
	});

	it("forwards className", () => {
		render(
			<MiniMapPage
				pageNumber={1}
				width={80}
				height={120}
				className="my-page"
			/>,
		);
		const el = screen.getByTestId("minimap-page");
		expect(el.className).toContain("my-page");
	});
});
