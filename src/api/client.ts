import axios from 'axios'

// Lee la URL base desde .env  →  VITE_API_URL=http://localhost:3000/api
//
// Sin `Content-Type` por defecto a propósito. Axios ya lo resuelve solo: su
// `transformRequest` le pone 'application/json' a cualquier body que sea un
// objeto plano, y ante un FormData borra el header para que lo escriba el
// browser con su boundary.
//
// Fijarlo acá era peor que redundante. Axios 1.x, si ve un content-type JSON
// con un body FormData, hace JSON.stringify(formDataToJSON(data)): cada subida
// de archivo que no pisara el header a mano mandaba {"archivo":{}} y el archivo
// no llegaba nunca. Se venía tapando archivo por archivo con un
// 'multipart/form-data' explícito, y el próximo upload que se agregara sin
// acordarse iba a fallar igual, con un síntoma que no señala la causa.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
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
      localStorage.removeItem('tokenExpiry')
      // No hay sincronización entre pestañas (no se escucha el evento
      // `storage`): esta redirección solo limpia la sesión de esta pestaña.
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
