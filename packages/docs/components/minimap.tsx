"use client";

import {
	CanvasLayer,
	type ColoredHighlight,
	ColoredHighlightLayer,
	CurrentPage,
	MiniMap,
	MiniMapViewport,
	Page,
	Pages,
	Root,
	SelectionTooltip,
	TextLayer,
	TotalPages,
	usePdf,
	useSelectionDimensions,
} from "@anaralabs/lector";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

import "@/lib/setup";

const fileUrl = "/pdf/pathways.pdf";

const HIGHLIGHT_COLORS = [
	{ name: "yellow", value: "rgba(250, 204, 21, 0.45)" },
	{ name: "green", value: "rgba(34, 197, 94, 0.45)" },
	{ name: "blue", value: "rgba(59, 130, 246, 0.45)" },
	{ name: "pink", value: "rgba(236, 72, 153, 0.45)" },
];

function HighlightSelectionTool({ color }: { color: string }) {
	const dim = useSelectionDimensions();
	const addColoredHighlight = usePdf((s) => s.addColoredHighlight);

	const handleHighlight = (chosenColor: string) => {
		const d = dim.getDimension();
		if (!d || d.isCollapsed) return;
		const first = d.highlights[0];
		if (!first) return;
		addColoredHighlight({
			uuid: uuidv4(),
			color: chosenColor,
			pageNumber: first.pageNumber,
			rectangles: d.highlights,
			text: d.text,
		});
		window.getSelection()?.removeAllRanges();
	};

	return (
		<SelectionTooltip>
			<div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-lg">
				<button
					type="button"
					onClick={() => handleHighlight(color)}
					className="rounded-full px-3 py-1 text-xs font-medium hover:opacity-80"
					style={{ backgroundColor: color }}
				>
					Highlight
				</button>
				<div className="flex items-center gap-0.5 px-1">
					{HIGHLIGHT_COLORS.filter((c) => c.value !== color).map((c) => (
						<button
							key={c.name}
							type="button"
							title={c.name}
							onClick={() => handleHighlight(c.value)}
							className="h-4 w-4 rounded-full border border-gray-300 transition hover:scale-110"
							style={{ backgroundColor: c.value }}
						/>
					))}
				</div>
			</div>
		</SelectionTooltip>
	);
}

function HighlightsLog() {
	const highlights = usePdf((s) => s.coloredHighlights);
	if (highlights.length === 0) {
		return (
			<p className="text-xs text-gray-500">
				Drag-select text in the document, then click a color in the popup to add
				a highlight. Pills will appear in the MiniMap to the right.
			</p>
		);
	}
	return (
		<ul className="space-y-1 text-xs">
			{highlights.map((h) => (
				<li key={h.uuid} className="flex items-center gap-2">
					<span
						className="inline-block h-3 w-3 shrink-0 rounded"
						style={{ backgroundColor: h.color }}
					/>
					<span className="truncate text-gray-700">
						p{h.pageNumber} · {h.text.slice(0, 60)}
					</span>
				</li>
			))}
		</ul>
	);
}

const WithMiniMap = () => {
	const [color, setColor] = useState(HIGHLIGHT_COLORS[0]!.value);

	return (
		<Root
			source={fileUrl}
			className="bg-gray-100 border rounded-md overflow-hidden relative h-[700px] flex flex-col"
			loader={<div className="p-4">Loading...</div>}
		>
			{/* Toolbar */}
			<div className="bg-gray-100 border-b p-2 flex items-center gap-3 text-sm text-gray-600">
				<span className="font-medium">MiniMap demo</span>
				<span className="text-xs">
					Page{" "}
					<CurrentPage className="bg-white rounded-full px-2 py-0.5 border text-center" />
					/ <TotalPages />
				</span>
				<span className="flex-grow" />
				<span className="text-xs">Highlight color:</span>
				<div className="flex items-center gap-1">
					{HIGHLIGHT_COLORS.map((c) => (
						<button
							key={c.name}
							type="button"
							title={c.name}
							onClick={() => setColor(c.value)}
							className={`h-5 w-5 rounded-full border-2 transition ${
								c.value === color
									? "border-gray-900"
									: "border-transparent hover:border-gray-400"
							}`}
							style={{ backgroundColor: c.value }}
						/>
					))}
				</div>
			</div>

			{/* Body: viewer | minimap */}
			<div className="grid flex-1 grid-cols-[1fr_120px] overflow-hidden">
				<Pages className="p-4 overflow-auto">
					<Page>
						<CanvasLayer />
						<TextLayer />
						<ColoredHighlightLayer />
						<HighlightSelectionTool color={color} />
					</Page>
				</Pages>

				<aside className="flex flex-col border-l bg-white">
					<div className="border-b px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
						MiniMap
					</div>
					<div className="flex-1 overflow-y-auto p-2">
						<MiniMap
							width={104}
							gap={3}
							className="mx-auto bg-gray-50"
							onHighlightClick={(h: ColoredHighlight) => {
								// eslint-disable-next-line no-console
								console.info(
									`[MiniMap] jumped to highlight on page ${h.pageNumber}`,
								);
							}}
							renderViewport={({ top, height }) => (
								<MiniMapViewport
									top={top}
									height={height}
									className="border-2 border-blue-500/70"
									style={{ backgroundColor: "rgba(59, 130, 246, 0.18)" }}
								/>
							)}
						/>
					</div>
					<div className="max-h-40 overflow-y-auto border-t p-2">
						<HighlightsLog />
					</div>
				</aside>
			</div>
		</Root>
	);
};

export default WithMiniMap;
