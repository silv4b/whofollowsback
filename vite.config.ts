import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { checkProfilePlugin } from './plugins/checkProfile.ts'

export default defineConfig({
  plugins: [react(), checkProfilePlugin()],
})