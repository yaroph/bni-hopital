import { db, getOrSeedJSON, jsonResponse, badRequest, methodNotAllowed } from "./_lib.mjs";

const KEY = "store";
const SEED = "DATA/store.json";

function normalizeStore(store) {
  const extra = store?.extra && typeof store.extra === "object" ? store.extra : {};
  const customPatients = Array.isArray(store?.customPatients) ? store.customPatients : [];
  return { extra, customPatients };
}

export default async function handler(req) {
  if (req.method === "GET") {
    const store = await getOrSeedJSON(KEY, SEED);
    return jsonResponse(normalizeStore(store));
  }

  if (req.method === "PUT") {
    let body;
    try {
      body = await req.json();
    } catch {
      return badRequest("invalid_json");
    }
    const store = normalizeStore(body);
    await db.setJSON(KEY, store);
    return jsonResponse(store);
  }

  return methodNotAllowed(["GET", "PUT"]);
}

export const config = {
  path: "/api/store",
};
