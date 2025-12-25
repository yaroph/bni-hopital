import { jsonResponse } from "./_lib.mjs";

export default async function handler(req) {
  return jsonResponse({ ok: true, time: new Date().toISOString() });
}

export const config = {
  path: "/api/health",
};
