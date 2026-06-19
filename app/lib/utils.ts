import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Devuelve `url` solo si es un enlace web seguro (`http:`/`https:`); en cualquier
 * otro caso (`javascript:`, `data:`, `vbscript:`, malformada) devuelve `null` (#9,
 * code-review v1.0). React NO neutraliza estos esquemas en un `href`, así que un
 * enlace proveniente de la fuente (XML de tramitación) podría inyectar script al
 * hacer clic. Es el guard central para todo `href` derivado de datos externos.
 */
export function safeExternalHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const proto = new URL(url).protocol;
    return proto === "https:" || proto === "http:" ? url : null;
  } catch {
    return null;
  }
}
