import {
	Outline,
	OutlineChildItems,
	OutlineItem,
	Search,
	Thumbnail,
	Thumbnails,
} from "@anaralabs/lector";
import { ExtractionPanel } from "./ExtractionPanel";
import { SearchPanel } from "./SearchPanel";

export type LeftPanelMode =
	| "thumbnails"
	| "outline"
	| "search"
	| "extract"
	| "off";

interface LeftPanelProps {
	mode: LeftPanelMode;
}

const MODE_TITLES: Record<Exclude<LeftPanelMode, "off">, string> = {
	thumbnails: "Thumbnails",
	outline: "Outline",
	search: "Search",
	extract: "Extract",
};

export function LeftPanel({ mode }: LeftPanelProps) {
	if (mode === "off") return null;

	return (
		<div className="flex h-full w-80 flex-col border-r border-paper-300 bg-paper-50 dark:border-ink-50 dark:bg-ink-200">
			<div className="border-b border-paper-300 px-3 py-2 font-display text-[11px] uppercase tracking-[0.18em] text-ink/60 dark:border-ink-50 dark:text-paper-100/60">
				{MODE_TITLES[mode]}
			</div>
			<div className="flex-1 overflow-y-auto">
				{mode === "thumbnails" && (
					<Thumbnails className="flex flex-col items-center gap-3 p-3">
						<Thumbnail className="w-48 cursor-pointer rounded border border-paper-300 transition hover:border-brass-500 hover:shadow-paper dark:border-ink-50 dark:hover:border-brass-300" />
					</Thumbnails>
				)}
				{mode === "outline" && (
					<Outline className="space-y-1 p-3 text-sm">
						<OutlineItem className="block cursor-pointer rounded px-2 py-1 hover:bg-paper-100 dark:hover:bg-ink-100">
							<OutlineChildItems className="ml-3 mt-1 space-y-0.5 border-l border-paper-300 pl-2 dark:border-ink-50" />
						</OutlineItem>
					</Outline>
				)}
				{mode === "search" && (
					<Search>
						<SearchPanel />
					</Search>
				)}
				{mode === "extract" && <ExtractionPanel visible />}
			</div>
		</div>
	);
}
