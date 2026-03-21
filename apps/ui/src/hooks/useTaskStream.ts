import { useState, useEffect, useRef, useCallback } from "react";
import { useSidecar } from "../context/SidecarContext";
import type { FeedEvent, State } from "@ralphy/types";

interface ProgressCount {
  checked: number;
  unchecked: number;
  total: number;
}

type WsMessage =
  | { type: "feed"; event: FeedEvent }
  | { type: "state"; state: State }
  | { type: "progress"; progress: ProgressCount }
  | { type: "info"; text: string }
  | { type: "stopped"; reason: string }
  | { type: "error"; message: string };

export interface LogEntry {
  id: string;
  kind: "feed" | "info";
  event?: FeedEvent;
  text?: string;
  timestamp: number;
}

export function useTaskStream(taskName: string | undefined) {
  const { baseUrl } = useSidecar();
  const [state, setState] = useState<State | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressCount | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);

  const connect = useCallback(() => {
    if (!taskName || !baseUrl) return;
    const wsUrl = baseUrl.replace("http", "ws");
    const ws = new WebSocket(`${wsUrl}/tasks/${taskName}/stream`);

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);
      const nextId = () => String(idRef.current++);

      switch (msg.type) {
        case "feed":
          setLogEntries((prev) => [
            ...prev,
            { id: nextId(), kind: "feed", event: msg.event, timestamp: Date.now() },
          ]);
          break;
        case "state":
          setState(msg.state);
          break;
        case "progress":
          setProgress(msg.progress);
          break;
        case "info":
          setLogEntries((prev) => [
            ...prev,
            { id: nextId(), kind: "info", text: msg.text, timestamp: Date.now() },
          ]);
          break;
        case "stopped":
          setStopReason(msg.reason);
          setIsRunning(false);
          break;
        case "error":
          setLogEntries((prev) => [
            ...prev,
            { id: nextId(), kind: "info", text: `Error: ${msg.message}`, timestamp: Date.now() },
          ]);
          break;
      }
    };

    ws.onclose = () => {
      setIsRunning(false);
    };

    wsRef.current = ws;
  }, [taskName, baseUrl]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  const startTask = useCallback(
    async (options: Record<string, unknown> = {}) => {
      if (!taskName) return;
      setIsRunning(true);
      setStopReason(null);
      setLogEntries([]);

      // Ensure WebSocket is connected before starting
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
        // Brief delay to let WS connect
        await new Promise((r) => setTimeout(r, 500));
      }

      await fetch(`${baseUrl}/tasks/${taskName}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
    },
    [taskName, baseUrl, connect],
  );

  const stopTask = useCallback(async () => {
    if (!taskName) return;
    await fetch(`${baseUrl}/tasks/${taskName}/stop`, { method: "POST" });
  }, [taskName, baseUrl]);

  return {
    state,
    logEntries,
    progress,
    isRunning,
    stopReason,
    startTask,
    stopTask,
  };
}
