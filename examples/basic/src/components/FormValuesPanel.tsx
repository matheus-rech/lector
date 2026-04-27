interface FormValuesPanelProps {
	visible: boolean;
	values: Record<string, string> | null;
	/** id of the wrapping <form> in App.tsx — used by the Capture button's
	 *  `form` attribute to submit the right form via HTML form-association. */
	formId: string;
}

const formatFieldName = (fieldName: string) =>
	fieldName
		.replace(/\[\d+\]/g, "")
		.split(/[_\s]+/)
		.filter(Boolean)
		.map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : ""))
		.join(" ");

/**
 * Side panel for the Form sample. The actual `<form id="pdf-form-capture">`
 * wraps the Viewer in App.tsx — this panel only renders the Capture
 * button (form-associated via the `form` attribute) and the captured
 * values list.
 *
 * Per the lector docs (PDF Form page): `AnnotationLayer` renders form
 * fields as native DOM inputs, so the wrapping <form> can collect them
 * with `new FormData(...)`.
 */
export function FormValuesPanel({
	visible,
	values,
	formId,
}: FormValuesPanelProps) {
	if (!visible) return null;
	const filled = values ? Object.entries(values) : [];

	return (
		<aside className="hidden h-full w-72 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:flex">
			<div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
				<span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Form Values
				</span>
				<button
					form={formId}
					type="submit"
					className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
				>
					Capture
				</button>
			</div>
			<div className="flex-1 overflow-y-auto p-3">
				{filled.length === 0 ? (
					<p className="text-xs text-gray-500 dark:text-gray-400">
						Fill in any field on the PDF (text boxes, checkboxes, dropdowns),
						then press <strong>Capture</strong> to read its value here.
					</p>
				) : (
					<ul className="space-y-2">
						{filled.map(([k, v]) => (
							<li
								key={k}
								className="rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-800"
							>
								<div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
									{formatFieldName(k)}
								</div>
								<div className="break-all text-gray-800 dark:text-gray-200">
									{v}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</aside>
	);
}
