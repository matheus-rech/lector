import {
	calculateHighlightRects,
	usePdf,
	usePdfJump,
	useSearch,
} from "@anaralabs/lector";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

export function SearchPanel() {
	const [query, setQuery] = useState("");
	const [debouncedQuery] = useDebounce(query, 250);
	const [limit, setLimit] = useState(20);
	const { searchResults, search } = useSearch();
	const { jumpToHighlightRects } = usePdfJump();
	const getPdfPageProxy = usePdf((s) => s.getPdfPageProxy);

	useEffect(() => {
		setLimit(20);
		void search(debouncedQuery, { limit: 20 });
	}, [debouncedQuery, search]);

	const handleResultClick = async (result: {
		pageNumber: number;
		text: string;
		matchIndex: number;
	}) => {
		const pageProxy = getPdfPageProxy(result.pageNumber);
		const rects = await calculateHighlightRects(pageProxy, {
			pageNumber: result.pageNumber,
			text: result.text,
			matchIndex: result.matchIndex,
			searchText: query,
		});
		jumpToHighlightRects(rects, "pixels");
	};

	const exact = searchResults?.exactMatches ?? [];
	const fuzzy = searchResults?.fuzzyMatches ?? [];
	const hasMore = searchResults?.hasMoreResults ?? false;
	const total = exact.length + fuzzy.length;

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-gray-200 p-3 dark:border-gray-700">
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search in document…"
					className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				/>
				{query && (
					<div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
						{total === 0
							? "No matches"
							: `${total} match${total === 1 ? "" : "es"}`}
					</div>
				)}
			</div>
			<div className="flex-1 overflow-y-auto">
				{exact.length > 0 && (
					<div className="px-3 py-2">
						<div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
							Exact matches
						</div>
						<ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
							{exact.map((result) => (
								<li key={`${result.pageNumber}-${result.matchIndex}`}>
									<button
										type="button"
										onClick={() => handleResultClick(result)}
										className="block w-full px-1 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										<div className="line-clamp-2 text-gray-800 dark:text-gray-200">
											{result.text}
										</div>
										<div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
											Page {result.pageNumber}
										</div>
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
				{fuzzy.length > 0 && (
					<div className="px-3 py-2">
						<div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
							Fuzzy matches
						</div>
						<ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
							{fuzzy.map((result) => (
								<li key={`fuzzy-${result.pageNumber}-${result.matchIndex}`}>
									<button
										type="button"
										onClick={() => handleResultClick(result)}
										className="block w-full px-1 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										<div className="line-clamp-2 text-gray-800 dark:text-gray-200">
											{result.text}
										</div>
										<div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
											Page {result.pageNumber}
										</div>
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
				{hasMore && (
					<button
						type="button"
						onClick={() => {
							const newLimit = limit + 20;
							setLimit(newLimit);
							void search(debouncedQuery, { limit: newLimit });
						}}
						className="m-3 w-[calc(100%-1.5rem)] rounded border border-gray-300 bg-white px-3 py-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
					>
						Load more
					</button>
				)}
			</div>
		</div>
	);
}
