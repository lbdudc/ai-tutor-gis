import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  console.log('Building with env:', env.VITE_BACKEND_BASE_URL, env.VITE_N8N_WEBHOOK_URL)
  
  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    envDir: '.',  // Make sure Vite looks for .env files in the root directory
    build: {
      sourcemap: true
    },
    resolve: {
      alias: {
        // Ensure the Buffer polyfill is properly accessible
        buffer: 'buffer/'
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
          global: 'globalThis'
        }
      }
    }
  }
})