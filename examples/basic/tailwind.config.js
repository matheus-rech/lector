/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				display: [
					'"Fraunces"',
					"ui-serif",
					"Georgia",
					"Cambria",
					'"Times New Roman"',
					"serif",
				],
				sans: [
					'"IBM Plex Sans"',
					"ui-sans-serif",
					"system-ui",
					"-apple-system",
					'"Segoe UI"',
					"sans-serif",
				],
				mono: [
					'"JetBrains Mono"',
					"ui-monospace",
					'"SF Mono"',
					"Menlo",
					"monospace",
				],
			},
			colors: {
				// Warm editorial palette — paper, ink, brass.
				paper: {
					50: "#FBF8F2",
					100: "#F5EFE3",
					200: "#EBE3D1",
					300: "#DACFB8",
					DEFAULT: "#F5EFE3",
				},
				ink: {
					50: "#3A3833",
					100: "#28261F",
					200: "#1A1814",
					300: "#0F0E0A",
					DEFAULT: "#1A1814",
				},
				brass: {
					50: "#F4ECD8",
					100: "#E8D6A8",
					300: "#C99A4F",
					500: "#A4731F",
					600: "#8A5E14",
					700: "#704A0E",
				},
			},
			boxShadow: {
				paper:
					"0 1px 0 rgba(26, 24, 20, 0.04), 0 4px 18px -6px rgba(26, 24, 20, 0.10)",
				inset:
					"inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 0 rgba(26, 24, 20, 0.04)",
			},
		},
	},
	plugins: [],
};
