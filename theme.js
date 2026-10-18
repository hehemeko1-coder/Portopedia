
(() => {
  const root = document.documentElement;
  const storageKey = "portopedia-theme";

  function applyTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    root.dataset.theme = selected;

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.textContent = selected === "dark" ? "☀ Light mode" : "☾ Dark mode";
      button.setAttribute(
        "aria-label",
        selected === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      button.setAttribute("aria-pressed", String(selected === "dark"));
    });
  }

  let savedTheme = "light";

  try {
    savedTheme = localStorage.getItem(storageKey) || "light";
  } catch {
    // Continue with the light theme if storage is unavailable.
  }

  applyTheme(savedTheme);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;

    const nextTheme =
      root.dataset.theme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);

    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Theme still works for the current page if storage is unavailable.
    }
  });
})();
