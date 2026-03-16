import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	build: {
		outDir: "dist/embed",
		emptyOutDir: true,
		lib: {
			entry: path.resolve(__dirname, "src/embed/main.tsx"),
			name: "OrchestraEmbed",
			fileName: () => "embed.js",
			formats: ["iife"],
		},
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
			},
		},
	},
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
});
