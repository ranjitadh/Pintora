const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const ACCESS_KEY = "printora_access";
const REFRESH_KEY = "printora_refresh";
const USER_KEY = "printora_user";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function cachedUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheUser(user: any) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function slashPath(path: string): string {
  const [base, query] = path.split("?", 2);
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return query ? `${normalized}?${query}` : normalized;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.access) return false;
        setTokens(data.access);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: any;
  form?: FormData;
  auth?: boolean;
  retry?: boolean;
  headers?: Record<string, string>;
}

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, auth = true, retry = true, headers = {} } = options;
  const finalHeaders: Record<string, string> = { Accept: "application/json", ...headers };
  if (!form && body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${slashPath(path)}`, {
    method,
    headers: finalHeaders,
    body: form ? form : body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (res.status === 401 && auth && retry && getRefreshToken()) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      return request<T>(path, { ...options, retry: false });
    }
    clearSession();
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      (typeof data === "string" && data) ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T = any>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  upload: <T = any>(path: string, form: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", form }),
};

export function mediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/media/")) return parsed.pathname;
  } catch {
    // Relative URLs pass through untouched.
  }
  return url.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, "");
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
