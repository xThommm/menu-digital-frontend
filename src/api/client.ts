import axios from 'axios'

// Lee la URL base desde .env  →  VITE_API_URL=http://localhost:3000/api
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor: adjunta el JWT en cada request privado automáticamente
// El token se guarda en localStorage al hacer login
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de respuesta: si el server devuelve 401, limpia la sesión
// Esto maneja tokens vencidos sin que cada componente lo tenga que chequear
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // El AuthContext reacciona al storage event si está en otra tab,
      // pero en la misma tab la recarga forzada es la opción más simple
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
