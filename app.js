
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("creatorSearch");
  const creatorGrid = document.getElementById("creatorGrid");
  const filterContainer = document.getElementById("creatorFilters");
  const emptyState = document.getElementById("emptyState");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const getStartedButton = document.getElementById("getStartedButton");
  const ctaMessage = document.getElementById("ctaMessage");

  let activeFilter = "All";

  // Creator search and skill filters.
  function filterCreators() {
    if (!creatorGrid) return;

    const query = (searchInput?.value || "").trim().toLowerCase();
    const cards = creatorGrid.querySelectorAll(".creator-card");
    let visibleCount = 0;

    cards.forEach((card) => {
      const name = (card.dataset.name || "").toLowerCase();
      const skills = (card.dataset.skills || "").toLowerCase();
      const visibleBySearch = `${name} ${skills}`.includes(query);
      const visibleByFilter =
        activeFilter === "All" ||
        skills.includes(activeFilter.toLowerCase());

      const visible = visibleBySearch && visibleByFilter;
      card.hidden = !visible;

      if (visible) visibleCount += 1;
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  }

  searchInput?.addEventListener("input", filterCreators);

  filterContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    activeFilter = button.dataset.filter || "All";

    filterContainer.querySelectorAll("[data-filter]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });

    filterCreators();
  });

  // Open and close the mobile navigation.
  function closeMenu() {
    mainNav?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }

  menuToggle?.addEventListener("click", () => {
    const isOpen = mainNav?.classList.toggle("open") || false;
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  mainNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    if (event.key === "/" && !typing && searchInput) {
      event.preventDefault();
      searchInput.focus();
    }

    if (event.key === "Escape") {
      if (document.activeElement === searchInput) {
        searchInput?.blur();
      }
      closeMenu();
    }
  });

  // Account creation will be connected to the backend in a later phase.
  getStartedButton?.addEventListener("click", () => {
    if (ctaMessage) {
      ctaMessage.textContent =
        "Your account setup is coming next. We're building the foundation first.";
    }
  });

  // Initialize filter accessibility and display.
  filterContainer?.querySelectorAll("[data-filter]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String((button.dataset.filter || "All") === activeFilter)
    );
  });

  filterCreators();
});
