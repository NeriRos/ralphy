import { useState, useEffect, useCallback } from "react";
import { useSidecar } from "../context/Sidecar.context";

export function useDocument(taskName: string | undefined, docName: string) {
  const { baseUrl } = useSidecar();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!taskName || !baseUrl) return;
    try {
      const res = await fetch(`${baseUrl}/tasks/${taskName}/document/${docName}`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
      } else {
        setContent(null);
      }
    } catch {
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [taskName, docName, baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (newContent: string) => {
      if (!taskName || !baseUrl) return;
      await fetch(`${baseUrl}/tasks/${taskName}/document/${docName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      setContent(newContent);
    },
    [taskName, docName, baseUrl],
  );

  return { content, loading, save, refresh };
}
