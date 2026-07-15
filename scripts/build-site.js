const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const dist = join(root, "dist");
const data = JSON.parse(readFileSync(join(root, "content/site-data.json"), "utf8"));
const articles = [...data.articles].sort((left, right) => left.order - right.order);
const articleBySlug = new Map(articles.map((article) => [article.slug, article]));
const directoryEntries = data.directorySections.flatMap((section) => section.entries);

const required = [
  "content/site-data.json",
  "styles.css",
  "script.js",
  "admin.js",
  "entry.js",
  "assets/generational-commonwealth-flag.png",
  "assets/american-builder-beaver.png",
];

for (const file of required) {
  const path = join(root, file);
  if (!existsSync(path) || statSync(path).size === 0) {
    throw new Error(`Missing or empty required file: ${file}`);
  }
}

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const slugify = (value = "") => String(value)
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "section";

const paths = {
  home: "/",
  identity: "/identity.html",
  constitution: "/constitution.html",
  directory: "/directory.html",
  admin: "/admin.html",
  article: (item) => `/articles/${item.slug}.html`,
  schedule: (item) => `/schedules/${item.slug}.html`,
  government: (item) => `/government/${item.slug}.html`,
  institution: (item) => `/institutions/${item.slug}.html`,
};

const menu = (label, content, group = "") => `
  <details class="nav-menu">
    <summary>${escapeHtml(label)}</summary>
    <div class="menu-panel"${group ? ` data-dynamic-menu="${group}"` : ""}>${content}</div>
  </details>`;

const menuLinks = (items, pathFor, labelFor) => items
  .map((item) => `<a href="${pathFor(item)}">${escapeHtml(labelFor(item))}</a>`)
  .join("");

const header = () => {
  const institutionGroups = data.directorySections.map((section) => `
    <section class="menu-group">
      <h2>${escapeHtml(section.title)}</h2>
      ${menuLinks(section.entries, paths.institution, (item) => item.name)}
    </section>`).join("");

  return `
  <header class="site-header" data-header>
    <a class="brand" href="/" aria-label="${escapeHtml(data.site.formalName)} home">
      <span class="brand-mark" aria-hidden="true">GC</span>
      <span class="brand-name">
        <strong>${escapeHtml(data.site.formalName)}</strong>
        <small>Constitutional portal</small>
      </span>
    </a>
    <nav class="primary-nav" aria-label="Primary navigation">
      ${menu("Government", `
        <a class="menu-feature" href="/government.html">Constitutional government overview</a>
        ${menuLinks(data.branches.items, paths.government, (item) => item.name)}
      `, "government-structure")}
      ${menu("Institutions", `
        <a class="menu-feature" href="${paths.directory}">Complete public-body directory</a>
        ${institutionGroups}
      `, "institutions")}
      ${menu("Articles", menuLinks(articles, paths.article, (item) => `${item.identifier}: ${item.title}`), "articles")}
      ${menu("Schedules", `
        ${menuLinks(data.schedules, paths.schedule, (item) => `${item.identifier}: ${item.title}`)}
        <a href="/schedules/final-attestation.html">Final Attestation: Oath and Public Trust</a>
      `, "schedules")}
      <a class="nav-link" href="${paths.identity}">Purpose &amp; Identity</a>
      <a class="admin-button" href="${paths.admin}"><span aria-hidden="true">●</span> Admin</a>
    </nav>
    <button class="mobile-nav-button" type="button" aria-label="Open navigation" aria-expanded="false" data-mobile-nav>Menu</button>
  </header>`;
};

const layout = ({ title, description, body, pageClass = "", scripts = [] }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description || data.site.description)}" />
    <meta name="theme-color" content="#071c36" />
    <title>${escapeHtml(title)} | ${escapeHtml(data.site.formalName)}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="${escapeHtml(pageClass)}">
    ${header()}
    <main>${body}</main>
    <footer class="site-footer">
      <div><strong>${escapeHtml(data.site.constitutionTitle)}</strong><span>${escapeHtml(data.site.edition)}</span></div>
      <p>${escapeHtml(data.site.description)}</p>
    </footer>
    <script src="/script.js"></script>
    ${scripts.map((script) => `<script src="${script}"></script>`).join("\n    ")}
  </body>
</html>`;

const sectionEntries = (blocks = []) => {
  let index = 0;
  return blocks.flatMap((block) => {
    if (block.type !== "heading") return [];
    index += 1;
    return [{ ...block, id: `section-${index}-${slugify(block.text)}` }];
  });
};

const renderTable = (block) => `
  <div class="data-table-wrap">
    <table class="data-table">
      <thead><tr>${block.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;

const renderBlocks = (blocks = [], { linkSections = false, compact = false } = {}) => {
  const sections = sectionEntries(blocks);
  let headingIndex = 0;
  return `<div class="document-copy${compact ? " compact-copy" : ""}">${blocks.map((block) => {
    if (block.type === "heading") {
      const section = sections[headingIndex++];
      const attributes = linkSections ? ` id="${section.id}" data-document-section` : "";
      return `<section class="document-section"${attributes}>
        ${block.label ? `<p class="section-label">${escapeHtml(block.label)}</p>` : ""}
        <h2>${escapeHtml(block.text)}</h2>
      </section>`;
    }
    if (block.type === "unordered-list") {
      return `<ul class="constitutional-list">${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    if (block.type === "table") return renderTable(block);
    return `<p>${escapeHtml(block.text)}</p>`;
  }).join("")}</div>`;
};

const pageHero = ({ eyebrow, title, lede, breadcrumb = "" }) => `
  <section class="page-hero">
    <div class="page-hero-inner">
      ${breadcrumb ? `<p class="breadcrumb">${breadcrumb}</p>` : ""}
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      ${lede ? `<p class="lede">${escapeHtml(lede)}</p>` : ""}
    </div>
  </section>`;

const cards = (items, pathFor, metaFor) => `<div class="directory-grid">${items.map((item) => `
  <a class="directory-card" href="${pathFor(item)}">
    <span>${escapeHtml(metaFor(item))}</span>
    <h3>${escapeHtml(item.name || item.title)}</h3>
    <p>${escapeHtml(item.role || item.summary || item.authority || "")}</p>
  </a>`).join("")}</div>`;

const homepage = () => layout({
  title: "Official Constitutional Portal",
  description: data.site.description,
  pageClass: "home-page",
  body: `
    <section class="home-hero">
      <img src="${data.site.flag}" alt="" aria-hidden="true" />
      <div class="home-hero-overlay"></div>
      <div class="home-hero-copy">
        <p class="eyebrow">Comprehensive canonical structural edition</p>
        <h1>${escapeHtml(data.site.formalName)}</h1>
        <p>${escapeHtml(data.site.description)}</p>
        <div class="hero-actions">
          <a class="button light" href="/articles/article-i.html">Read the Constitution</a>
          <a class="button outline" href="${paths.identity}">Purpose and identity</a>
        </div>
      </div>
    </section>
    <section class="portal-band">
      <a href="/government.html"><span>Government</span><strong>Six constitutional bodies</strong></a>
      <a href="${paths.directory}"><span>Public institutions</span><strong>${directoryEntries.length} defined bodies and systems</strong></a>
      <a href="/articles/article-i.html"><span>Constitution</span><strong>${articles.length} canonical articles</strong></a>
      <a href="/schedules/schedule-a.html"><span>Reference</span><strong>Schedules and final oath</strong></a>
    </section>
    <section class="content-section split-intro">
      <div>
        <p class="section-kicker">Constitutional intention</p>
        <h2>A government designed to distribute power, measure results, and preserve civil society.</h2>
      </div>
      <div>${renderBlocks(data.preliminary.blocks, { compact: true })}<a class="text-link" href="${paths.identity}">Read the purpose and national identity</a></div>
    </section>
    <section class="content-section ruled-section">
      <div class="section-heading"><div><p class="section-kicker">Government</p><h2>Constitutional bodies</h2></div><a href="/government.html">View structure</a></div>
      ${cards(data.branches.items, paths.government, () => "Constitutional body")}
    </section>
    <section class="content-section article-directory-band">
      <div class="section-heading"><div><p class="section-kicker">Canonical text</p><h2>All constitutional articles</h2></div><a href="/articles/article-i.html">Begin with Article I</a></div>
      <ol class="article-index">${articles.map((article) => `<li><a href="${paths.article(article)}"><span>${article.roman}</span><strong>${escapeHtml(article.title)}</strong></a></li>`).join("")}</ol>
    </section>`,
});

const identityPage = () => layout({
  title: data.identity.title,
  description: "The intention, flag, and national animal of the Generational Commonwealth.",
  pageClass: "identity-page",
  body: `
    ${pageHero({
      eyebrow: "National purpose and symbols",
      title: "A constitutional design built around continuity, evidence, and shared power.",
      lede: data.site.description,
      breadcrumb: '<a href="/">Home</a> / Purpose &amp; Identity',
    })}
    <section class="content-section identity-intention">
      <div class="identity-intro-title"><p class="section-kicker">Design intention</p><h2>${escapeHtml(data.preliminary.title)}</h2></div>
      ${renderBlocks(data.preliminary.blocks)}
    </section>
    <section class="identity-symbol flag-symbol">
      <div class="symbol-media"><img src="${data.site.flag}" alt="The national flag of the Generational Commonwealth" /></div>
      <div class="symbol-copy"><p class="section-kicker">National symbol</p><h2>${escapeHtml(data.identity.flag.title)}</h2>${renderBlocks(data.identity.flag.blocks)}</div>
    </section>
    <section class="identity-symbol animal-symbol">
      <div class="symbol-media"><img src="${data.site.animal}" alt="An American beaver constructing and maintaining a dam" /></div>
      <div class="symbol-copy"><p class="section-kicker">National animal</p><h2>${escapeHtml(data.identity.animal.title)}</h2><p class="scientific-name"><em>${escapeHtml(data.identity.animal.species)}</em></p>${renderBlocks(data.identity.animal.blocks)}</div>
    </section>`,
});

const governmentOverview = () => layout({
  title: data.branches.title,
  description: data.branches.introduction,
  body: `
    ${pageHero({ eyebrow: "Government structure", title: data.branches.title, lede: data.branches.introduction, breadcrumb: '<a href="/">Home</a> / Government' })}
    <section class="content-section">${cards(data.branches.items, paths.government, () => "Constitutional body")}</section>
    <section class="content-section flow-section"><div class="section-heading"><div><p class="section-kicker">Public action</p><h2>Core decision flow</h2></div></div>
      <ol class="decision-flow">${data.branches.flow.map((row) => `<li><strong>${escapeHtml(row[0])}</strong><p>${escapeHtml(row[1])}</p></li>`).join("")}</ol>
    </section>`,
});

const mirror = (sourceSlugs = []) => {
  const sources = sourceSlugs.map((slug) => articleBySlug.get(slug)).filter(Boolean);
  if (!sources.length) return `<p class="empty-note">No singular establishing article is assigned in the canonical directory. The body's controlling role is stated above.</p>`;
  return `<div class="source-mirror">${sources.map((article) => `
    <article class="mirrored-article">
      <header><span>${escapeHtml(article.identifier)}</span><h3>${escapeHtml(article.title)}</h3><a href="${paths.article(article)}">Open article page</a></header>
      ${renderBlocks(article.blocks, { compact: true })}
    </article>`).join("")}</div>`;
};

const governmentPage = (item) => layout({
  title: item.name,
  description: item.authority,
  pageClass: "entity-page",
  body: `
    ${pageHero({ eyebrow: "Constitutional body", title: item.name, lede: item.authority, breadcrumb: '<a href="/">Home</a> / <a href="/government.html">Government</a>' })}
    <section class="content-section definition-grid">
      <div><p class="section-kicker">Composition</p><p>${escapeHtml(item.composition)}</p></div>
      <div><p class="section-kicker">Primary authority</p><p>${escapeHtml(item.authority)}</p></div>
      <div><p class="section-kicker">Principal checks</p><p>${escapeHtml(item.checks)}</p></div>
    </section>
    <section class="content-section canonical-source"><div class="section-heading"><div><p class="section-kicker">Canonical source</p><h2>Constitutional text</h2></div><span>Scrollable full-text mirror</span></div>${mirror(item.sourceArticles)}</section>`,
});

const directoryPage = () => layout({
  title: "Public Institutions Directory",
  description: "Agencies, authorities, institutions, offices, courts, programs, and national systems.",
  body: `
    ${pageHero({ eyebrow: "Official directory", title: "Agencies, authorities, institutions, and national systems", lede: "The canonical directory of public bodies established or referenced throughout the Constitution.", breadcrumb: '<a href="/">Home</a> / Institutions' })}
    ${data.directorySections.map((section) => `<section class="content-section directory-section" id="${section.slug}"><div class="section-heading"><div><p class="section-kicker">Directory division</p><h2>${escapeHtml(section.title)}</h2></div><span>${section.entries.length} entries</span></div>${cards(section.entries, paths.institution, (item) => item.entryType.replaceAll("-", " "))}</section>`).join("")}`,
});

const institutionPage = (item) => layout({
  title: item.name,
  description: item.role,
  pageClass: "entity-page",
  body: `
    ${pageHero({ eyebrow: item.entryType.replaceAll("-", " "), title: item.name, lede: item.role, breadcrumb: '<a href="/">Home</a> / <a href="/directory.html">Institutions</a>' })}
    <section class="content-section institutional-record">
      <div><p class="section-kicker">Directory division</p><h2>${escapeHtml(item.directorySection)}</h2></div>
      <div><p class="section-kicker">Primary constitutional role</p><p>${escapeHtml(item.role)}</p></div>
    </section>
    <section class="content-section canonical-source"><div class="section-heading"><div><p class="section-kicker">Canonical source</p><h2>Constitutional text</h2></div><span>Scrollable full-text mirror</span></div>${mirror(item.sourceArticles)}</section>`,
});

const documentRail = (identifier, title, sections) => `
  <aside class="document-rail" aria-label="Document navigation">
    <div class="rail-block document-identity"><span>${escapeHtml(identifier)}</span><strong>${escapeHtml(title)}</strong></div>
    ${sections.length ? `<nav class="rail-block section-nav" aria-label="Sections in this document"><h2>Sections</h2>${sections.map((section) => `<a href="#${section.id}" data-section-link>${section.label ? `<span>${escapeHtml(section.label)}</span>` : ""}${escapeHtml(section.text)}</a>`).join("")}</nav>` : ""}
  </aside>`;

const constitutionalDocumentPage = (document, kind) => {
  const sections = sectionEntries(document.blocks);
  return layout({
    title: `${document.identifier}: ${document.title}`,
    description: document.summary || `${document.identifier}, ${document.title}`,
    pageClass: "document-page",
    body: `
      ${pageHero({ eyebrow: kind, title: document.title, lede: document.summary || "", breadcrumb: `<a href="/">Home</a> / ${escapeHtml(kind)}` })}
      <div class="document-layout">
        ${documentRail(document.identifier, document.title, sections)}
        <article class="constitutional-document">${renderBlocks(document.blocks, { linkSections: true })}</article>
      </div>`,
  });
};

const constitutionPage = () => layout({
  title: data.preliminary.title,
  description: data.site.description,
  body: `${pageHero({ eyebrow: "Canonical edition", title: data.preliminary.title, lede: data.site.description, breadcrumb: '<a href="/">Home</a> / Constitution' })}<div class="document-layout">${documentRail("Preliminary", data.preliminary.title, sectionEntries(data.preliminary.blocks))}<article class="constitutional-document">${renderBlocks(data.preliminary.blocks, { linkSections: true })}</article></div>`,
});

const adminPage = () => layout({
  title: "Content Administration",
  description: "Password-protected content administration for the Generational Commonwealth portal.",
  pageClass: "admin-page",
  scripts: ["/admin.js"],
  body: `
    ${pageHero({ eyebrow: "Restricted access", title: "Content administration", lede: "Create and manage supplemental public entries without altering the canonical source edition.", breadcrumb: '<a href="/">Home</a> / Admin' })}
    <section class="admin-shell" data-admin-root>
      <div class="admin-login" data-admin-login>
        <form class="login-form" data-login-form>
          <div><p class="section-kicker">Administrator authentication</p><h2>Sign in</h2></div>
          <label for="admin-password">Password</label>
          <div class="password-row"><input id="admin-password" name="password" type="password" autocomplete="current-password" required /><button class="button dark" type="submit">Sign in</button></div>
          <p class="form-status" data-login-status aria-live="polite"></p>
        </form>
      </div>
      <div class="admin-workspace" data-admin-workspace hidden>
        <aside class="admin-list-pane">
          <div class="admin-pane-heading"><div><p class="section-kicker">Supplemental records</p><h2>Entries</h2></div><button class="icon-command" type="button" data-new-entry title="Create a new entry" aria-label="Create a new entry">+</button></div>
          <div class="admin-entry-list" data-entry-list></div>
          <button class="text-command" type="button" data-logout>Sign out</button>
        </aside>
        <form class="entry-editor" data-entry-form>
          <input type="hidden" name="id" />
          <div class="editor-heading"><div><p class="section-kicker">Entry editor</p><h2 data-editor-title>New entry</h2></div><div class="editor-actions"><button class="text-command danger" type="button" data-delete-entry hidden>Delete</button><button class="button dark" type="submit">Save entry</button></div></div>
          <p class="form-status" data-editor-status aria-live="polite"></p>
          <div class="form-grid">
            <label>Entry type<select name="entryType" required>
              <option value="government-structure">Government structure</option>
              <option value="authority">Authority</option>
              <option value="agency">Agency</option>
              <option value="institution">Institution</option>
              <option value="office">Office</option>
              <option value="court">Court</option>
              <option value="national-system">National system</option>
              <option value="program">Program</option>
              <option value="article">Article</option>
              <option value="schedule">Schedule</option>
              <option value="identity">Purpose or identity</option>
            </select></label>
            <label>Identifier<input name="identifier" maxlength="80" placeholder="Article XL or supplemental record" /></label>
            <label class="full-field">Title<input name="title" maxlength="180" required /></label>
            <label class="full-field">Summary<textarea name="summary" rows="4" maxlength="1200" required></textarea></label>
            <label>Directory division<input name="division" maxlength="180" /></label>
            <label>Image URL<input name="imageUrl" type="url" maxlength="800" placeholder="https://" /></label>
            <label class="full-field">Constitutional source or note<input name="source" maxlength="300" /></label>
            <label>Publication status<select name="published"><option value="true">Published</option><option value="false">Draft</option></select></label>
            <label>Display order<input name="order" type="number" min="0" max="9999" value="1000" /></label>
          </div>
          <div class="section-editor-heading"><div><p class="section-kicker">Page content</p><h3>Sections</h3></div><button class="text-command" type="button" data-add-section>Add section</button></div>
          <div class="section-editor" data-section-editor></div>
        </form>
      </div>
    </section>`,
});

const entryPage = () => layout({
  title: "Supplemental Entry",
  description: "Supplemental public record.",
  pageClass: "dynamic-entry-page",
  scripts: ["/entry.js"],
  body: `<section class="dynamic-entry-shell" data-entry-page><p class="loading-state">Loading public record…</p></section>`,
});

rmSync(dist, { recursive: true, force: true });
for (const directory of ["assets", "articles", "schedules", "government", "institutions"]) {
  mkdirSync(join(dist, directory), { recursive: true });
}
for (const file of ["styles.css", "script.js", "admin.js", "entry.js"]) cpSync(join(root, file), join(dist, file));
for (const file of ["generational-commonwealth-flag.png", "american-builder-beaver.png"]) cpSync(join(root, "assets", file), join(dist, "assets", file));

writeFileSync(join(dist, "index.html"), homepage());
writeFileSync(join(dist, "identity.html"), identityPage());
writeFileSync(join(dist, "government.html"), governmentOverview());
writeFileSync(join(dist, "directory.html"), directoryPage());
writeFileSync(join(dist, "constitution.html"), constitutionPage());
writeFileSync(join(dist, "admin.html"), adminPage());
writeFileSync(join(dist, "entry.html"), entryPage());

for (const article of articles) writeFileSync(join(dist, "articles", `${article.slug}.html`), constitutionalDocumentPage(article, "Constitutional article"));
for (const schedule of data.schedules) writeFileSync(join(dist, "schedules", `${schedule.slug}.html`), constitutionalDocumentPage(schedule, "Constitutional schedule"));
writeFileSync(join(dist, "schedules", "final-attestation.html"), constitutionalDocumentPage(data.attestation, "Final attestation"));
for (const item of data.branches.items) writeFileSync(join(dist, "government", `${item.slug}.html`), governmentPage(item));
for (const item of directoryEntries) writeFileSync(join(dist, "institutions", `${item.slug}.html`), institutionPage(item));

console.log(`Built ${articles.length} articles, ${data.schedules.length} schedules, ${data.branches.items.length} government pages, and ${directoryEntries.length} institution pages.`);
