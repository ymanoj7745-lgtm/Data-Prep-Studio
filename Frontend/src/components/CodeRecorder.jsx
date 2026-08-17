import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Copy, Download, Terminal } from "lucide-react";
import { scriptUrl } from "@/lib/api";

const KW = /\b(import|as|from|df|True|False|None)\b/g;
const FN = /\b(pd|np|fillna|dropna|drop_duplicates|drop|astype|to_numeric|to_datetime|read_csv|read_excel|read_json|replace|str|strip|rename|mean|median|mode|iloc|reset_index)\b/g;
const STR = /'([^']*)'/g;
const NUM = /\b(\d+\.?\d*)\b/g;
const COMMENT = /^(\s*#.*)$/;

function highlight(line) {
  if (COMMENT.test(line)) return <span className="tok-comment">{line}</span>;
  // tokenize by replacing with markers then splitting
  const parts = [];
  let idx = 0;
  const spans = [];
  // find strings first
  let working = line;
  const tokens = [];
  const push = (type, value, start, end) => tokens.push({ type, value, start, end });

  const findAll = (regex, type) => {
    let m;
    const r = new RegExp(regex.source, regex.flags);
    while ((m = r.exec(line))) {
      push(type, m[0], m.index, m.index + m[0].length);
    }
  };
  findAll(STR, "str");
  findAll(NUM, "num");
  findAll(KW, "kw");
  findAll(FN, "fn");
  // sort and remove overlaps
  tokens.sort((a, b) => a.start - b.start);
  const filtered = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start >= cursor) {
      filtered.push(t);
      cursor = t.end;
    }
  }
  let out = [];
  let last = 0;
  filtered.forEach((t, i) => {
    if (t.start > last) out.push(<span key={`p${i}`} className="tok-op">{line.slice(last, t.start)}</span>);
    out.push(
      <span key={`t${i}`} className={`tok-${t.type}`}>
        {t.value}
      </span>
    );
    last = t.end;
  });
  if (last < line.length) out.push(<span key="tail" className="tok-op">{line.slice(last)}</span>);
  return <>{out}</>;
}

export default function CodeRecorder({ code, sessionId }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [code]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(code.join("\n"));
      toast.success("Copied script to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="code-recorder">
      <div
        className="h-11 shrink-0 flex items-center justify-between px-4 border-b"
        style={{ borderColor: "var(--border)", background: "#050505" }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={12} color="var(--accent)" />
          <span className="font-mono text-[11px]" style={{ color: "var(--text-2)" }}>
            code_recorder.py
          </span>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5"
            style={{ color: "var(--text-3)", border: "1px solid var(--border)" }}
            data-testid="code-line-count"
          >
            {code.length} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 hover:bg-[#111]"
            title="Copy"
            onClick={copyAll}
            disabled={code.length === 0}
            data-testid="copy-script-btn"
          >
            <Copy size={12} color="var(--text-2)" />
          </button>
          {sessionId && (
            <a
              href={scriptUrl(sessionId)}
              download={`data_prep_${sessionId.slice(0, 6)}.py`}
              className="p-1.5 hover:bg-[#111]"
              title="Download .py"
              data-testid="sidebar-download-btn"
            >
              <Download size={12} color="var(--accent)" />
            </a>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        {code.length === 0 ? (
          <div className="px-4 font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
            # No actions yet — upload a file to begin.
          </div>
        ) : (
          <pre className="font-mono text-[11.5px] leading-[1.7]">
            {code.map((line, i) => (
              <div
                key={i}
                className="flex px-4 hover:bg-[#0a0a0a]"
                style={{ borderLeft: "2px solid transparent" }}
              >
                <span
                  className="pr-3 select-none text-right"
                  style={{ color: "var(--text-3)", width: 28 }}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre-wrap break-all">{highlight(line)}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
