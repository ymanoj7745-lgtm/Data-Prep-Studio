import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  CartesianGrid,
} from "recharts";
import { BarChart3, ScatterChart as ScatterIcon, BoxSelect } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchChart } from "@/lib/api";

const NONE = "__none__";

const tooltipStyle = {
  background: "#111",
  border: "1px solid #27272a",
  borderRadius: 0,
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 11,
  color: "#fafafa",
};

export default function AutoChart({ sessionId, health }) {
  const cols = health.columns.map((c) => c.name);
  const [colA, setColA] = useState(cols[0] || "");
  const [colB, setColB] = useState(NONE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const selection = useMemo(() => {
    const list = [colA];
    if (colB && colB !== NONE) list.push(colB);
    return list.filter(Boolean);
  }, [colA, colB]);

  useEffect(() => {
    if (!sessionId || selection.length === 0) return;
    let cancelled = false;
    setLoading(true);
    fetchChart(sessionId, selection)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionId, selection.join(",")]); // eslint-disable-line

  const kindIcon = data?.kind === "scatter" ? <ScatterIcon size={12} /> : data?.kind === "box" ? <BoxSelect size={12} /> : <BarChart3 size={12} />;

  return (
    <section data-testid="auto-chart">
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
            / auto visualization
          </span>
          {data && (
            <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>
              {kindIcon} <span className="ml-1">{data.kind}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={colA} onValueChange={setColA}>
            <SelectTrigger className="h-7 w-52 rounded-none border-[var(--border)] bg-[var(--panel)] font-mono text-xs" data-testid="chart-col-a">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none bg-[var(--panel)] border-[var(--border)]">
              {cols.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={colB} onValueChange={setColB}>
            <SelectTrigger className="h-7 w-52 rounded-none border-[var(--border)] bg-[var(--panel)] font-mono text-xs" data-testid="chart-col-b">
              <SelectValue placeholder="second column (optional)" />
            </SelectTrigger>
            <SelectContent className="rounded-none bg-[var(--panel)] border-[var(--border)]">
              <SelectItem value={NONE} className="font-mono text-xs">— none —</SelectItem>
              {cols.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="p-5" style={{ background: "var(--panel)", minHeight: 320 }}>
        {loading && (
          <div className="font-mono text-xs" style={{ color: "var(--text-3)" }}>rendering…</div>
        )}
        {!loading && data && <ChartBody data={data} />}
        {!loading && !data && (
          <div className="font-mono text-xs" style={{ color: "var(--text-3)" }}>Select a column to visualize.</div>
        )}
      </div>
    </section>
  );
}

function ChartBody({ data }) {
  if (data.kind === "histogram") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.bins} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <XAxis dataKey="bin" stroke="#71717a" tickLine={false} axisLine={{ stroke: "#27272a" }} />
          <YAxis stroke="#71717a" tickLine={false} axisLine={{ stroke: "#27272a" }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#18181b" }} />
          <Bar dataKey="count" fill="#e0613a" />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (data.kind === "bar") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.bars} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis dataKey="category" stroke="#71717a" tickLine={false} axisLine={{ stroke: "#27272a" }} angle={-30} textAnchor="end" height={60} />
          <YAxis stroke="#71717a" tickLine={false} axisLine={{ stroke: "#27272a" }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#18181b" }} />
          <Bar dataKey="count" fill="#e0613a" />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (data.kind === "scatter") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#18181b" />
          <XAxis type="number" dataKey="x" name={data.x} stroke="#71717a" tickLine={false} axisLine={{ stroke: "#27272a" }} />
          <YAxis type="number" dataKey="y" name={data.y} stroke="#71717a" tickLine={false} axisLine={{ stroke: "#27272a" }} />
          <ZAxis range={[16, 16]} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data.points} fill="#e0613a" fillOpacity={0.55} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (data.kind === "box") {
    // Render as horizontal min→max ranges with median dots (simple SVG-based box viz using recharts bar segments)
    const rows = data.groups;
    if (rows.length === 0)
      return <div className="font-mono text-xs" style={{ color: "var(--text-3)" }}>No groups.</div>;
    const globalMin = Math.min(...rows.map((r) => r.min));
    const globalMax = Math.max(...rows.map((r) => r.max));
    const range = globalMax - globalMin || 1;
    return (
      <div className="font-mono text-[11px] space-y-2">
        <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
          {data.y} distribution by {data.x}
        </div>
        {rows.map((r) => {
          const startL = ((r.min - globalMin) / range) * 100;
          const q1L = ((r.q1 - globalMin) / range) * 100;
          const q3L = ((r.q3 - globalMin) / range) * 100;
          const medL = ((r.median - globalMin) / range) * 100;
          const endL = ((r.max - globalMin) / range) * 100;
          return (
            <div key={r.category} className="flex items-center gap-3">
              <div className="w-32 truncate" style={{ color: "var(--text-2)" }}>{r.category}</div>
              <div className="flex-1 relative h-5" style={{ background: "var(--panel-2)" }}>
                {/* whisker */}
                <div className="absolute top-1/2 h-px" style={{ left: `${startL}%`, width: `${endL - startL}%`, background: "#52525b", transform: "translateY(-50%)" }} />
                {/* box */}
                <div className="absolute top-0 h-full" style={{ left: `${q1L}%`, width: `${q3L - q1L}%`, background: "rgba(224,97,58,0.35)", border: "1px solid #e0613a" }} />
                {/* median */}
                <div className="absolute top-0 h-full w-px" style={{ left: `${medL}%`, background: "#fafafa" }} />
              </div>
              <div className="w-24 text-right" style={{ color: "var(--text-3)" }}>n={r.n}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}