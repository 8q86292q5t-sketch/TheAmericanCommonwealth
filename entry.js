const entryRoot = document.querySelector("[data-entry-page]");

if (entryRoot) {
  const entryId = new URLSearchParams(window.location.search).get("id");
  const element = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  fetch("/api/content", { credentials: "same-origin" })
    .then((response) => response.json())
    .then(({ entries = [] }) => {
      const entry = entries.find((item) => item.id === entryId);
      if (!entry) throw new Error("This public record was not found or is not published.");
      document.title = `${entry.title} | The Generational Commonwealth`;
      entryRoot.replaceChildren();

      const hero = element("section", "page-hero");
      const heroInner = element("div", "page-hero-inner");
      heroInner.append(element("p", "eyebrow", entry.entryType.replaceAll("-", " ")), element("h1", "", entry.title), element("p", "lede", entry.summary));
      hero.append(heroInner);
      entryRoot.append(hero);

      if (entry.imageUrl) {
        const media = element("figure", "supplemental-media");
        const image = document.createElement("img");
        image.src = entry.imageUrl;
        image.alt = entry.title;
        media.append(image);
        entryRoot.append(media);
      }

      const article = element("article", "supplemental-document");
      if (entry.identifier || entry.source || entry.division) {
        const record = element("div", "supplemental-record");
        for (const [label, value] of [["Identifier", entry.identifier], ["Directory division", entry.division], ["Source", entry.source]]) {
          if (!value) continue;
          const item = element("div");
          item.append(element("span", "section-kicker", label), element("p", "", value));
          record.append(item);
        }
        article.append(record);
      }
      entry.sections.forEach((section) => {
        const sectionNode = element("section", "supplemental-section");
        if (section.title) sectionNode.append(element("h2", "", section.title));
        section.body.split(/\n\s*\n/).filter(Boolean).forEach((paragraph) => sectionNode.append(element("p", "", paragraph.replace(/\s*\n\s*/g, " "))));
        article.append(sectionNode);
      });
      entryRoot.append(article);
    })
    .catch((error) => {
      entryRoot.replaceChildren();
      const message = element("section", "error-state");
      message.append(element("p", "eyebrow", "Public record"), element("h1", "", "Entry unavailable"), element("p", "", error.message));
      entryRoot.append(message);
    });
}
