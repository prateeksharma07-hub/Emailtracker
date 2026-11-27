/**
 * Unified API Client with credentials: 'include' for cookie-based session authentication
 * and automatic 401 unauthorized interception.
 */
export async function apiFetch(url, options = {}) {
  const mergedOptions = {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  };

  try {
    const res = await fetch(url, mergedOptions);
    if (res.status === 401 && !url.includes('/api/auth/me')) {
      window.dispatchEvent(new CustomEvent('mailmind:unauthorized', { detail: { url } }));
    }
    return res;
  } catch (err) {
    throw err;
  }
}

export default apiFetch;
