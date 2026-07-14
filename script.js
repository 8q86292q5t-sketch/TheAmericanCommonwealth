const header = document.querySelector("[data-header]");
const menus = document.querySelectorAll(".nav-menu");

const syncHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 8);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

menus.forEach((menu) => {
  menu.addEventListener("toggle", () => {
    if (!menu.open) return;
    menus.forEach((other) => {
      if (other !== menu) other.removeAttribute("open");
    });
  });
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".nav-menu")) return;
  menus.forEach((menu) => menu.removeAttribute("open"));
});

const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const sections = [...document.querySelectorAll("[data-document-section]")];

const setActiveSection = (id) => {
  sectionLinks.forEach((link) => {
    const active = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
};

if (sections.length) {
  let sectionFrame = null;
  const syncActiveSection = () => {
    sectionFrame = null;
    const active = sections.reduce((current, section) => (
      section.getBoundingClientRect().top <= 160 ? section : current
    ), sections[0]);
    setActiveSection(active.id);
  };

  window.addEventListener("scroll", () => {
    if (sectionFrame === null) sectionFrame = requestAnimationFrame(syncActiveSection);
  }, { passive: true });
  syncActiveSection();
}

sectionLinks.forEach((link) => {
  link.addEventListener("click", () => setActiveSection(link.hash.slice(1)));
});
