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
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
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

/** Loads data, and reloads whenever deps change or any change is saved elsewhere. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], { live = true } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(
    () =>
      loadRef
        .current()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    deps,
  );

  useEffect(() => {
    reload();
    if (!live) return;
    window.addEventListener(DATA_CHANGED, reload);
    return () => window.removeEventListener(DATA_CHANGED, reload);
  }, [reload, live]);

  return { data, error, reload, setData };
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
