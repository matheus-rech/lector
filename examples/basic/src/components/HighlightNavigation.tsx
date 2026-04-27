import { usePdf, usePdfJump } from "@anaralabs/lector";
import { useCallback, useState } from "react";

/**
 * Prev/next buttons that cycle through colored highlights using
 * usePdfJump.jumpToHighlightRects. Renders nothing when there are no
 * highlights yet.
 */
export function HighlightNavigation() {
	const highlights = usePdf((s) => s.coloredHighlights);
	const { jumpToHighlightRects } = usePdfJump();
	const [currentIndex, setCurrentIndex] = useState(-1);

	const jumpTo = useCallback(
		(idx: number) => {
			const h = highlights[idx];
			if (!h) return;
			const type = h.rectangles[0]?.type ?? "pixels";
			jumpToHighlightRects(h.rectangles, type, "center");
			setCurrentIndex(idx);
		},
		[highlights, jumpToHighlightRects],
	);

	const prev = useCallback(() => {
		if (highlights.length === 0) return;
		const next = currentIndex <= 0 ? highlights.length - 1 : currentIndex - 1;
		jumpTo(next);
	}, [highlights.length, currentIndex, jumpTo]);

	const next = useCallback(() => {
		if (highlights.length === 0) return;
		const nextIdx =
			currentIndex >= highlights.length - 1 ? 0 : currentIndex + 1;
		jumpTo(nextIdx);
	}, [highlights.length, currentIndex, jumpTo]);

	if (highlights.length === 0) return null;

	const displayIndex =
		currentIndex >= 0 && currentIndex < highlights.length
			? currentIndex + 1
			: "—";

	return (
		<div className="flex items-center gap-1">
			<span className="text-xs text-gray-500 dark:text-gray-400">Hi:</span>
			<button
				type="button"
				onClick={prev}
				title="Previous highlight"
				className="rounded border border-gray-300 bg-white px-2 py-1 text-xs leading-none hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
			>
				↑
			</button>
			<span className="inline-flex min-w-[3.5rem] justify-center rounded bg-gray-100 px-2 py-1 text-[11px] tabular-nums dark:bg-gray-800">
				{displayIndex} / {highlights.length}
			</span>
			<button
				type="button"
				onClick={next}
				title="Next highlight"
				className="rounded border border-gray-300 bg-white px-2 py-1 text-xs leading-none hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
			>
				↓
			</button>
		</div>
	);
}
