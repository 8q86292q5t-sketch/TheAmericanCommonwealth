const { readContent } = require("./_lib/storage");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  try {
    const content = await readContent();
    const entries = content.entries.filter((entry) => entry.published).sort((left, right) => (left.order || 1000) - (right.order || 1000) || left.title.localeCompare(right.title));
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return response.status(200).json({ entries });
  } catch (error) {
    console.error("Unable to read public content", error);
    return response.status(503).json({ error: "Supplemental content is temporarily unavailable.", entries: [] });
  }
};
