import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wand2, Trash2, Ruler, Type as TypeIcon, Sparkles, Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as api from "@/lib/api";

const IMPUTE_STRATS = [
  { v: "mean", label: "Mean" },
  { v: "median", label: "Median" },
  { v: "mode", label: "Mode" },
  { v: "zero", label: "Zero" },
  { v: "drop_rows", label: "Drop rows" },
];

const CAST_TARGETS = [
  { v: "numeric", label: "Numeric (float)" },
  { v: "integer", label: "Integer" },
  { v: "datetime", label: "Datetime" },
  { v: "string", label: "String" },
];

export default function CleaningPanel({ sessionId, health, selectedCol, onSelectCol, onMutated }) {
  const [strategy, setStrategy] = useState("median");
  const [castTarget, setCastTarget] = useState("numeric");
  const [busy, setBusy] = useState(false);

  const col = useMemo(
    () => health.columns.find((c) => c.name === selectedCol) || health.columns[0],
    [health.columns, selectedCol]
  );

  async function run(fn, label) {
    if (!sessionId) return;
    setBusy(true);
    try {
      const data = await fn();
      onMutated(data);
      toast.success(label);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b" style={{ borderColor: "var(--border)" }} data-testid="cleaning-panel">
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
          / cleaning wizard
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
          column:
          <Select value={col?.name} onValueChange={onSelectCol}>
            <SelectTrigger
              className="h-7 w-56 rounded-none border-[var(--border)] bg-[var(--panel)] font-mono text-xs"
              data-testid="column-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none bg-[var(--panel)] border-[var(--border)]">
              {health.columns.map((c) => (
                <SelectItem key={c.name} value={c.name} className="font-mono text-xs">
                  {c.name} · {c.semantic}
                  {c.missing > 0 && (
                    <span style={{ color: "var(--anomaly)" }}> · {c.missing} null</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {col && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px" style={{ background: "var(--border)" }}>
          {/* Impute */}
          <div className="p-4" style={{ background: "var(--panel)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={12} color="var(--accent)" />
              <div className="font-display text-sm font-medium">Impute missing</div>
            </div>
            <div className="font-mono text-[10px] mb-3" style={{ color: "var(--text-3)" }}>
              {col.missing} nulls · {col.missing_pct}% of column
            </div>
            <div className="flex gap-2">
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger
                  className="h-8 rounded-none border-[var(--border)] bg-[var(--bg)] font-mono text-xs flex-1"
                  data-testid="impute-strategy-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none bg-[var(--panel)] border-[var(--border)]">
                  {IMPUTE_STRATS.map((o) => (
                    <SelectItem key={o.v} value={o.v} className="font-mono text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                className="pill-btn primary"
                disabled={busy || col.missing === 0}
                onClick={() =>
                  run(
                    () => api.impute(sessionId, col.name, strategy),
                    `Imputed ${col.name} (${strategy})`
                  )
                }
                data-testid="impute-btn"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Cast */}
          <div className="p-4" style={{ background: "var(--panel)" }}>
            <div className="flex items-center gap-2 mb-3">
              <TypeIcon size={12} color="var(--accent)" />
              <div className="font-display text-sm font-medium">Cast type</div>
            </div>
            <div className="font-mono text-[10px] mb-3" style={{ color: "var(--text-3)" }}>
              current: {col.dtype} · inferred: {col.semantic}
            </div>
            <div className="flex gap-2">
              <Select value={castTarget} onValueChange={setCastTarget}>
                <SelectTrigger
                  className="h-8 rounded-none border-[var(--border)] bg-[var(--bg)] font-mono text-xs flex-1"
                  data-testid="cast-target-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none bg-[var(--panel)] border-[var(--border)]">
                  {CAST_TARGETS.map((o) => (
                    <SelectItem key={o.v} value={o.v} className="font-mono text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                className="pill-btn"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.cast(sessionId, col.name, castTarget),
                    `Cast ${col.name} → ${castTarget}`
                  )
                }
                data-testid="cast-btn"
              >
                Cast
              </button>
            </div>
          </div>

          {/* Sanitize */}
          <div className="p-4" style={{ background: "var(--panel)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={12} color="var(--accent)" />
              <div className="font-display text-sm font-medium">Sanitize</div>
            </div>
            <div className="font-mono text-[10px] mb-3" style={{ color: "var(--text-3)" }}>
              strip $, %, commas, whitespace
            </div>
            <div className="flex gap-2">
              <button
                className="pill-btn flex-1"
                disabled={busy}
                onClick={() =>
                  run(() => api.sanitize(sessionId, col.name), `Sanitized ${col.name}`)
                }
                data-testid="sanitize-btn"
              >
                <Ruler size={11} className="inline mr-1 -mt-0.5" /> strip symbols
              </button>
              <button
                className="pill-btn"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api.stripWhitespace(sessionId, col.name),
                    `Trimmed ${col.name}`
                  )
                }
                data-testid="trim-btn"
              >
                trim
              </button>
            </div>
          </div>

          {/* Column ops */}
          <div className="p-4" style={{ background: "var(--panel)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={12} color="var(--accent)" />
              <div className="font-display text-sm font-medium">Column ops</div>
            </div>
            <div className="font-mono text-[10px] mb-3" style={{ color: "var(--text-3)" }}>
              {col.unique} unique values
            </div>
            <div className="flex gap-2">
              <button
                className="pill-btn flex-1"
                disabled={busy}
                onClick={() => run(() => api.dropDuplicates(sessionId), "Dropped duplicate rows")}
                data-testid="drop-duplicates-btn"
              >
                dedupe rows
              </button>
              <button
                className="pill-btn"
                disabled={busy}
                style={{ color: "var(--anomaly)", borderColor: "var(--anomaly)" }}
                onClick={() =>
                  run(() => api.dropColumn(sessionId, col.name), `Dropped ${col.name}`)
                }
                data-testid="drop-column-btn"
              >
                <Trash2 size={11} className="inline mr-1 -mt-0.5" /> drop col
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
