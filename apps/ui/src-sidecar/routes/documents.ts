import { join } from "node:path";
import { getStorage } from "@ralphy/context";
import type { SidecarContext } from "../types";

const ALLOWED_DOCS = ["STEERING.md", "PROGRESS.md", "RESEARCH.md", "PLAN.md"];

interface RouteResult {
  status: number;
  body: unknown;
}

export async function documentRoutes(
  req: Request,
  route: { name: string; doc: string },
  ctx: SidecarContext,
): Promise<RouteResult> {
  const storage = getStorage();
  const docName = route.doc.toUpperCase();
  const fileName = ALLOWED_DOCS.find((d) => d.toUpperCase() === docName || d === route.doc);

  if (!fileName) {
    return {
      status: 400,
      body: { error: `Invalid document. Allowed: ${ALLOWED_DOCS.join(", ")}` },
    };
  }

  const filePath = join(ctx.tasksDir, route.name, fileName);

  if (req.method === "GET") {
    const content = storage.read(filePath);
    if (content === null) {
      return { status: 404, body: { error: "Document not found" } };
    }
    return { status: 200, body: { name: fileName, content } };
  }

  if (req.method === "PUT") {
    const body = (await req.json()) as { content: string };
    if (typeof body.content !== "string") {
      return { status: 400, body: { error: "content is required" } };
    }
    storage.write(filePath, body.content);
    return { status: 200, body: { name: fileName, content: body.content } };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}
