import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SidecarContextValue {
  baseUrl: string;
  connected: boolean;
}

const SidecarCtx = createContext<SidecarContextValue>({
  baseUrl: "",
  connected: false,
});

// hooks-ignore
export function useSidecar() {
  return useContext(SidecarCtx);
}

async function discoverSidecarUrl(): Promise<string> {
  // Try Tauri invoke first (when running inside the desktop app)
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const url: string = await invoke("get_sidecar_url");
    return url;
  } catch {
    // Not running in Tauri — fall back to default port for standalone dev
    return "http://localhost:3210";
  }
}

async function waitForSidecar(url: string, retries = 5, delayMs = 1000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${url}/tasks`);
      if (res.ok) return true;
    } catch {
      // Not ready yet
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

export function SidecarProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function init() {
      const url = await discoverSidecarUrl();
      setBaseUrl(url);
      const ok = await waitForSidecar(url);
      setConnected(ok);
    }
    init();
  }, []);

  return <SidecarCtx.Provider value={{ baseUrl, connected }}>{children}</SidecarCtx.Provider>;
}
