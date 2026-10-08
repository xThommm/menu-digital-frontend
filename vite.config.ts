import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Además de VITE_*, expone al cliente la config web de Firebase
  // (FIREBASE_API_KEY, FIREBASE_VAPID_KEY, etc.; ver src/lib/adminPush.ts).
  // OJO: todo lo que empiece con FIREBASE_ termina en el bundle público —
  // la cuenta de servicio (clave privada) va solo en el .env del backend.
  envPrefix: ['VITE_', 'FIREBASE_'],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // ← cambiá el puerto al de tu backend
        changeOrigin: true,
        ws: true, // WebSocket de reservas (/api/reservations/ws)
      }
    }
  }
})