import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import "./pdf_viewer.parcel.css";

/**
 * Configure PDF.js's worker. Must run once at module init before any
 * <Root> mounts. Imported for side-effects from main.tsx.
 */
GlobalWorkerOptions.workerSrc = new URL(
	"npm:pdfjs-dist/legacy/build/pdf.worker.mjs",
	import.meta.url,
).toString();
