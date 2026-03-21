import { useState, useEffect } from "react";

interface DocumentEditorProps {
  title: string;
  content: string | null;
  loading: boolean;
  onSave: (content: string) => Promise<void>;
}

export function DocumentEditor({ title, content, loading, onSave }: DocumentEditorProps) {
  const [value, setValue] = useState(content ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (content !== null) {
      setValue(content);
      setDirty(false);
    }
  }, [content]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(value);
    setSaving(false);
    setDirty(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 12 }}>{title}</span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {loading ? (
        <div style={{ padding: 12, color: "var(--text-dim)" }}>Loading...</div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 0,
            resize: "none",
            padding: 12,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        />
      )}
    </div>
  );
}
