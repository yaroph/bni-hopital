import { db, jsonResponse, methodNotAllowed } from "./_lib.mjs";

export default async function handler(req, context) {
  if (req.method !== "GET") return methodNotAllowed(["GET"]);

  const filename = context?.params?.filename;
  if (!filename) return new Response("Not Found", { status: 404 });

  const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe) return new Response("Not Found", { status: 404 });

  const key = `photos/${safe}`;
  const entry = await db.getWithMetadata(key, { type: "arrayBuffer", consistency: "strong" });

  if (entry === null || entry.data === null) {
    return new Response("Not Found", { status: 404 });
  }

  const contentType = entry.metadata?.contentType || "application/octet-stream";

  return new Response(entry.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  path: "/photo/:filename",
};
