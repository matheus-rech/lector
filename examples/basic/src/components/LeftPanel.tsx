import {
	Outline,
	OutlineChildItems,
	OutlineItem,
	Search,
	Thumbnail,
	Thumbnails,
} from "@anaralabs/lector";
import { SearchPanel } from "./SearchPanel";

interface LeftPanelProps {
	mode: "thumbnails" | "outline" | "search" | "off";
}

export function LeftPanel({ mode }: LeftPanelProps) {
	if (mode === "off") return null;

	return (
		<div className="flex h-full w-72 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
			<div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
				{mode === "thumbnails" && "Thumbnails"}
				{mode === "outline" && "Outline"}
				{mode === "search" && "Search"}
			</div>
			<div className="flex-1 overflow-y-auto">
				{mode === "thumbnails" && (
					<Thumbnails className="flex flex-col items-center gap-3 p-3">
						<Thumbnail className="w-48 cursor-pointer rounded border border-gray-200 transition hover:border-blue-400 hover:shadow-md dark:border-gray-700" />
					</Thumbnails>
				)}
				{mode === "outline" && (
					<Outline className="space-y-1 p-3 text-sm">
						<OutlineItem className="block cursor-pointer rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
							<OutlineChildItems className="ml-3 mt-1 space-y-0.5 border-l border-gray-200 pl-2 dark:border-gray-700" />
						</OutlineItem>
					</Outline>
				)}
				{mode === "search" && (
					<Search>
						<SearchPanel />
					</Search>
				)}
			</div>
		</div>
	);
}
