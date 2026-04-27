import type { ChangeEvent } from "react";

export interface PdfSample {
	id: string;
	label: string;
	url: string;
	description: string;
}

export const SAMPLE_PDFS: PdfSample[] = [
	{
		id: "pathways",
		label: "Pathways (research review)",
		url: "/pathways.pdf",
		description: "Long doc — best for thumbnails + minimap demo",
	},
	{
		id: "brochure",
		label: "Brochure (mixed layouts)",
		url: "/brochure.pdf",
		description: "Mixed page sizes for layout testing",
	},
	{
		id: "form",
		label: "Form (interactive fields)",
		url: "/form.pdf",
		description: "Test PDF form filling via AnnotationLayer",
	},
	{
		id: "links",
		label: "Links (internal + external)",
		url: "/links.pdf",
		description: "Internal page references and external URLs",
	},
];

interface PdfPickerProps {
	currentSampleId: string | null;
	onSampleChange: (sample: PdfSample) => void;
	onFileChange: (file: File) => void;
}

export function PdfPicker({
	currentSampleId,
	onSampleChange,
	onFileChange,
}: PdfPickerProps) {
	const handleSelect = (e: ChangeEvent<HTMLSelectElement>) => {
		const sample = SAMPLE_PDFS.find((s) => s.id === e.target.value);
		if (sample) onSampleChange(sample);
	};

	const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) onFileChange(file);
	};

	return (
		<div className="flex items-center gap-3">
			<label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
				Sample:
				<select
					value={currentSampleId ?? ""}
					onChange={handleSelect}
					className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				>
					{SAMPLE_PDFS.map((s) => (
						<option key={s.id} value={s.id}>
							{s.label}
						</option>
					))}
				</select>
			</label>
			<label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
				<span className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100">
					Upload PDF…
				</span>
				<input
					type="file"
					accept=".pdf"
					onChange={handleFile}
					className="hidden"
				/>
			</label>
		</div>
	);
}
