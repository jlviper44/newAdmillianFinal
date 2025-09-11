import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { cloudflare } from "@cloudflare/vite-plugin"
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
    vuetify({ autoImport: true }),
		vueDevTools(),
		cloudflare(),
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		// Enable network access
		host: true, // This exposes to all network interfaces
		port: 5173, // You can change the port if needed
		// Remove proxy for /l routes - let Vue Router handle them
	},
  optimizeDeps: {
    exclude: [
      // Exclude CodeMirror packages to prevent bundling issues
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/commands',
      '@codemirror/search',
      '@codemirror/autocomplete'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split CodeMirror code into separate chunk
          codemirror: [
            'vue-codemirror',
            'codemirror',
            '@codemirror/autocomplete',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/search',
            '@codemirror/state',
            '@codemirror/view',
          ],
          'codemirror-lang': [
            '@codemirror/lang-html',
            '@codemirror/theme-one-dark'
          ]
        }
      }
    }
  }
});