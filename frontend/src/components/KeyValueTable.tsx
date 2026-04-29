"use client";

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function recordToRows(obj: Record<string, unknown> | null | undefined): { key: string; value: string }[] {
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => ({ key: k, value: formatCell(v) }));
}

export function KeyValueTable({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; value: string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{title}</h2>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th style={{ textAlign: "left", width: "38%", fontWeight: 500 }}>{r.key}</th>
              <td style={{ fontSize: "0.9rem", wordBreak: "break-word" }}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
