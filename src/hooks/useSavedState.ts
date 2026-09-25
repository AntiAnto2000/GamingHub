import { useState, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
export function useSavedState<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>, string] {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { value: fallback, error: "" };
      const parsed: unknown = JSON.parse(raw);
      if (!validate(parsed)) throw Error();
      return { value: parsed as T, error: "" };
    } catch {
      return {
        value: fallback,
        error:
          "Gespeicherte Daten konnten nicht geladen werden. Es werden Standardwerte verwendet.",
      };
    }
  });
  const [value, setValue] = useState<T>(initial.value);
  const current = useRef(value);
  const [error, setError] = useState(initial.error);
  const update: Dispatch<SetStateAction<T>> = (next) => {
    const resolved =
      typeof next === "function"
        ? (next as (old: T) => T)(current.current)
        : next;
    current.current = resolved;
    setValue(resolved);
    try {
      localStorage.setItem(key, JSON.stringify(resolved));
      setError("");
    } catch {
      setError(
        "Änderungen gelten für diese Sitzung. Dauerhaftes Speichern ist gerade nicht möglich.",
      );
    }
  };
  return [value, update, error];
}
