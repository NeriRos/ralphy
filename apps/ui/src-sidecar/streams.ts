import type { ServerWebSocket } from "bun";

interface WsData {
  taskName: string;
}

// Active WebSocket connections per task
const activeStreams = new Map<string, Set<ServerWebSocket<WsData>>>();

export function getActiveStreams() {
  return activeStreams;
}

export function addStream(taskName: string, ws: ServerWebSocket<WsData>) {
  if (!activeStreams.has(taskName)) {
    activeStreams.set(taskName, new Set());
  }
  activeStreams.get(taskName)!.add(ws);
}

export function removeStream(taskName: string, ws: ServerWebSocket<WsData>) {
  activeStreams.get(taskName)?.delete(ws);
  if (activeStreams.get(taskName)?.size === 0) {
    activeStreams.delete(taskName);
  }
}
