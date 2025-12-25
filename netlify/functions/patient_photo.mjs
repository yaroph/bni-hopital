import { db, jsonResponse, badRequest, methodNotAllowed, parseDataUrl, extFromMime, arrayBufferFromBase64 } from "./_lib.mjs";

function baseIdFromId(id) {
  const s = String(id || "");
  return s.split("--")[0].replace(/[^a-zA-Z0-9_-]/g, "");
}

export default async function handler(req, context) {
  if (req.method !== "PUT") return methodNotAllowed(["PUT"]);

  const id = context?.params?.id;
  if (!id) return badRequest("missing_id");

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const parsed = parseDataUrl(body?.dataUrl);
  if (!parsed) return badRequest("invalid_data_url");

  const ext = extFromMime(parsed.mime);
  if (!ext) return badRequest("unsupported_image_type", { mime: parsed.mime });

  const baseId = baseIdFromId(id);
  if (!baseId) return badRequest("invalid_id");

  // Delete existing custom_{baseId}.* photos (best effort)
  const prefix = `photos/custom_${baseId}`;
  try {
    const { blobs } = await db.list({ prefix });
    await Promise.all(blobs.map((b) => db.delete(b.key)));
  } catch {
    // ignore
  }

  const filename = `custom_${baseId}${ext}`;
  const key = `photos/${filename}`;

  const ab = arrayBufferFromBase64(parsed.base64);
  await db.set(key, ab, { metadata: { contentType: parsed.mime } });

  return jsonResponse({ ok: true, filename });
}

export const config = {
  path: "/api/patient/:id/photo",
};
