import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileType2, Loader2 } from "lucide-react";

export default function UploadZone({ onUpload, busy }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) return;
      onUpload(files[0]);
    },
    [onUpload]
  );

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-8">
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-3)" }}>
          / new session
        </div>
        <h1 className="font-display text-4xl font-light tracking-tight">
          Drop a dataset. <span style={{ color: "var(--text-3)" }}>Get a clean pipeline.</span>
        </h1>
        <p className="mt-3 font-mono text-xs" style={{ color: "var(--text-2)" }}>
          Every click you make on this dashboard is transcribed into runnable Pandas code
          you can download as a <span style={{ color: "var(--accent)" }}>.py</span> script.
        </p>
      </div>

      <label
        htmlFor="dp-file"
        className={`dashed-drop ${drag ? "drag" : ""} block cursor-pointer p-12`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        data-testid="upload-dropzone"
      >
        <input
          ref={inputRef}
          id="dp-file"
          type="file"
          className="hidden"
          accept=".csv,.tsv,.xls,.xlsx,.json,.parquet"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="upload-file-input"
        />
        <div className="flex flex-col items-center text-center gap-4">
          {busy ? (
            <Loader2 size={40} className="animate-spin" color="var(--accent)" />
          ) : (
            <UploadCloud size={40} color="var(--text-2)" strokeWidth={1.25} />
          )}
          <div>
            <div className="font-display text-lg font-medium">
              {busy ? "Parsing…" : "Drop file or click to browse"}
            </div>
            <div className="font-mono text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
              csv · tsv · xlsx · xls · json · parquet — up to 50 MB
            </div>
          </div>
          <div className="flex gap-2 mt-2 font-mono text-[10px]" style={{ color: "var(--text-3)" }}>
            {["csv", "xlsx", "json", "parquet"].map((t) => (
              <span key={t} className="hairline px-2 py-0.5">
                <FileType2 size={10} className="inline mr-1 -mt-0.5" /> .{t}
              </span>
            ))}
          </div>
        </div>
      </label>
    </div>
  );
}
