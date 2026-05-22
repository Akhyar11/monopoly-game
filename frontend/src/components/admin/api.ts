import { ADMIN_API_URL } from './constants';

export async function fetchAdmin<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: HeadersInit = {
    ...options?.headers,
    'Authorization': `Bearer ${token}`,
  };
  if (!isFormData) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${ADMIN_API_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Admin API error: ${res.status}`);
  }
  return res.json();
}
