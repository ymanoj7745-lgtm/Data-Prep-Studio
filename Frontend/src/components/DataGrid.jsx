import { useMemo, useState } from "react";

function typeBadge(dtype) {
  const d = dtype.toLowerCase();
  if (d.includes("int") || d.includes("float")) return { label: "num", color: "var(--syn-num)" };
  if (d.includes("datetime")) return { label: "date", color: "var(--syn-kw)" };
  if (d.includes("bool")) return { label: "bool", color: "var(--warning)" };
  return { label: "str", color: "var(--syn-str)" };
}

export default function DataGrid({ preview, selectedCol, onSelectCol }) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => (showAll ? preview.rows : preview.rows.slice(0, 15)), [preview.rows, showAll]);

  return (
    <section className="border-b" style={{ borderColor: "var(--border)" }} data-testid="data-grid">
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
          / preview · df.head({rows.length})
        </div>
        <button
          className="pill-btn text-[10px]"
          onClick={() => setShowAll((v) => !v)}
          data-testid="toggle-preview-rows"
        >
          {showAll ? "show fewer" : `show ${preview.rows.length}`}
        </button>
      </div>
      <div className="overflow-auto max-h-[420px]">
        <table className="dp-grid">
          <thead>
            <tr>
              <th style={{ width: 48, color: "var(--text-3)" }}>#</th>
              {preview.columns.map((c, i) => {
                const b = typeBadge(preview.dtypes[i]);
                const active = c === selectedCol;
                return (
                  <th
                    key={c}
                    onClick={() => onSelectCol(c)}
                    className="cursor-pointer"
                    style={{
                      background: active ? "#1e1712" : undefined,
                      borderBottom: active ? "2px solid var(--accent)" : undefined,
                    }}
                    data-testid={`col-header-${c}`}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: active ? "var(--accent)" : "var(--text)" }}>{c}</span>
                      <span
                        className="font-mono text-[9px] px-1"
                        style={{ color: b.color, border: `1px solid ${b.color}`, opacity: 0.7 }}
                      >
                        {b.label}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td style={{ color: "var(--text-3)" }}>{ri}</td>
                {row.map((v, ci) => (
                  <td key={ci} style={{ color: v === null ? "var(--anomaly)" : "var(--text)" }}>
                    {v === null ? "NaN" : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
