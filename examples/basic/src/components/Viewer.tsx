import {
	AnnotationLayer,
	CanvasLayer,
	ColoredHighlightLayer,
	HighlightLayer,
	Page,
	Pages,
	TextLayer,
} from "@anaralabs/lector";
import { SelectionHighlightTool } from "./SelectionHighlightTool";

interface ViewerProps {
	dark: boolean;
	highlightColor: string;
}

export function Viewer({ dark, highlightColor }: ViewerProps) {
	return (
		<Pages
			className={`flex-1 overflow-auto bg-gray-100 p-4 dark:bg-gray-950 ${
				dark
					? "[&_.colored-highlights-layer_*]:!mix-blend-screen invert-[94%] hue-rotate-180 brightness-[80%] contrast-[228%]"
					: ""
			}`}
		>
			<Page>
				<CanvasLayer />
				<TextLayer />
				<AnnotationLayer
					externalLinksEnabled
					jumpOptions={{ behavior: "smooth", align: "start" }}
				/>
				<HighlightLayer className="bg-yellow-300/60 mix-blend-darken" />
				<ColoredHighlightLayer />
				<SelectionHighlightTool color={highlightColor} />
			</Page>
		</Pages>
	);
}
