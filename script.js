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
