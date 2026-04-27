import { useSelectionDimensions } from "@anaralabs/lector";
import { useCallback, useMemo, useState } from "react";

const DEFAULT_SCHEMA = `{
  "title": "string",
  "doi": "string",
  "authors": "string[]",
  "abstract": "string",
  "year": "number",
  "keywords": "string[]"
}`;

type Primitive = string | number | boolean | null;
type SchemaShape = Record<string, "string" | "number" | "boolean" | "string[]">;

interface CapturedField {
	value: Primitive | string[] | null;
	sourceQuote: string;
	pageReference: string;
}

interface ProvenanceEntry {
	field: string;
	sourceQuote: string;
	pageReference: string;
}

const parseSchema = (
	raw: string,
): { schema: SchemaShape | null; error: string | null } => {
	try {
		const parsed = JSON.parse(raw);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			return { schema: null, error: "Schema must be a flat JSON object" };
		}
		const out: SchemaShape = {};
		for (const [k, v] of Object.entries(parsed)) {
			if (
				v !== "string" &&
				v !== "number" &&
				v !== "boolean" &&
				v !== "string[]"
			) {
				return {
					schema: null,
					error: `Field "${k}" must be one of: string | number | boolean | string[]`,
				};
			}
			out[k] = v;
		}
		return { schema: out, error: null };
	} catch (e) {
		return { schema: null, error: (e as Error).message };
	}
};

const coerceValue = (
	raw: string,
	type: SchemaShape[string],
): Primitive | string[] => {
	if (type === "string") return raw;
	if (type === "number") {
		const n = Number(raw.replace(/[^\d.eE+-]/g, ""));
		return Number.isFinite(n) ? n : null;
	}
	if (type === "boolean") {
		return /^(true|yes|y|1)$/i.test(raw.trim());
	}
	// string[]: split on common separators
	return raw
		.split(/[\n;,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
};

interface ExtractionPanelProps {
	visible: boolean;
}

/**
 * Schema-driven structured-data extraction from PDF text — with built-in
 * provenance tracking compatible with the `provenance-highlighter` skill.
 *
 * Workflow:
 *   1. Paste a flat JSON schema.
 *   2. Drag-select text in the PDF, click a field's "Capture" button.
 *      The component records the coerced value PLUS the exact source
 *      quote and the page number it came from.
 *   3. Export the result. The exported JSON has the standard
 *      `{field: value}` shape plus a top-level `Provenance` array. Pipe
 *      that file into:
 *
 *        python3.13 ~/.claude/skills/provenance-highlighter/scripts/\
 *          highlight_provenance.py extracted.json paper.pdf
 *
 *      …to produce a colour-coded annotated PDF with field-keyed
 *      highlights for audit-grade systematic review extraction.
 */
export function ExtractionPanel({ visible }: ExtractionPanelProps) {
	const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
	const [captured, setCaptured] = useState<Record<string, CapturedField>>({});
	const [activeField, setActiveField] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const dim = useSelectionDimensions();

	const { schema, error } = useMemo(
		() => parseSchema(schemaText),
		[schemaText],
	);

	const captureField = useCallback(
		(field: string, type: SchemaShape[string]) => {
			const d = dim.getDimension();
			if (!d || d.isCollapsed || !d.text.trim()) {
				setActiveField(field);
				return;
			}
			const sourceQuote = d.text.trim();
			const pageNumbers = Array.from(
				new Set(d.highlights.map((h) => h.pageNumber)),
			).sort((a, b) => a - b);
			const pageReference =
				pageNumbers.length === 0
					? "p.?"
					: pageNumbers.length === 1
						? `p.${pageNumbers[0]}`
						: `pp.${pageNumbers[0]}-${pageNumbers[pageNumbers.length - 1]}`;
			setCaptured((prev) => ({
				...prev,
				[field]: {
					value: coerceValue(sourceQuote, type),
					sourceQuote,
					pageReference,
				},
			}));
			window.getSelection()?.removeAllRanges();
			setActiveField(null);
		},
		[dim],
	);

	const clearField = (field: string) =>
		setCaptured((prev) => {
			const next = { ...prev };
			delete next[field];
			return next;
		});

	const clearAll = () => setCaptured({});

	const result = useMemo(() => {
		if (!schema) return null;
		const out: Record<string, Primitive | string[] | null> = {};
		const provenance: ProvenanceEntry[] = [];
		for (const k of Object.keys(schema)) {
			const c = captured[k];
			out[k] = c?.value ?? null;
			if (c) {
				provenance.push({
					field: k,
					sourceQuote: c.sourceQuote,
					pageReference: c.pageReference,
				});
			}
		}
		return { ...out, Provenance: provenance };
	}, [schema, captured]);

	const copyResult = async () => {
		if (!result) return;
		await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 1400);
	};

	const downloadResult = () => {
		if (!result) return;
		const blob = new Blob([JSON.stringify(result, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "extraction.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	if (!visible) return null;

	const provenanceCount = result?.Provenance?.length ?? 0;

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
				<p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
					Paste a flat JSON schema. Drag-select text in the PDF, then click a
					field's <em className="not-italic font-semibold">Capture</em> to fill
					it. Each capture also records the source quote + page for{" "}
					<a
						href="https://github.com/matheus-rech/lector/blob/main/.claude/skills/provenance-highlighter/SKILL.md"
						target="_blank"
						rel="noopener noreferrer"
						className="underline decoration-dotted hover:text-blue-600 dark:hover:text-blue-400"
					>
						provenance highlighting
					</a>
					.
				</p>
			</div>

			{/* Schema editor */}
			<div className="border-b border-gray-200 dark:border-gray-700">
				<textarea
					value={schemaText}
					onChange={(e) => setSchemaText(e.target.value)}
					rows={6}
					spellCheck={false}
					className="w-full resize-y bg-gray-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-800 outline-none focus:bg-white dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-900"
				/>
				{error ? (
					<p className="px-3 py-1 text-[10px] text-red-700 dark:text-red-400">
						{error}
					</p>
				) : null}
			</div>

			{/* Field capture list */}
			<div className="flex-1 overflow-y-auto">
				{schema ? (
					<ul className="divide-y divide-gray-200 dark:divide-gray-700">
						{Object.entries(schema).map(([field, type]) => {
							const c = captured[field];
							const filled = c !== undefined;
							const isActive = activeField === field;
							return (
								<li
									key={field}
									className={`px-3 py-2 ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
								>
									<div className="flex items-baseline justify-between gap-2">
										<span className="font-mono text-[11px] font-semibold text-gray-800 dark:text-gray-100">
											{field}
										</span>
										<span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
											{type}
										</span>
									</div>
									<div className="mt-1 flex items-center gap-1">
										<button
											type="button"
											onClick={() => captureField(field, type)}
											className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
										>
											{isActive ? "Select text…" : "Capture"}
										</button>
										{filled ? (
											<>
												<span className="font-mono text-[9px] text-gray-500 dark:text-gray-400">
													{c.pageReference}
												</span>
												<button
													type="button"
													onClick={() => clearField(field)}
													className="ml-auto rounded px-1 text-[10px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
												>
													✕
												</button>
											</>
										) : null}
									</div>
									{filled ? (
										<>
											<div className="mt-1 max-h-16 overflow-y-auto rounded bg-gray-50 p-1.5 font-mono text-[10px] leading-snug text-gray-800 dark:bg-gray-800 dark:text-gray-100">
												{Array.isArray(c.value)
													? c.value.map((s, i) => (
															<div
																key={`${field}-${i}-${s}`}
																className="truncate"
															>
																• {s}
															</div>
														))
													: String(c.value)}
											</div>
											<details className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
												<summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
													source quote
												</summary>
												<blockquote className="mt-1 border-l-2 border-yellow-400 bg-yellow-50/40 px-2 py-1 italic leading-snug dark:bg-yellow-900/10">
													{c.sourceQuote}
												</blockquote>
											</details>
										</>
									) : null}
								</li>
							);
						})}
					</ul>
				) : null}
			</div>

			{/* Result JSON + Provenance */}
			{schema ? (
				<div className="border-t border-gray-200 dark:border-gray-700">
					<div className="flex items-center justify-between px-3 py-1.5">
						<span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Result · Provenance ({provenanceCount})
						</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={clearAll}
								disabled={Object.keys(captured).length === 0}
								className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30 dark:text-gray-400 dark:hover:text-gray-100"
							>
								Reset
							</button>
							<button
								type="button"
								onClick={copyResult}
								className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
							>
								{copied ? "Copied" : "Copy"}
							</button>
							<button
								type="button"
								onClick={downloadResult}
								disabled={provenanceCount === 0}
								className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50 disabled:opacity-30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
							>
								Download
							</button>
						</div>
					</div>
					<pre className="max-h-32 overflow-auto bg-gray-50 px-3 py-2 font-mono text-[10px] leading-snug text-gray-800 dark:bg-gray-800 dark:text-gray-100">
						{result ? JSON.stringify(result, null, 2) : ""}
					</pre>
				</div>
			) : null}
		</div>
	);
}
