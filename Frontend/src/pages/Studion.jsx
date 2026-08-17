import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Database, Download, FileSpreadsheet, Zap } from "lucide-react";
import UploadZone from "@/components/UploadZone";
import DataHealth from "@/components/DataHealth";
import DataGrid from "@/components/DataGrid";
import CleaningPanel from "@/components/CleaningPanel";
import CodeRecorder from "@/components/CodeRecorder";
import AutoChart from "@/components/AutoChart";
import { uploadFile, scriptUrl, csvUrl } from "@/lib/api";

export default function Studio() {
  const [state, setState] = useState(null); // { session_id, filename, health, preview, code }
  const [busy, setBusy] = useState(false);
  const [selectedCol, setSelectedCol] = useState(null);

  const handleUpload = useCallback(async (file) => {
    setBusy(true);
    try {
      const data = await uploadFile(file);
      setState(data);
      setSelectedCol(data?.health?.columns?.[0]?.name || null);
      toast.success(`Loaded ${file.name} — ${data.health.rows} rows × ${data.health.cols} cols`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const onMutated = useCallback((data) => {
    setState((prev) => ({ ...prev, ...data }));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col relative z-10" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="h-14 shrink-0 flex items-center justify-between px-5 border-b"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        data-testid="app-header"
      >
        <div className="flex items-center gap-3">
          <div
            className="h-7 w-7 flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Database size={16} color="#fff" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-medium">Data Prep Studio</div>
            <div className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
              v0.1 · in-memory session
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <>
              <div className="font-mono text-xs px-3 py-1 hairline" style={{ color: "var(--text-2)" }} data-testid="session-info">
                <FileSpreadsheet size={12} className="inline mr-1.5 -mt-0.5" />
                {state.filename} · {state.health.rows}×{state.health.cols}
              </div>
              <a
                href={csvUrl(state.session_id)}
                className="pill-btn"
                data-testid="download-csv-btn"
                download
              >
                <Download size={12} className="inline mr-1 -mt-0.5" /> CSV
              </a>
              <a
                href={scriptUrl(state.session_id)}
                className="pill-btn primary"
                data-testid="download-script-btn"
                download={`data_prep_${state.session_id.slice(0, 6)}.py`}
              >
                <Zap size={12} className="inline mr-1 -mt-0.5" /> Download .py
              </a>
            </>
          )}
        </div>
      </header>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto" data-testid="workspace">
          {!state ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <UploadZone onUpload={handleUpload} busy={busy} />
            </div>
          ) : (
            <div className="flex flex-col">
              <DataHealth health={state.health} />
              <CleaningPanel
                sessionId={state.session_id}
                health={state.health}
                selectedCol={selectedCol}
                onSelectCol={setSelectedCol}
                onMutated={onMutated}
              />
              <DataGrid preview={state.preview} selectedCol={selectedCol} onSelectCol={setSelectedCol} />
              <AutoChart sessionId={state.session_id} health={state.health} />
            </div>
          )}
        </main>

        {/* Code recorder sidebar */}
        <aside
          className="w-96 shrink-0 border-l flex flex-col"
          style={{ borderColor: "var(--border)", background: "var(--code-bg)" }}
        >
          <CodeRecorder
            code={state?.code || []}
            sessionId={state?.session_id}
          />
        </aside>
      </div>
    </div>
  );
}
