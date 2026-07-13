const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const dist = join(root, "dist");
const data = JSON.parse(readFileSync(join(root, "content/site-data.json"), "utf8"));

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
mkdirSync(join(dist, "institutions"), { recursive: true });

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
  institution: (item) => `/institutions/${item.slug}.html`,
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
      ${dropdown("Institutions", data.institutions, pagePath.institution, (item) => escapeHtml(item.name))}
      ${dropdown("Agencies", data.agencies, pagePath.agency, (item) => escapeHtml(item.name))}
      ${dropdown("Articles", data.articles, pagePath.article, (item) => `${escapeHtml(item.number)}. ${escapeHtml(item.title)}`)}
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
      <p>The portal organizes the constitution into three public directories: institutions of government, agencies and public authorities, and constitutional articles. Article XXXVII is presented as a separate Identity page for the flag and national animal.</p>
    </section>

    <section class="content-section">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Institutions</p>
          <h2>Constitutional organs of government</h2>
        </div>
        <a href="/institutions/five-cohort-executive-council.html">First institution</a>
      </div>
      ${cardGrid(data.institutions.slice(0, 6), pagePath.institution, (item) => `Article ${item.article}`)}
    </section>

    <section class="content-section shaded">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Agencies</p>
          <h2>Authorities, offices, services, and programs</h2>
        </div>
        <a href="/agencies/office-of-national-performance-and-accountability.html">First agency</a>
      </div>
      ${cardGrid(data.agencies.slice(0, 6), pagePath.agency, (item) => `Article ${item.article}`)}
    </section>

    <section class="content-section article-index">
      <div class="section-heading">
        <div>
          <p class="section-kicker">Articles</p>
          <h2>Constitutional article directory</h2>
        </div>
        <a href="/identity.html">Article XXXVII identity material</a>
      </div>
      <ol class="article-list">
        ${data.articles.map((item) => `
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
        <h2>Operative overview</h2>
        ${article.excerpt.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
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
  body: `
    <section class="page-hero compact">
      <p class="breadcrumb"><a href="/">Home</a> / Agencies / ${escapeHtml(agency.name)}</p>
      <p class="eyebrow">Agency directory</p>
      <h1>${escapeHtml(agency.name)}</h1>
      <p class="lede">${escapeHtml(agency.description)}</p>
    </section>
    <section class="detail-grid">
      <article class="document-card">
        <h2>Constitutional source</h2>
        <p>This office, authority, program, or public body is associated with Article ${escapeHtml(agency.article)}: <a href="/articles/${escapeHtml(agency.sourceSlug)}.html">${escapeHtml(agency.articleTitle)}</a>.</p>
        <p>The agency page is intentionally concise so future prompts can add leadership, statutory duties, forms, notices, public records, or service dashboards.</p>
      </article>
      <aside class="seal-panel">
        <span class="large-mark">GC</span>
        <p>Public authority must be lawful, measurable, reviewable, and subject to meaningful appeal.</p>
      </aside>
    </section>
  `,
});

const institutionPage = (institution) => layout({
  title: institution.name,
  description: institution.description,
  pageClass: "document-page",
  body: `
    <section class="page-hero compact">
      <p class="breadcrumb"><a href="/">Home</a> / Institutions / ${escapeHtml(institution.name)}</p>
      <p class="eyebrow">Constitutional institution</p>
      <h1>${escapeHtml(institution.name)}</h1>
      <p class="lede">${escapeHtml(institution.description)}</p>
    </section>
    <section class="detail-grid">
      <article class="document-card">
        <h2>Constitutional placement</h2>
        <p>This institution is grounded in Article ${escapeHtml(institution.article)}: <a href="/articles/${escapeHtml(institution.sourceSlug)}.html">${escapeHtml(institution.articleTitle)}</a>.</p>
        <p>It is listed outside the agency directory because it is part of the constitutional structure of government rather than an ordinary administrative body.</p>
      </article>
      <aside class="seal-panel">
        <span class="large-mark">GC</span>
        <p>Distributed authority is the constitutional safeguard against concentration of public power.</p>
      </aside>
    </section>
  `,
});

const identityPage = () => layout({
  title: "National Identity",
  description: data.identity.summary,
  pageClass: "identity-page",
  body: `
    <section class="page-hero identity-hero">
      <div>
        <p class="breadcrumb"><a href="/">Home</a> / Identity</p>
        <p class="eyebrow">${escapeHtml(data.identity.source)}</p>
        <h1>${escapeHtml(data.identity.title)}</h1>
        <p class="lede">${escapeHtml(data.identity.summary)}</p>
      </div>
      <figure class="identity-flag">
        <img src="${data.site.flag}" alt="Flag of the Generational Commonwealth" />
      </figure>
    </section>
    <section class="detail-grid">
      <article class="document-card">
        <h2>Flag</h2>
        <p>${escapeHtml(data.identity.flagMeaning)}</p>
        <h2>National animal</h2>
        <p>${escapeHtml(data.identity.animal)}</p>
      </article>
      <article class="document-card">
        <h2>Constitutional text basis</h2>
        ${data.identity.excerpt.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </article>
    </section>
  `,
});

writeFileSync(join(dist, "index.html"), homepage());
writeFileSync(join(dist, "identity.html"), identityPage());

for (const article of data.articles) {
  writeFileSync(join(dist, "articles", `${article.slug}.html`), articlePage(article));
}

for (const agency of data.agencies) {
  writeFileSync(join(dist, "agencies", `${agency.slug}.html`), agencyPage(agency));
}

for (const institution of data.institutions) {
  writeFileSync(join(dist, "institutions", `${institution.slug}.html`), institutionPage(institution));
}

console.log(`Built ${data.articles.length} article pages, ${data.agencies.length} agency pages, ${data.institutions.length} institution pages, and identity page to dist.`);
