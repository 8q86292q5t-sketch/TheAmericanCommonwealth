const header = document.querySelector("[data-header]");
const promptButtons = document.querySelectorAll("[data-copy]");

const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

promptButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const original = button.textContent;

    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "Copied";
      button.classList.add("is-copied");
    } catch {
      button.textContent = button.dataset.copy;
      button.classList.add("is-copied");
    }

    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-copied");
    }, 1600);
  });
});
