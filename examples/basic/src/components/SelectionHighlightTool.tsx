import {
	SelectionTooltip,
	usePdf,
	useSelectionDimensions,
} from "@anaralabs/lector";
import { v4 as uuidv4 } from "uuid";
import { HIGHLIGHT_COLORS } from "./Toolbar";

interface SelectionHighlightToolProps {
	color: string;
}

export function SelectionHighlightTool({ color }: SelectionHighlightToolProps) {
	const selectionDimensions = useSelectionDimensions();
	const addColoredHighlight = usePdf((s) => s.addColoredHighlight);

	const handleHighlight = (chosenColor: string) => {
		const dim = selectionDimensions.getDimension();
		if (!dim || dim.isCollapsed) return;
		const first = dim.highlights[0];
		if (!first) return;
		addColoredHighlight({
			uuid: uuidv4(),
			color: chosenColor,
			pageNumber: first.pageNumber,
			rectangles: dim.highlights,
			text: dim.text,
		});
		// Clear native selection so the tooltip dismisses.
		window.getSelection()?.removeAllRanges();
	};

	return (
		<SelectionTooltip>
			<div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-lg dark:bg-gray-800">
				<button
					type="button"
					onClick={() => handleHighlight(color)}
					title="Highlight with current color"
					className="h-6 rounded-full px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
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
							className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition"
							style={{ backgroundColor: c.value }}
						/>
					))}
				</div>
			</div>
		</SelectionTooltip>
	);
}
