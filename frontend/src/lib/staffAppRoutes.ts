/**
 * Staff ERP URLs under /app (no hotel UUID in the path). Middleware rewrites to /hotels/[hotelId]/...
 */

/** Flatten segments; dashboard maps to /app/dashboard. */
export function staffAppPath(...segments: string[]): string {
  const flat = segments.flatMap((s) => s.split("/")).filter(Boolean);
  if (flat.length === 0) {
    return "/app";
  }
  return `/app/${flat.join("/")}`;
}
