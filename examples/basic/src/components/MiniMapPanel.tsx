import {
	type ColoredHighlight,
	MiniMap,
	MiniMapViewport,
} from "@anaralabs/lector";

interface MiniMapPanelProps {
	width?: number;
}

export function MiniMapPanel({ width = 96 }: MiniMapPanelProps) {
	return (
		<aside className="hidden h-full w-28 shrink-0 border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:flex md:flex-col">
			<div className="border-b border-gray-200 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
				MiniMap
			</div>
			<div className="flex-1 overflow-y-auto p-2">
				<MiniMap
					width={width}
					gap={3}
					className="mx-auto bg-gray-50 dark:bg-gray-800"
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
		</aside>
	);
}
