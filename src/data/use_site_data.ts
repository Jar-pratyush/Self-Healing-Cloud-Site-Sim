import { useEffect, useState } from "react";

type LoadState<T> = { data: T | null; error: string | null };

// One request per file for the whole page, shared by every component.
const request_cache = new Map<string, Promise<unknown>>();

function load_json(file_path: string): Promise<unknown> {
  let request = request_cache.get(file_path);
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}data/${file_path}`).then((response) => {
      if (!response.ok) {
        throw new Error(`${file_path}: HTTP ${response.status}`);
      }
      return response.json();
    });
    request.catch(() => request_cache.delete(file_path));
    request_cache.set(file_path, request);
  }
  return request;
}

// Loads one exported JSON file from public/data. Passing null skips loading.
export function useSiteData<T>(file_path: string | null): LoadState<T> {
  const [state, set_state] = useState<LoadState<T> & { for_path: string | null }>({
    data: null,
    error: null,
    for_path: null,
  });

  useEffect(() => {
    if (!file_path) {
      return;
    }
    let is_current = true;
    load_json(file_path).then(
      (payload) => {
        if (is_current) {
          set_state({ data: payload as T, error: null, for_path: file_path });
        }
      },
      (load_error: unknown) => {
        if (is_current) {
          set_state({ data: null, error: String(load_error), for_path: file_path });
        }
      },
    );
    return () => {
      is_current = false;
    };
  }, [file_path]);

  if (state.for_path !== file_path) {
    return { data: null, error: null };
  }
  return { data: state.data, error: state.error };
}
