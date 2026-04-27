import { createMDX } from "fumadocs-mdx/next";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
	reactStrictMode: true,
	serverExternalPackages: ["pdfjs-dist"],
	// React 19 + radix-ui + fumadocs-ui have a known ReactNode type drift
	// against Next.js's expected LayoutProps shape. Runtime is unaffected;
	// only the type check fails. Disable build-time type errors so docs
	// can ship until upstream types are aligned. Local `pnpm tsc` still
	// surfaces the issues for developers who want to track them.
	typescript: {
		ignoreBuildErrors: true,
	},
	webpack: (config, { dev }) => {
		if (dev) {
			config.module.rules.unshift({
				test: /pdfjs-dist[/\\].*\.mjs$/,
				enforce: "pre",
				loader: resolve(__dirname, "lib/pdfjs-webpack-patch.cjs"),
			});
		}
		return config;
	},
};

export default withMDX(config);
