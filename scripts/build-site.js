const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const dist = join(root, "dist");
const data = JSON.parse(readFileSync(join(root, "content/site-data.json"), "utf8"));
const structuralArticleRomans = new Set(["III", "IV", "V", "VII", "XXI"]);
const articlesInOrder = [...data.articles].sort((a, b) => a.order - b.order);
const structuralArticles = articlesInOrder.filter((article) => structuralArticleRomans.has(article.roman));
const articleDirectory = articlesInOrder.filter((article) => !structuralArticleRomans.has(article.roman));
const articleByRoman = new Map(articlesInOrder.map((article) => [article.roman, article]));
const duplicatedInstitutionNames = new Set([
  "Five-Cohort Executive Council",
  "Assembly of State Delegations",
  "Judiciary and Constitutional Balance",
  "States and Municipalities",
]);
const governmentItems = [
  ...structuralArticles.map((article) => ({
    ...article,
    type: "structure",
    name: article.title,
    description: article.summary,
    articleNumber: article.number,
    sourceSlug: article.slug,
  })),
  ...data.institutions
    .filter((institution) => !duplicatedInstitutionNames.has(institution.name))
    .map((institution) => ({
      ...institution,
      type: "institution",
      articleNumber: institution.article,
    })),
];

const required = [
  "content/site-data.json",
  "styles.css",
  "script.js",
  "assets/generational-commonwealth-flag.png",
];

for (const file of required) {
  const path = join(root, file);
  if (!existsSync(path) || statSync(path).size === 0) {
    console.error(`Missing or empty file: ${file}`);
    process.exit(1);
  }
}

rmSync(dist, { force: true, recursive: true });
mkdirSync(join(dist, "assets"), { recursive: true });
mkdirSync(join(dist, "articles"), { recursive: true });
mkdirSync(join(dist, "agencies"), { recursive: true });
mkdirSync(join(dist, "government"), { recursive: true });

cpSync(join(root, "styles.css"), join(dist, "styles.css"));
cpSync(join(root, "script.js"), join(dist, "script.js"));
cpSync(join(root, "assets/generational-commonwealth-flag.png"), join(dist, "assets/generational-commonwealth-flag.png"));

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const pagePath = {
  home: "/",
  identity: "/identity.html",
  article: (item) => `/articles/${item.slug}.html`,
  agency: (item) => `/agencies/${item.slug}.html`,
  government: (item) => `/government/${item.slug}.html`,
};

const dropdown = (label, items, pathFor, formatter) => `
  <details class="nav-menu">
    <summary>${escapeHtml(label)}</summary>
    <div class="menu-panel">
      ${items.map((item) => `<a href="${pathFor(item)}">${formatter(item)}</a>`).join("")}
    </div>
  </details>
`;

const header = () => `
  <header class="site-header" data-header>
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">GC</span>
      <span>
        <strong>${escapeHtml(data.site.formalName)}</strong>
        <small>${escapeHtml(data.site.subtitle)}</small>
      </span>
    </a>
    <nav class="primary-nav" aria-label="Primary navigation">
      ${dropdown("Government", governmentItems, pagePath.government, (item) => escapeHtml(item.name))}
      ${dropdown("Agencies", data.agencies, pagePath.agency, (item) => escapeHtml(item.name))}
      ${dropdown("Articles", articleDirectory, pagePath.article, (item) => `${escapeHtml(item.number)}. ${escapeHtml(item.title)}`)}
      <a class="identity-link" href="${pagePath.identity}">Identity</a>
    </nav>
  </header>
`;

const layout = ({ title, description, body, pageClass = "" }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description || data.site.description)}" />
    <title>${escapeHtml(title)} | ${escapeHtml(data.site.formalName)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="${pageClass}">
    ${header()}
    <main>${body}</main>
    <footer class="site-footer">
      <span>${escapeHtml(data.site.constitutionTitle)}</span>
      <span>Complete Structural Edition</span>
    </footer>
    <script src="/script.js"></script>
  </body>
</html>`;

const cardGrid = (items, pathFor, metaFor) => `
  <div class="directory-grid">
    ${items.map((item) => `
      <a class="directory-card" href="${pathFor(item)}">
        <span>${escapeHtml(metaFor(item))}</span>
        <h3>${escapeHtml(item.name || item.title)}</h3>
        <p>${escapeHtml(item.description || item.summary)}</p>
      </a>
    `).join("")}
  </div>
`;

const sourceHrefForRoman = (roman) => {
  const source = articleByRoman.get(roman);
  if (!source) return "/";
  if (structuralArticleRomans.has(roman)) return `/government/${source.slug}.html`;
  return `/articles/${source.slug}.html`;
};

const renderTextBlocks = (blocks = [], className = "full-text") => `
  <div class="${className}">
    ${blocks.map((block) => {
      if (block.type === "heading") {
        return `<h3>${escapeHtml(block.text)}</h3>`;
      }
      if (block.type === "table") {
        return `
          <div class="data-table-wrap">
            <table class="data-table">
              ${block.caption ? `<caption>${escapeHtml(block.caption)}</caption>` : ""}
              <thead>
                <tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${block.rows.map((row) => `
                  <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }
      return `<p>${escapeHtml(block.text)}</p>`;
    }).join("")}
  </div>
`;

const homepage = () => layout({
  title: "Official Portal",
  description: data.site.description,
  pageClass: "home-page",
  body: `
    <section class="hero official-hero">
      <div class="hero-copy">
        <p class="eyebrow">Official constitutional portal</p>
        <h1>${escapeHtml(data.site.formalName)}</h1>
        <p class="lede">${escapeHtml(data.site.description)}</p>
        <div class="hero-actions">
          <a class="button primary" href="/identity.html">National identity</a>
          <a class="button secondary" href="/articles/article-i.html">Read the constitution</a>
        </div>
      </div>
      <figure class="flag-figure">
        <img src="${data.site.flag}" alt="Flag of the Generational Commonwealth" />
        <figcaption>Flag of the Generational Commonwealth</figcaption>
      </figure>
    </section>

    <section class="intro-band">
      <div>
        <p class="section-kicker">Constitutional structure</p>
        <h2>Distributed authority, measurable administration, and generational representation.</h2>
      </div>
      <p>The portal separates high governmental structure from ordinary article reading order. Government contains the cohort system, executive council, state delegations, judiciary, state and municipal structure, and major courts. Agencies contains definable public bodies. Articles contains the remaining non-structural constitutional provisions in numeric order.</p>
    </section>

    <section class="content-section">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Government</p>
          <h2>High constitutional structures and courts</h2>
        </div>
        <a href="/government/article-iv.html">Executive council</a>
      </div>
      ${cardGrid(governmentItems.slice(0, 6), pagePath.government, (item) => `Article ${item.articleNumber}`)}
    </section>

    <section class="content-section shaded">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Agencies</p>
          <h2>Authorities, offices, services, and programs</h2>
        </div>
        <a href="/agencies/office-of-national-performance-and-accountability.html">Agency directory</a>
      </div>
      ${cardGrid(data.agencies.slice(0, 6), pagePath.agency, (item) => `Article ${item.article}`)}
    </section>

    <section class="content-section article-index">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Articles</p>
          <h2>Non-structural article directory</h2>
        </div>
        <a href="/identity.html">Identity replaces Article XXXVII</a>
      </div>
      <ol class="article-list">
        ${articleDirectory.map((item) => `
          <li>
            <a href="${pagePath.article(item)}">
              <span>${escapeHtml(item.number)}</span>
              <strong>${escapeHtml(item.title)}</strong>
            </a>
          </li>
        `).join("")}
      </ol>
    </section>
  `,
});

const articlePage = (article) => layout({
  title: `${article.number}. ${article.title}`,
  description: article.summary,
  pageClass: "document-page",
  body: `
    <section class="page-hero">
      <p class="breadcrumb"><a href="/">Home</a> / Articles / ${escapeHtml(article.number)}</p>
      <p class="eyebrow">Constitutional article</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="lede">${escapeHtml(article.summary)}</p>
    </section>
    <section class="document-layout">
      <aside class="document-aside">
        <span>Article</span>
        <strong>${escapeHtml(article.number)}</strong>
      </aside>
      <article class="document-card">
        <h2>Complete constitutional text</h2>
        ${renderTextBlocks(article.textBlocks, "full-text article-text")}
        ${article.sections.length ? `
          <h2>Selected sections</h2>
          <ul class="section-list">
            ${article.sections.map((section) => `<li>${escapeHtml(section)}</li>`).join("")}
          </ul>
        ` : ""}
      </article>
    </section>
  `,
});

const agencyPage = (agency) => layout({
  title: agency.name,
  description: agency.description,
  pageClass: "document-page",
  body: (() => {
    const sourceArticle = articleByRoman.get(agency.article);
    const sourceHref = sourceHrefForRoman(agency.article);
    return `
    <section class="page-hero compact">
      <p class="breadcrumb"><a href="/">Home</a> / Agencies / ${escapeHtml(agency.name)}</p>
      <p class="eyebrow">Agency directory</p>
      <h1>${escapeHtml(agency.name)}</h1>
      <p class="lede">${escapeHtml(agency.description)}</p>
    </section>
    <section class="detail-grid">
      <article class="document-card agency-definition">
        <h2>Definition</h2>
        <p>The ${escapeHtml(agency.name)} is a constitutionally identified public body of the Generational Commonwealth. Its defined public purpose is: ${escapeHtml(agency.description)}</p>
        <h2>Constitutional source</h2>
        <p>This agency is associated with Article ${escapeHtml(agency.article)}: <a href="${sourceHref}">${escapeHtml(agency.articleTitle)}</a>.</p>
        <h2>Core public functions</h2>
        <ul class="duty-list">
          <li>Administer the public mandate assigned to it by the constitution and any lawful implementing legislation.</li>
          <li>Publish clear public records, standards, determinations, and review materials for its assigned domain.</li>
          <li>Coordinate with ONPA for measurable performance, fiscal review, delivery review, and intergenerational impact review.</li>
          <li>Maintain due process, privacy, appeal rights, and accessible public service procedures.</li>
        </ul>
        <h2>Public interface</h2>
        <p>This page is structured as the agency's official public definition. It can later receive leadership information, service portals, forms, notices, reports, dashboards, and public records without changing the site architecture.</p>
        ${sourceArticle?.textBlocks?.length ? `
          <h2>Mirrored constitutional article</h2>
          <p class="mirror-note">The full establishing article is reproduced below so this agency page can stand on its own without requiring a separate article-page jump.</p>
          <div class="scroll-window" tabindex="0" aria-label="Mirrored text of Article ${escapeHtml(agency.article)}">
            ${renderTextBlocks(sourceArticle.textBlocks, "full-text mirror-text")}
          </div>
        ` : ""}
      </article>
      <aside class="seal-panel">
        <span class="large-mark">GC</span>
        <p>Public authority must be lawful, measurable, reviewable, and subject to meaningful appeal.</p>
      </aside>
    </section>
  `;
  })(),
});

const governmentPage = (item) => {
  const sourceArticle = articleByRoman.get(item.articleNumber);
  const sourceHref = sourceHrefForRoman(item.articleNumber);
  const sourceLabel = item.articleTitle || item.title || item.name;
  const roleLabel = item.type === "structure" ? "High governmental structure" : "Constitutional institution";

  return layout({
  title: item.name,
  description: item.description,
  pageClass: "document-page",
  body: `
    <section class="page-hero compact">
      <p class="breadcrumb"><a href="/">Home</a> / Government / ${escapeHtml(item.name)}</p>
      <p class="eyebrow">${escapeHtml(roleLabel)}</p>
      <h1>${escapeHtml(item.name)}</h1>
      <p class="lede">${escapeHtml(item.description)}</p>
    </section>
    <section class="detail-grid">
      <article class="document-card">
        <h2>Constitutional placement</h2>
        <p>This government structure is grounded in Article ${escapeHtml(item.articleNumber)}: <a href="${sourceHref}">${escapeHtml(sourceLabel)}</a>.</p>
        <p>It is excluded from the Articles dropdown and article count because it establishes the governmental architecture itself rather than an ordinary policy or rights article.</p>
        ${sourceArticle?.textBlocks?.length ? `
          <h2>Mirrored constitutional article</h2>
          <p class="mirror-note">The full source article is reproduced below for direct review inside this government page.</p>
          <div class="scroll-window" tabindex="0" aria-label="Mirrored text of Article ${escapeHtml(item.articleNumber)}">
            ${renderTextBlocks(sourceArticle.textBlocks, "full-text mirror-text")}
          </div>
        ` : ""}
      </article>
      <aside class="seal-panel">
        <span class="large-mark">GC</span>
        <p>Distributed authority is the constitutional safeguard against concentration of public power.</p>
      </aside>
    </section>
  `,
});
};

const identityPage = () => layout({
  title: "National Identity",
  description: data.identity.summary,
  pageClass: "identity-page",
  body: `
    <section class="page-hero identity-hero expanded-identity">
      <div class="identity-copy">
        <p class="breadcrumb"><a href="/">Home</a> / Identity</p>
        <p class="eyebrow">${escapeHtml(data.identity.source)}</p>
        <h1>${escapeHtml(data.identity.title)}</h1>
        <p class="lede">${escapeHtml(data.identity.summary)}</p>
      </div>
      <figure class="identity-flag">
        <img src="${data.site.flag}" alt="Flag of the Generational Commonwealth" />
        <figcaption>Official flag of the Generational Commonwealth</figcaption>
      </figure>
    </section>
    <section class="identity-sections">
      <article class="document-card identity-panel flag-panel">
        <h2>Flag</h2>
        <p>${escapeHtml(data.identity.flagMeaning)}</p>
      </article>
      <article class="document-card identity-panel animal-panel">
        <h2>National animal</h2>
        <p>${escapeHtml(data.identity.animal)}</p>
      </article>
      <article class="document-card identity-panel text-panel">
        <h2>Constitutional text basis</h2>
        ${renderTextBlocks(data.identity.textBlocks || data.identity.excerpt.map((text) => ({ type: "paragraph", text })), "full-text article-text")}
      </article>
    </section>
  `,
});

writeFileSync(join(dist, "index.html"), homepage());
writeFileSync(join(dist, "identity.html"), identityPage());

for (const article of articleDirectory) {
  writeFileSync(join(dist, "articles", `${article.slug}.html`), articlePage(article));
}

for (const agency of data.agencies) {
  writeFileSync(join(dist, "agencies", `${agency.slug}.html`), agencyPage(agency));
}

for (const item of governmentItems) {
  writeFileSync(join(dist, "government", `${item.slug}.html`), governmentPage(item));
}

console.log(`Built ${articleDirectory.length} article pages, ${data.agencies.length} agency pages, ${governmentItems.length} government pages, and identity page to dist.`);
