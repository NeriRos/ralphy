import { useState, useEffect, useCallback } from "react";
import { useSidecar } from "../context/SidecarContext";
import type { State } from "@ralphy/types";

interface TaskWithProgress extends State {
  progress: { checked: number; unchecked: number; total: number } | null;
}

export function useTasks() {
  const { baseUrl, connected } = useSidecar();
  const [tasks, setTasks] = useState<TaskWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/tasks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!connected) return;
    refresh();
    // Poll every 5 seconds
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [connected, refresh]);

  return { tasks, loading, error, refresh };
}
