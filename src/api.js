import axios from 'axios'

// 本地开发指向 9095，生产由 nginx 反代 /api/
const BASE = import.meta.env.VITE_API_BASE || '/api'

const client = axios.create({ baseURL: BASE })

// 自动带 JWT
client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('pl_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export const auth = {
  register: (username, password) =>
    client.post('/auth/register', { username, password }).then((r) => r.data),
  login: (username, password) =>
    client.post('/auth/login', { username, password }).then((r) => r.data),
  getSelf: () => client.get('/user/self').then((r) => r.data),
}

export const libraries = {
  list: () => client.get('/libraries').then((r) => r.data),
  create: (data) => client.post('/libraries', data).then((r) => r.data),
  get: (id) => client.get(`/libraries/${id}`).then((r) => r.data),
  update: (id, data) => client.put(`/libraries/${id}`, data).then((r) => r.data),
  del: (id) => client.delete(`/libraries/${id}`).then((r) => r.data),
}

export const entries = {
  list: (libId) => client.get(`/libraries/${libId}/entries`).then((r) => r.data),
  create: (libId, data) =>
    client.post(`/libraries/${libId}/entries`, data).then((r) => r.data),
  update: (libId, eid, data) =>
    client.put(`/libraries/${libId}/entries/${eid}`, data).then((r) => r.data),
  del: (libId, eid) =>
    client.delete(`/libraries/${libId}/entries/${eid}`).then((r) => r.data),
}

export const activelibsApi = {
  get: () => client.get('/active-libs').then((r) => r.data),
  put: (data) => client.put('/active-libs', data).then((r) => r.data),
}
