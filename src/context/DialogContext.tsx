import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import EVADialog, { type DialogSpec } from "../components/common/EVADialog";
import { explainError } from "../utils/explainError";

interface DialogApi {
  /** Pregunta y espera: `true` si la persona confirma. Con `danger` el botón es rojo. */
  confirm: (o: { title: string; message?: string; details?: string[]; confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
  /** Avisa algo y espera a que lo cierre (o se cierra solo, en los de éxito). */
  notify: (o: Omit<DialogSpec, "kind"> & { kind?: Exclude<DialogSpec["kind"], "confirm" | "danger"> }) => Promise<void>;
  success: (title: string, message?: string) => Promise<void>;
  /** Muestra un error de la API: «No se pudo… porque…» si es algo que se puede explicar, o «Algo salió mal» si no. */
  fail: (e: unknown, title?: string) => Promise<void>;
}

const Ctx = createContext<DialogApi | null>(null);
export const useDialog = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialog debe usarse dentro de DialogProvider");
  return c;
};

/** Cola de diálogos: si se piden varios, se muestran uno tras otro. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const queue = useRef<Array<{ spec: DialogSpec; resolve: (v: boolean) => void }>>([]);
  const current = useRef<((v: boolean) => void) | null>(null);

  const next = useCallback(() => {
    const n = queue.current.shift();
    if (!n) { current.current = null; setSpec(null); return; }
    current.current = n.resolve;
    setSpec(n.spec);
  }, []);

  const show = useCallback((s: DialogSpec) => new Promise<boolean>((resolve) => {
    queue.current.push({ spec: s, resolve });
    if (!current.current) next();
  }), [next]);

  const onResult = useCallback((v: boolean) => {
    const r = current.current;
    current.current = null;
    r?.(v);
    next();
  }, [next]);

  const api = useMemo<DialogApi>(() => ({
    confirm: (o) => show({ kind: o.danger ? "danger" : "confirm", title: o.title, message: o.message, details: o.details, confirmLabel: o.confirmLabel, cancelLabel: o.cancelLabel }),
    notify: async (o) => { await show({ kind: "info", ...o } as DialogSpec); },
    success: async (title, message) => { await show({ kind: "success", title, message, autoCloseMs: 1500 }); },
    fail: async (e, title) => { const x = explainError(e, title); await show({ kind: x.kind, title: x.title, message: x.message, details: x.details }); },
  }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <EVADialog spec={spec} onResult={onResult} />
    </Ctx.Provider>
  );
}
