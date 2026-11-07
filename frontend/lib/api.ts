const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// Tokens live exclusively in HttpOnly cookies set by the backend. They are
// never exposed to JavaScript, so there is no localStorage token surface for
// XSS to steal.
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

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return false;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

async function ensureCsrfToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = fetch(`${API_URL}/auth/csrf/`, {
      method: "GET",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        return data && data.csrfToken ? String(data.csrfToken) : null;
      })
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

function slashPath(path: string): string {
  const [base, query] = path.split("?", 2);
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return query ? `${normalized}?${query}` : normalized;
}

interface RequestOptions {
  path?: string;
  method?: string;
  body?: any;
  form?: FormData;
  auth?: boolean;
  retry?: boolean;
  headers?: Record<string, string>;
}

export async function request<T = any>(options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    form,
    auth = true,
    retry = true,
    headers = {},
  } = options;
  const isSafe = ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method);
  const finalHeaders: Record<string, string> = { Accept: "application/json", ...headers };
  if (!form && body !== undefined) finalHeaders["Content-Type"] = "application/json";

  if (!isSafe) {
    const token = await ensureCsrfToken();
    if (token) finalHeaders["X-CSRFToken"] = token;
  }

  const res = await fetch(`${API_URL}${slashPath(options.path ?? "/")}`, {
    method,
    headers: finalHeaders,
    body: form ? form : body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401 && auth && retry) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      return request<T>({ ...options, retry: false });
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("printora:logout"));
    }
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
    request<T>({ ...options, method: "GET", path }),
  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>({ ...options, method: "POST", path, body }),
  patch: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>({ ...options, method: "PATCH", path, body }),
  put: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>({ ...options, method: "PUT", path, body }),
  delete: <T = any>(path: string, options?: RequestOptions) =>
    request<T>({ ...options, method: "DELETE", path }),
  upload: <T = any>(path: string, form: FormData, options?: RequestOptions) =>
    request<T>({ ...options, method: "POST", path, form }),
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

export function onLogout(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("printora:logout", listener);
  return () => window.removeEventListener("printora:logout", listener);
}
