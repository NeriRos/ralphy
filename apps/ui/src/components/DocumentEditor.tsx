import { useState, useEffect } from "react";

interface DocumentEditorProps {
  title: string;
  content: string | null;
  loading: boolean;
  onSave?: (content: string) => Promise<void>;
  placeholder?: string;
  readOnly?: boolean;
}

export function DocumentEditor({ title, content, loading, onSave, placeholder, readOnly }: DocumentEditorProps) {
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
    if (!onSave) return;
    setSaving(true);
    await onSave(value);
    setSaving(false);
    setDirty(false);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
        {!readOnly && onSave && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{ fontSize: 11, padding: "3px 8px" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ padding: 12, color: "var(--text-dim)" }}>Loading...</div>
      ) : (
        <textarea
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => {
            if (readOnly) return;
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
            ...(readOnly ? { opacity: 0.8, cursor: "default" } : {}),
          }}
        />
      )}
    </div>
  );
}
