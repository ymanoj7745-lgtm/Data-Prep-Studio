import { AlertTriangle, CheckCircle2, Copy, Rows, Columns } from "lucide-react";

function MetricCard({ label, value, sub, tone = "default", testId }) {
  const color =
    tone === "danger"
      ? "var(--anomaly)"
      : tone === "warn"
      ? "var(--warning)"
      : tone === "ok"
      ? "var(--success)"
      : "var(--text)";
  return (
    <div className="hairline p-4 min-w-[140px]" style={{ background: "var(--panel)" }} data-testid={testId}>
      <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      <div className="font-display text-2xl font-light mt-1" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function DataHealth({ health }) {
  const anomalies = health.columns.filter((c) => c.anomaly).length;
  const missingCols = health.columns.filter((c) => c.missing > 0).length;

  return (
    <section className="border-b" style={{ borderColor: "var(--border)" }} data-testid="health-dashboard">
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
          / data health
        </div>
        <div className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
          {anomalies === 0 ? (
            <span style={{ color: "var(--success)" }}>
              <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />
              clean
            </span>
          ) : (
            <span style={{ color: "var(--anomaly)" }}>
              <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />
              {anomalies} issues detected
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px" style={{ background: "var(--border)" }}>
        <MetricCard
          label="Rows"
          value={health.rows.toLocaleString()}
          sub={<><Rows size={10} className="inline mr-1" /> observations</>}
          testId="metric-rows"
        />
        <MetricCard
          label="Columns"
          value={health.cols}
          sub={<><Columns size={10} className="inline mr-1" /> features</>}
          testId="metric-cols"
        />
        <MetricCard
          label="Missing"
          value={health.total_missing.toLocaleString()}
          sub={`${missingCols} column${missingCols === 1 ? "" : "s"}`}
          tone={health.total_missing > 0 ? "warn" : "ok"}
          testId="metric-missing"
        />
        <MetricCard
          label="Duplicates"
          value={health.duplicates}
          sub={<><Copy size={10} className="inline mr-1" /> duplicated rows</>}
          tone={health.duplicates > 0 ? "warn" : "ok"}
          testId="metric-duplicates"
        />
        <MetricCard
          label="Anomalies"
          value={anomalies}
          sub="cols needing attention"
          tone={anomalies > 0 ? "danger" : "ok"}
          testId="metric-anomalies"
        />
      </div>
    </section>
  );
}
