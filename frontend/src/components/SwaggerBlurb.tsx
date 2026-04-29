import { swaggerUiUrl } from "@/lib/api";

export function SwaggerBlurb() {
  return (
    <details className="hms-swagger-details">
      <summary>API reference (Swagger)</summary>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
        Open{" "}
        <a href={swaggerUiUrl()} target="_blank" rel="noopener noreferrer">
          Swagger UI
        </a>{" "}
        and use <code>Authorize</code> with your session Bearer token when testing endpoints.
      </p>
    </details>
  );
}
