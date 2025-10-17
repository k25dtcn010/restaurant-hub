import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

/**
 * Vite configuration for React 18+ with bundle size optimization
 * Reference: research.md Section 8 - Performance Optimization Strategies
 *
 * Performance goals:
 * - Bundle size < 500KB gzipped
 * - Time to Interactive (TTI) < 3s on 3G
 * - Code splitting for optimal loading
 */
export default defineConfig({
	plugins: [tailwindcss(), tanstackRouter({}), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		// Code splitting for better caching and faster initial load
		rollupOptions: {
			output: {
				manualChunks: {
					// Separate vendor chunks for better caching
					react: ["react", "react-dom"],
					router: ["@tanstack/react-router"],
					trpc: ["@trpc/client", "@trpc/react-query"],
					ui: ["@radix-ui/react-dropdown-menu", "@radix-ui/react-slot"],
				},
			},
		},
		// Target modern browsers for smaller bundle size
		target: "es2022",
		// Minify with terser for better compression
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true, // Remove console.log in production
				dead_code: true,
			},
		},
		// Warn if chunk size exceeds 500KB
		chunkSizeWarningLimit: 500,
	},
	server: {
		// Dev server configuration
		port: 3001,
		proxy: {
			// Proxy API requests to backend during development
			"/trpc": {
				target: process.env.VITE_SERVER_URL || "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});
