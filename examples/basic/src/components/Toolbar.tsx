import {
	CurrentPage,
	CurrentZoom,
	NextPage,
	PreviousPage,
	TotalPages,
	ZoomIn,
	ZoomOut,
} from "@anaralabs/lector";

export const HIGHLIGHT_COLORS = [
	{ name: "yellow", value: "rgba(250, 204, 21, 0.45)" },
	{ name: "green", value: "rgba(34, 197, 94, 0.45)" },
	{ name: "blue", value: "rgba(59, 130, 246, 0.45)" },
	{ name: "pink", value: "rgba(236, 72, 153, 0.45)" },
];

interface ToolbarProps {
	highlightColor: string;
	onHighlightColorChange: (color: string) => void;
	onClearHighlights: () => void;
	highlightCount: number;
	dark: boolean;
	onDarkChange: (dark: boolean) => void;
	leftPanel: "thumbnails" | "outline" | "search" | "off";
	onLeftPanelChange: (
		panel: "thumbnails" | "outline" | "search" | "off",
	) => void;
	miniMapVisible: boolean;
	onMiniMapVisibleChange: (visible: boolean) => void;
}

export function Toolbar({
	highlightColor,
	onHighlightColorChange,
	onClearHighlights,
	highlightCount,
	dark,
	onDarkChange,
	leftPanel,
	onLeftPanelChange,
	miniMapVisible,
	onMiniMapVisibleChange,
}: ToolbarProps) {
	return (
		<div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
			{/* Page nav */}
			<div className="flex items-center gap-1">
				<PreviousPage className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
					‹
				</PreviousPage>
				<span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
					<CurrentPage className="w-8 bg-transparent text-center outline-none" />
					/ <TotalPages />
				</span>
				<NextPage className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
					›
				</NextPage>
			</div>

			<span className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

			{/* Zoom */}
			<div className="flex items-center gap-1">
				<ZoomOut className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
					−
				</ZoomOut>
				<CurrentZoom className="w-12 rounded border border-gray-300 bg-white px-1 py-1 text-center text-xs dark:border-gray-600 dark:bg-gray-800" />
				<ZoomIn className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
					+
				</ZoomIn>
			</div>

			<span className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

			{/* Highlight color picker */}
			<div className="flex items-center gap-2">
				<span className="text-xs text-gray-500 dark:text-gray-400">
					Highlight:
				</span>
				<div className="flex items-center gap-1">
					{HIGHLIGHT_COLORS.map((c) => {
						const active = c.value === highlightColor;
						return (
							<button
								key={c.name}
								type="button"
								title={c.name}
								onClick={() => onHighlightColorChange(c.value)}
								className={`h-5 w-5 rounded-full border-2 transition ${
									active
										? "border-gray-900 dark:border-gray-100"
										: "border-transparent hover:border-gray-400"
								}`}
								style={{ backgroundColor: c.value }}
							/>
						);
					})}
				</div>
				<button
					type="button"
					onClick={onClearHighlights}
					disabled={highlightCount === 0}
					className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
				>
					Clear ({highlightCount})
				</button>
			</div>

			<div className="ml-auto flex items-center gap-2">
				{/* Left panel switcher */}
				<select
					value={leftPanel}
					onChange={(e) =>
						onLeftPanelChange(
							e.target.value as "thumbnails" | "outline" | "search" | "off",
						)
					}
					className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
				>
					<option value="thumbnails">Thumbnails</option>
					<option value="outline">Outline</option>
					<option value="search">Search</option>
					<option value="off">No left panel</option>
				</select>

				{/* MiniMap toggle */}
				<label className="flex items-center gap-1 text-xs">
					<input
						type="checkbox"
						checked={miniMapVisible}
						onChange={(e) => onMiniMapVisibleChange(e.target.checked)}
					/>
					MiniMap
				</label>

				{/* Dark mode */}
				<button
					type="button"
					onClick={() => onDarkChange(!dark)}
					className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
				>
					{dark ? "☀ Light" : "☾ Dark"}
				</button>
			</div>
		</div>
	);
}
