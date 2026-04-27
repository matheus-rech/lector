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
 * Schema-driven structured-data extraction from PDF text.
 *
 * Workflow:
 *   1. Paste a JSON schema describing the fields you want to extract.
 *      Field types are: string | number | boolean | string[].
 *   2. For each field, drag-select the relevant text in the PDF, then
 *      click "Capture" — the selection text is coerced to the field's
 *      type and stored in the result.
 *   3. The resulting JSON appears at the bottom; copy it to clipboard
 *      with one click and paste into your downstream pipeline (RoB
 *      assessment, meta-analysis, paper-extraction agent, etc.).
 */
export function ExtractionPanel({ visible }: ExtractionPanelProps) {
	const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
	const [values, setValues] = useState<
		Record<string, Primitive | string[] | null>
	>({});
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
			setValues((prev) => ({
				...prev,
				[field]: coerceValue(d.text, type),
			}));
			window.getSelection()?.removeAllRanges();
			setActiveField(null);
		},
		[dim],
	);

	const clearField = (field: string) =>
		setValues((prev) => {
			const next = { ...prev };
			delete next[field];
			return next;
		});

	const clearAll = () => setValues({});

	const result = useMemo(() => {
		if (!schema) return null;
		const out: Record<string, Primitive | string[] | null> = {};
		for (const k of Object.keys(schema)) {
			out[k] = values[k] ?? null;
		}
		return out;
	}, [schema, values]);

	const copyResult = async () => {
		if (!result) return;
		await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 1400);
	};

	if (!visible) return null;

	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-paper-300 px-3 py-2 dark:border-ink-50">
				<div className="font-display text-[11px] uppercase tracking-[0.18em] text-ink/60 dark:text-paper-100/60">
					Extraction Schema
				</div>
				<p className="mt-1 text-[11px] leading-relaxed text-ink-50 dark:text-paper-100/70">
					Paste a flat JSON schema. Drag-select text in the PDF, then click a
					field's <em className="not-italic font-semibold">Capture</em> to fill
					it.
				</p>
			</div>

			{/* Schema editor */}
			<div className="border-b border-paper-300 dark:border-ink-50">
				<textarea
					value={schemaText}
					onChange={(e) => setSchemaText(e.target.value)}
					rows={6}
					spellCheck={false}
					className="w-full resize-y bg-paper-100 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink outline-none focus:bg-paper-50 dark:bg-ink-100 dark:text-paper-100 dark:focus:bg-ink-200"
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
					<ul className="divide-y divide-paper-300 dark:divide-ink-50">
						{Object.entries(schema).map(([field, type]) => {
							const val = values[field];
							const filled = val !== undefined && val !== null;
							const isActive = activeField === field;
							return (
								<li
									key={field}
									className={`px-3 py-2 ${isActive ? "bg-brass-50 dark:bg-brass-700/20" : ""}`}
								>
									<div className="flex items-baseline justify-between gap-2">
										<span className="font-mono text-[11px] font-semibold text-ink dark:text-paper-100">
											{field}
										</span>
										<span className="font-mono text-[10px] text-ink-50 dark:text-paper-100/50">
											{type}
										</span>
									</div>
									<div className="mt-1 flex items-center gap-1">
										<button
											type="button"
											onClick={() => captureField(field, type)}
											className="rounded border border-brass-500/40 bg-brass-50 px-2 py-0.5 text-[10px] text-brass-700 hover:bg-brass-100 dark:border-brass-300/40 dark:bg-brass-700/30 dark:text-brass-100 dark:hover:bg-brass-700/50"
										>
											{isActive ? "Select text…" : "Capture"}
										</button>
										{filled ? (
											<button
												type="button"
												onClick={() => clearField(field)}
												className="rounded px-1 text-[10px] text-ink-50 hover:text-ink dark:text-paper-100/50 dark:hover:text-paper-100"
											>
												✕
											</button>
										) : null}
									</div>
									{filled ? (
										<div className="mt-1 max-h-16 overflow-y-auto rounded bg-paper-50 p-1.5 font-mono text-[10px] leading-snug text-ink dark:bg-ink-200 dark:text-paper-100">
											{Array.isArray(val)
												? val.map((s, i) => (
														<div
															key={`${field}-${i}-${s}`}
															className="truncate"
														>
															• {s}
														</div>
													))
												: String(val)}
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				) : null}
			</div>

			{/* Result JSON */}
			{schema ? (
				<div className="border-t border-paper-300 dark:border-ink-50">
					<div className="flex items-center justify-between px-3 py-1.5">
						<span className="font-display text-[10px] uppercase tracking-[0.18em] text-ink/60 dark:text-paper-100/60">
							Result
						</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={clearAll}
								disabled={Object.keys(values).length === 0}
								className="rounded px-1.5 py-0.5 text-[10px] text-ink-50 hover:text-ink disabled:opacity-30 dark:text-paper-100/50 dark:hover:text-paper-100"
							>
								Reset
							</button>
							<button
								type="button"
								onClick={copyResult}
								className="rounded border border-brass-500/40 bg-brass-50 px-1.5 py-0.5 text-[10px] text-brass-700 hover:bg-brass-100 dark:border-brass-300/40 dark:bg-brass-700/30 dark:text-brass-100 dark:hover:bg-brass-700/50"
							>
								{copied ? "Copied" : "Copy JSON"}
							</button>
						</div>
					</div>
					<pre className="max-h-32 overflow-auto bg-paper-100 px-3 py-2 font-mono text-[10px] leading-snug text-ink dark:bg-ink-100 dark:text-paper-100">
						{result ? JSON.stringify(result, null, 2) : ""}
					</pre>
				</div>
			) : null}
		</div>
	);
}
