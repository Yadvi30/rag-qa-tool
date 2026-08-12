export const API_BASE = 'http://localhost:8000'

/**
 * Thin wrapper around fetch: builds the full URL, sets JSON headers (unless
 * sending FormData), attaches the auth token if given, and throws on any
 * non-2xx response so callers can just try/catch instead of checking
 * res.ok everywhere.
 */
export async function apiFetch(path, { method = 'GET', body, token, isFormData = false } = {}) {
  const headers = {}
  if (!isFormData) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Request failed (${res.status})`)
  }
  return data
}
