import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from the backend directory and parent directory to resolve backend PORT
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../backend'), '');
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const port = backendEnv.PORT || rootEnv.PORT || process.env.PORT || '3001';
  const target = `http://localhost:${port}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/admin': {
          target,
          changeOrigin: true,
          bypass: (req) => {
            if (req.headers.accept?.includes('text/html')) {
              return '/index.html';
            }
          },
        },
        '/uploads': {
          target,
          changeOrigin: true,
        },
        '/socket.io': {
          target,
          ws: true,
        },
      },
    },
  };
})
