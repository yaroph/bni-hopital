import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DB_STORE_NAME = "geniuster-db";
export const db = getStore(DB_STORE_NAME);

/**
 * Read a JSON blob; if missing, seed from a bundled file in /DATA then return it.
 */
export async function getOrSeedJSON(key, seedRelPath) {
  const existing = await db.get(key, { type: "json", consistency: "strong" });
  if (existing !== null) return existing;

  const abs = path.join(process.cwd(), seedRelPath);
  const raw = await readFile(abs, "utf8");
  const parsed = JSON.parse(raw);

  // Seed for future requests
  await db.setJSON(key, parsed);

  return parsed;
}

/**
 * Read a bundled JSON file from the deployed site (no blob writes).
 */
export async function readBundledJSON(seedRelPath) {
  const abs = path.join(process.cwd(), seedRelPath);
  const raw = await readFile(abs, "utf8");
  return JSON.parse(raw);
}

export function jsonResponse(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function badRequest(msg, extra = {}) {
  return jsonResponse({ error: msg, ...extra }, 400);
}

export function methodNotAllowed(allowed = ["GET"]) {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { "Allow": allowed.join(", ") },
  });
}

/**
 * Mirrors the simple comptes cleanup you had in server.js.
 * - trims strings
 * - removes empty username/password
 */
export function sanitizeComptes(comptes) {
  if (!Array.isArray(comptes)) return [];
  return comptes
    .map((c) => {
      // Support legacy shapes:
      // - { name, password, blocked }
      // - { username, password }
      const name = String(c?.name ?? c?.username ?? "").trim();
      const password = String(c?.password ?? "").trim();
      const blocked = !!c?.blocked;
      return { name, password, blocked };
    })
    .filter((c) => c.name && c.password);
}

export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

export function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m === "image/png") return ".png";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/webp") return ".webp";
  return null;
}

export function arrayBufferFromBase64(b64) {
  const buf = Buffer.from(b64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
