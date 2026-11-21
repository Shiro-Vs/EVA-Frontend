/** Utilidades puras para mostrar información de versión, canal OTA y servidor en "Acerca de". */

export function shortId(id?: string | null): string {
  if (!id) return "—";
  const clean = id.trim();
  if (!clean) return "—";
  return clean.slice(0, 8);
}

export function channelLabel(channel?: string | null, isEnabled?: boolean): string {
  if (!isEnabled) return "Desarrollo";
  const c = (channel ?? "").trim().toLowerCase();
  if (!c) return "Sin canal";
  if (c === "preview") return "Preview";
  if (c === "production") return "Producción";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function formatBuildDate(value?: Date | string | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function extractManifestId(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== "object") return null;
  const id = (manifest as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function extractManifestDate(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== "object") return null;
  const createdAt = (manifest as { createdAt?: unknown }).createdAt;
  if (typeof createdAt === "string" && createdAt.trim()) return createdAt.trim();
  if (createdAt instanceof Date) return createdAt.toISOString();
  return null;
}

export function healthUrlFromApiBase(baseUrl: string): string {
  const root = baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
  return `${root}/healthz`;
}

export function hostLabel(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/\/v1$/, "");
  return clean || "—";
}
