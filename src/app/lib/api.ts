export function getApiBase() {
  const env = (import.meta as any)?.env || {};
  const explicit = env.VITE_API_URL || env.VITE_API_BASE;
  if (explicit) return String(explicit).replace(/\/$/, '');

  if (env.DEV) {
    return 'http://localhost:3001';
  }

  // Production same-origin
  return '';
}
export function getApiBase() {
  const env = (import.meta as any)?.env || {};
  const explicit = env.VITE_API_URL || env.VITE_API_BASE;
  if (explicit) return String(explicit).replace(/\/$/, '');

  if (env.DEV) {
    return 'http://localhost:3001';
  }

  // Production: same-origin
  return '';
}

