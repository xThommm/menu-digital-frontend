import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './styles/globals.css'

// QueryClient global — configuración base para todas las queries de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Datos "frescos" durante 2 minutos antes de refetch en background
      staleTime: 1000 * 60 * 2,
      // Reintenta una sola vez en caso de error (el default es 3)
      retry: 1,
      // No refetch al volver al tab — el menú del local no cambia tan seguido
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
