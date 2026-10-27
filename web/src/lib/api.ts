import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, any> = {}) {
    super(message);
  }
}

/** Fired after any successful change so open views can refresh. */
export const DATA_CHANGED = "crm:changed";

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export async function api<T = any>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method,
      // The server rejects writes without this header (CSRF defence).
      headers: { "X-CRM-Request": "1", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login") onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data);
  if (method !== "GET") window.dispatchEvent(new Event(DATA_CHANGED));
  return data as T;
}

// Last response per GET path, so revisiting a page renders instantly and refreshes in the background.
const cache = new Map<string, unknown>();

/** Loads data, and reloads whenever deps change or any change is saved elsewhere. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], { live = true, key }: { live?: boolean; key?: string } = {}) {
  const [data, setData] = useState<T | null>(() => (key && cache.has(key) ? (cache.get(key) as T) : null));
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  // Only the latest request may update state; a slow earlier response can't overwrite a newer one.
  const seq = useRef(0);

  // When the key changes (another record), show its cached copy right away instead of the previous one.
  const lastKey = useRef(key);
  if (key !== lastKey.current) {
    lastKey.current = key;
    const cached = key && cache.has(key) ? (cache.get(key) as T) : null;
    if (cached !== data) setData(cached);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => {
    const n = ++seq.current;
    return loadRef
      .current()
      .then((d) => {
        if (n !== seq.current) return;
        if (key) cache.set(key, d);
        setData(d);
        setError(null);
      })
      .catch((e: Error) => {
        if (n === seq.current) setError(e.message);
      });
  }, [...deps, key]);

  useEffect(() => {
    reload();
    if (!live) return;
    window.addEventListener(DATA_CHANGED, reload);
    return () => window.removeEventListener(DATA_CHANGED, reload);
  }, [reload, live]);

  return { data, error, reload, setData };
}

/** GET a path with caching: the path is the cache key. */
export function useApi<T>(path: string, opts: { live?: boolean } = {}) {
  return useLoad(() => api<T>(path), [path], { ...opts, key: path });
}

/** Clears cached pages (on logout, so the next user never sees them). */
export function clearCache() {
  cache.clear();
}

/** Persists a small piece of UI state per browser. */
export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  );
  return [value, set];
}
