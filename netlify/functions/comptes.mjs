import { db, getOrSeedJSON, readBundledJSON, jsonResponse, badRequest, methodNotAllowed, sanitizeComptes } from "./_lib.mjs";

const KEY = "comptes";
const SEED = "DATA/comptes.json";

export default async function handler(req) {
  if (req.method === "GET") {
    const raw = await getOrSeedJSON(KEY, SEED);
    const comptes = sanitizeComptes(raw);

    // If we loaded a legacy/invalid shape, persist the normalized format.
    // Also, if we ended up with an empty list but the bundled seed has accounts,
    // re-seed once (useful if a previous buggy deploy overwrote the blob).
    if (!Array.isArray(raw) || JSON.stringify(raw) !== JSON.stringify(comptes)) {
      await db.setJSON(KEY, comptes);
    } else if (Array.isArray(comptes) && comptes.length === 0) {
      const seeded = sanitizeComptes(await readBundledJSON(SEED));
      if (seeded.length > 0) {
        await db.setJSON(KEY, seeded);
        return jsonResponse({ comptes: seeded });
      }
    }

    return jsonResponse({ comptes });
  }

  if (req.method === "PUT") {
    let body;
    try {
      body = await req.json();
    } catch {
      return badRequest("invalid_json");
    }
    const comptes = sanitizeComptes(body?.comptes);
    await db.setJSON(KEY, comptes);
    return jsonResponse({ comptes });
  }

  return methodNotAllowed(["GET", "PUT"]);
}

export const config = {
  path: "/api/data/comptes",
};
