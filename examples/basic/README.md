# lector demo (`examples/basic`)

A comprehensive single-page PDF viewer that exercises every public API of
`@anaralabs/lector`. Use it as a hands-on reference, a smoke test for
local changes to the library, or a starting point for your own viewer.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/anaralabs/lector/tree/main/examples/basic)

## Run

From the repository root:

```bash
pnpm install
pnpm --filter basic dev
```

Then open <http://localhost:5173>.

To produce a static, deployable artifact:

```bash
pnpm --filter basic build
pnpm --filter basic preview
```

The `build` output lands in `examples/basic/dist/` and is fully
self-contained — drop it on any static host (Netlify, Vercel, S3, GH
Pages) and it will run as-is.

## Features demonstrated

| Feature | UI surface | Lector API |
|---|---|---|
| Document loading + loader fallback | Header dropdown / file upload | `<Root source loader>` |
| Page virtualization | Main viewer | `<Pages>` |
| Page rendering | — | `<CanvasLayer>` |
| Text selection + copy | Drag-select in viewer | `<TextLayer>` |
| Internal + external links | Click in PDF | `<AnnotationLayer externalLinksEnabled jumpOptions>` |
| Form fields | Form sample | `<AnnotationLayer renderForms>` (default) |
| Search highlights | Left panel → Search | `<Search>`, `useSearch`, `<HighlightLayer>`, `calculateHighlightRects`, `usePdfJump.jumpToHighlightRects` |
| Persistent colored highlights | Drag-select → tooltip | `<ColoredHighlightLayer>`, `<SelectionTooltip>`, `useSelectionDimensions`, `usePdf((s) => s.addColoredHighlight)` |
| Page navigation | Toolbar arrows + page number input | `<CurrentPage>`, `<TotalPages>`, `<NextPage>`, `<PreviousPage>`, `usePdfJump.jumpToPage` |
| Zoom + zoom limits | Toolbar | `<ZoomIn>`, `<ZoomOut>`, `<CurrentZoom>`, `<Root zoomOptions>` |
| Thumbnails panel | Left panel → Thumbnails | `<Thumbnails>`, `<Thumbnail>` |
| Outline panel | Left panel → Outline | `<Outline>`, `<OutlineItem>`, `<OutlineChildItems>` |
| **MiniMap with colored highlight overlays + drag-scrub** | Right rail | `<MiniMap>`, `<MiniMapViewport>`, `useMiniMap` |
| Dark mode | Toolbar toggle | CSS filter inversion (per docs) |

## Sample PDFs included

| Sample | Best for |
|---|---|
| `pathways.pdf` | Long doc — minimap × colored-highlight pairing |
| `brochure.pdf` | Mixed page sizes |
| `form.pdf` | Form fields + AnnotationLayer |
| `links.pdf` | Internal + external links |

You can also upload your own PDF via the toolbar.

## Tips

- Highlight a passage, then watch a coloured pill appear in the
  MiniMap right rail at the corresponding vertical position. Click
  the pill to jump back to the source quote.
- Drag the blue scrubber on the MiniMap to scrub through the doc.
- Switch the left panel between Thumbnails / Outline / Search via the
  dropdown in the toolbar.
- Toggle dark mode with the moon/sun button.
- Press "Clear (n)" to drop all highlights and reset.

## Learn More

- [Lector Documentation](https://lector.dev/docs)
- [GitHub Repository](https://github.com/anaralabs/lector)
