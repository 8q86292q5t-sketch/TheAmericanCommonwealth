const header = document.querySelector("[data-header]");
const menus = [...document.querySelectorAll(".nav-menu")];
const mobileButton = document.querySelector("[data-mobile-nav]");

const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

mobileButton?.addEventListener("click", () => {
  const open = header.classList.toggle("mobile-nav-open");
  mobileButton.setAttribute("aria-expanded", String(open));
  mobileButton.textContent = open ? "Close" : "Menu";
});

menus.forEach((menu) => menu.addEventListener("toggle", () => {
  if (!menu.open) return;
  menus.forEach((other) => {
    if (other !== menu) other.removeAttribute("open");
  });
}));

document.addEventListener("click", (event) => {
  if (event.target.closest(".nav-menu")) return;
  menus.forEach((menu) => menu.removeAttribute("open"));
});

const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const sections = [...document.querySelectorAll("[data-document-section]")];

const setActiveSection = (id) => sectionLinks.forEach((link) => {
  const active = link.getAttribute("href") === `#${id}`;
  link.classList.toggle("is-active", active);
  if (active) link.setAttribute("aria-current", "location");
  else link.removeAttribute("aria-current");
});

if (sections.length) {
  let frame = null;
  const sync = () => {
    frame = null;
    const active = sections.reduce((current, section) => section.getBoundingClientRect().top <= 150 ? section : current, sections[0]);
    setActiveSection(active.id);
  };
  window.addEventListener("scroll", () => {
    if (frame === null) frame = requestAnimationFrame(sync);
  }, { passive: true });
  sync();
}

sectionLinks.forEach((link) => link.addEventListener("click", () => setActiveSection(link.hash.slice(1))));

const dynamicMenuFor = (entryType) => {
  if (entryType === "government-structure") return "government-structure";
  if (entryType === "article") return "articles";
  if (entryType === "schedule") return "schedules";
  return "institutions";
};

fetch("/api/content", { credentials: "same-origin" })
  .then((response) => response.ok ? response.json() : { entries: [] })
  .then(({ entries = [] }) => entries.forEach((entry) => {
    const panel = document.querySelector(`[data-dynamic-menu="${dynamicMenuFor(entry.entryType)}"]`);
    if (!panel) return;
    const link = document.createElement("a");
    link.href = `/entry.html?id=${encodeURIComponent(entry.id)}`;
    link.textContent = entry.identifier ? `${entry.identifier}: ${entry.title}` : entry.title;
    link.dataset.supplemental = "true";
    panel.append(link);
  }))
  .catch(() => {});
