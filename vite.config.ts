import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-oxc'

export default defineConfig({
  plugins: [react()],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
