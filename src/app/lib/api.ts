export function getApiBase() {
  const envBase = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_API_BASE;
  if (envBase) return String(envBase).replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    return origin;
  }

  // Fallback to same-origin
  return '';
}

