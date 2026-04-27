import { Root } from "@anaralabs/lector";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { FormValuesPanel } from "./components/FormValuesPanel";
import { LeftPanel, type LeftPanelMode } from "./components/LeftPanel";
import { MiniMapPanel } from "./components/MiniMapPanel";
import { PdfPicker, type PdfSample, SAMPLE_PDFS } from "./components/PdfPicker";
import { HIGHLIGHT_COLORS, Toolbar } from "./components/Toolbar";
import { Viewer } from "./components/Viewer";

export default function App() {
	const [sample, setSample] = useState<PdfSample>(SAMPLE_PDFS[0]!);
	const [uploadedSource, setUploadedSource] = useState<{
		url: string;
		name: string;
	} | null>(null);
	const [highlightColor, setHighlightColor] = useState<string>(
		HIGHLIGHT_COLORS[0]!.value,
	);
	const [highlightCount, setHighlightCount] = useState(0);
	const [dark, setDark] = useState(false);
	const [leftPanel, setLeftPanel] = useState<LeftPanelMode>("thumbnails");
	const [miniMapVisible, setMiniMapVisible] = useState(true);
	// `clearKey` is bumped to force <Root> to remount and reset coloredHighlights
	// (the store is per-Root). The simplest UX-correct way to "Clear all".
	const [clearKey, setClearKey] = useState(0);
	const [formValues, setFormValues] = useState<Record<string, string> | null>(
		null,
	);

	const isFormSample = !uploadedSource && sample.id === "form";
	const source = uploadedSource?.url ?? sample.url;
	const formId = useId();

	useEffect(() => {
		document.documentElement.classList.toggle("dark", dark);
		document.body.style.backgroundColor = dark ? "#0a0a0a" : "#f3f4f6";
	}, [dark]);

	// Reset highlight count when the document or clear-key changes; the
	// coloredHighlights store resets automatically because <Root key={...}>
	// remounts. The trigger-only deps are intentional.
	// biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only deps
	useEffect(() => {
		setHighlightCount(0);
	}, [source, clearKey]);

	const handleFileChange = (file: File) => {
		const url = URL.createObjectURL(file);
		setUploadedSource({ url, name: file.name });
	};

	const handleSampleChange = (next: PdfSample) => {
		setUploadedSource(null);
		setSample(next);
	};

	const handleClearHighlights = () => {
		setClearKey((n) => n + 1);
	};

	const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const entries = Array.from(fd.entries()).filter(
			([, v]) => v !== "" && v != null,
		);
		const obj: Record<string, string> = {};
		for (const [k, v] of entries) obj[k] = String(v);
		setFormValues(Object.keys(obj).length > 0 ? obj : null);
	};

	// Reset captured form values when document changes. `source` is the
	// trigger; the body doesn't read it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only dep
	useEffect(() => {
		setFormValues(null);
	}, [source]);

	const docTitle = uploadedSource?.name ?? sample.label;

	// Memoized to avoid re-creating on every render.
	const documentOptions = useMemo(() => ({}), []);

	return (
		<div
			className={`flex h-screen flex-col ${dark ? "dark" : ""}`}
			style={{ colorScheme: dark ? "dark" : "light" }}
		>
			<header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
				<div className="flex items-center gap-3">
					<h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
						lector demo
					</h1>
					<span className="text-xs text-gray-500 dark:text-gray-400">
						{docTitle}
					</span>
				</div>
				<div className="flex items-center gap-3">
					<PdfPicker
						currentSampleId={uploadedSource ? null : sample.id}
						onSampleChange={handleSampleChange}
						onFileChange={handleFileChange}
					/>
					<a
						href="https://github.com/anaralabs/lector"
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					>
						GitHub →
					</a>
				</div>
			</header>

			<Root
				key={`${source}-${clearKey}`}
				source={source}
				documentOptions={documentOptions}
				className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900"
				loader={
					<div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
						Loading {docTitle}…
					</div>
				}
				isZoomFitWidth
				zoomOptions={{ minZoom: 0.25, maxZoom: 6 }}
			>
				<HighlightCounter onChange={setHighlightCount} />
				<Toolbar
					highlightColor={highlightColor}
					onHighlightColorChange={setHighlightColor}
					onClearHighlights={handleClearHighlights}
					highlightCount={highlightCount}
					dark={dark}
					onDarkChange={setDark}
					leftPanel={leftPanel}
					onLeftPanelChange={setLeftPanel}
					miniMapVisible={miniMapVisible}
					onMiniMapVisibleChange={setMiniMapVisible}
				/>

				<div className="flex flex-1 overflow-hidden">
					<LeftPanel mode={leftPanel} />
					{isFormSample ? (
						<form
							id={formId}
							onSubmit={handleFormSubmit}
							className="flex flex-1 overflow-hidden"
						>
							<Viewer dark={dark} highlightColor={highlightColor} />
						</form>
					) : (
						<Viewer dark={dark} highlightColor={highlightColor} />
					)}
					{miniMapVisible && <MiniMapPanel />}
					<FormValuesPanel
						visible={isFormSample}
						values={formValues}
						formId={formId}
					/>
				</div>
			</Root>
		</div>
	);
}

// Lightweight bridge to surface coloredHighlights count to the toolbar.
import { usePdf } from "@anaralabs/lector";

function HighlightCounter({ onChange }: { onChange: (n: number) => void }) {
	const count = usePdf((s) => s.coloredHighlights.length);
	useEffect(() => {
		onChange(count);
	}, [count, onChange]);
	return null;
}
