const crypto = require("node:crypto");
const { requireAdmin } = require("../_lib/auth");
const { readContent, writeContent } = require("../_lib/storage");

const ENTRY_TYPES = new Set(["government-structure", "authority", "agency", "institution", "office", "court", "national-system", "program", "article", "schedule", "identity"]);
const text = (value, limit) => String(value || "").trim().slice(0, limit);

function sanitizeEntry(value, existing = {}) {
  const title = text(value.title, 180);
  const summary = text(value.summary, 1200);
  if (!title || !summary) throw new Error("Title and summary are required.");
  const imageUrl = text(value.imageUrl, 800);
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) throw new Error("Image URL must begin with https://.");
  const sections = Array.isArray(value.sections) ? value.sections.slice(0, 50).map((section) => ({ title: text(section.title, 180), body: text(section.body, 20000) })).filter((section) => section.title || section.body) : [];
  return {
    id: existing.id || crypto.randomUUID(),
    entryType: ENTRY_TYPES.has(value.entryType) ? value.entryType : "institution",
    identifier: text(value.identifier, 80), title, summary,
    division: text(value.division, 180), source: text(value.source, 300), imageUrl,
    published: value.published === true || value.published === "true",
    order: Math.max(0, Math.min(9999, Number(value.order) || 1000)), sections,
    createdAt: existing.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!requireAdmin(request, response)) return;
  try {
    const content = await readContent();
    if (request.method === "GET") return response.status(200).json(content);
    if (request.method === "POST") {
      const index = content.entries.findIndex((entry) => entry.id === request.body?.id);
      const entry = sanitizeEntry(request.body || {}, index >= 0 ? content.entries[index] : {});
      if (index >= 0) content.entries[index] = entry;
      else content.entries.push(entry);
      await writeContent(content);
      return response.status(index >= 0 ? 200 : 201).json({ entry });
    }
    if (request.method === "DELETE") {
      const id = text(request.query?.id, 80);
      const nextEntries = content.entries.filter((entry) => entry.id !== id);
      if (nextEntries.length === content.entries.length) return response.status(404).json({ error: "Entry not found." });
      content.entries = nextEntries;
      await writeContent(content);
      return response.status(200).json({ deleted: id });
    }
    return response.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error("Administrator content operation failed", error);
    const message = error.message?.includes("required") || error.message?.includes("https://") ? error.message : "Unable to save the content record.";
    return response.status(500).json({ error: message });
  }
};
