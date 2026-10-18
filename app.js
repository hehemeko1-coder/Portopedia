
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

  const dialog = document.getElementById("accountDialog");
  const closeDialogButton = document.getElementById("closeAccountDialog");
  const registerTab = document.getElementById("showRegister");
  const loginTab = document.getElementById("showLogin");
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const accountTitle = document.getElementById("accountTitle");
  const accountEyebrow = document.getElementById("accountEyebrow");
  const accountDescription = document.getElementById("accountDescription");
  const accountMessage = document.getElementById("accountMessage");

  let activeFilter = "All";
  let currentUser = null;

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

    if (emptyState) emptyState.hidden = visibleCount !== 0;
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

  // Mobile navigation.
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

  // Account dialog.
  function showMessage(message, isError = false) {
    if (!accountMessage) return;
    accountMessage.textContent = message;
    accountMessage.dataset.state = isError ? "error" : "success";
  }

  function setAccountMode(mode) {
    const registering = mode === "register";

    if (registerForm) {
      registerForm.hidden = !registering;
      registerForm.reset();
    }

    if (loginForm) {
      loginForm.hidden = registering;
      loginForm.reset();
    }

    registerTab?.classList.toggle("active", registering);
    loginTab?.classList.toggle("active", !registering);

    registerTab?.setAttribute("aria-pressed", String(registering));
    loginTab?.setAttribute("aria-pressed", String(!registering));

    if (accountTitle) {
      accountTitle.innerHTML = registering
        ? "Create your account<span>.</span>"
        : "Welcome back<span>.</span>";
    }

    if (accountEyebrow) {
      accountEyebrow.textContent = registering
        ? "YOUR NEXT CHAPTER"
        : "GOOD TO SEE YOU";
    }

    if (accountDescription) {
      accountDescription.textContent = registering
        ? "Make a home for your best work."
        : "Sign in to continue to your portfolio.";
    }

    showMessage("");
  }

  function openAccountDialog(mode = "register") {
    if (!dialog) {
      if (ctaMessage) {
        ctaMessage.textContent =
          "The account form is missing. Please refresh the page.";
      }
      return;
    }

    setAccountMode(mode);

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    const firstInput = mode === "register"
      ? document.getElementById("registerUsername")
      : document.getElementById("loginEmail");

    firstInput?.focus();
  }

  function closeAccountDialog() {
    if (!dialog) return;

    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  document.querySelectorAll('a[href="#accountDialog"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const isSignIn = link.classList.contains("sign-in-link");
      openAccountDialog(isSignIn ? "login" : "register");
    });
  });

  getStartedButton?.addEventListener("click", () => {
    openAccountDialog("register");
  });

  closeDialogButton?.addEventListener("click", closeAccountDialog);
  registerTab?.addEventListener("click", () => setAccountMode("register"));
  loginTab?.addEventListener("click", () => setAccountMode("login"));

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeAccountDialog();
  });

  // Send requests to the same server that serves this website.
  async function apiRequest(endpoint, options = {}) {
    let response;

    try {
      response = await fetch(endpoint, {
        ...options,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error(
        "Could not connect to the server. Check your internet connection and try again."
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "The request failed. Please try again.");
    }

    return data;
  }

  function setFormBusy(form, busy) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;

    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.textContent = busy
      ? "Please wait..."
      : button.dataset.originalText;
  }

  // Register a new account.
  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      showMessage(
        "Username must be 3–24 characters and contain only letters, numbers or underscores.",
        true
      );
      return;
    }

    if (password.length < 8 || password.length > 128) {
      showMessage("Password must be between 8 and 128 characters.", true);
      return;
    }

    setFormBusy(registerForm, true);
    showMessage("Creating your account...");

    try {
      const data = await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });

      currentUser = data.user;
      showMessage(`Welcome to Portopedia, ${data.user.username}!`);
      updateHeaderForUser();
      renderAccountStatus();
      setTimeout(closeAccountDialog, 900);
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      setFormBusy(registerForm, false);
    }
  });

  // Sign in with username or email.
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const identifier = String(formData.get("identifier") || "").trim();
    const password = String(formData.get("password") || "");

    if (!identifier || !password) {
      showMessage("Enter your username or email and password.", true);
      return;
    }

    setFormBusy(loginForm, true);
    showMessage("Signing you in...");

    try {
      const data = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password })
      });

      currentUser = data.user;
      showMessage(`Welcome back, ${data.user.username}!`);
      updateHeaderForUser();
      renderAccountStatus();
      setTimeout(closeAccountDialog, 900);
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      setFormBusy(loginForm, false);
    }
  });

  // Display the current account in the header.
  function updateHeaderForUser() {
    const actions = document.querySelector(".header-actions");
    if (!actions) return;

    if (!currentUser) return;

    actions.replaceChildren();

    const accountLabel = document.createElement("span");
    accountLabel.className = "signed-in-label";
    accountLabel.textContent = `Hi, ${currentUser.username}`;

    const portfolioLink = document.createElement("a");
    portfolioLink.className = "button button-small";
    portfolioLink.href = "#get-started";
    portfolioLink.textContent = "My portfolio ↗";
    portfolioLink.addEventListener("click", (event) => {
      event.preventDefault();
      showPortfolioMessage();
    });

    const logoutButton = document.createElement("button");
    logoutButton.className = "sign-in-link";
    logoutButton.type = "button";
    logoutButton.textContent = "Sign out";
    logoutButton.addEventListener("click", signOut);

    actions.append(accountLabel, portfolioLink, logoutButton);
  }

  async function signOut() {
    try {
      await apiRequest("/api/logout", { method: "POST" });
      currentUser = null;
      location.reload();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function renderAccountStatus() {
    if (ctaMessage && currentUser) {
      ctaMessage.textContent =
        `You're signed in as ${currentUser.username}. Your account is ready.`;
    }
  }

  function showPortfolioMessage() {
    openAccountDialog("login");
    showMessage(
      "Your account is active. The portfolio editor is the next feature we'll build."
    );
  }

  // Restore the signed-in state after a page refresh.
  async function restoreSession() {
    try {
      const data = await apiRequest("/api/me", { method: "GET" });

      if (data.user) {
        currentUser = data.user;
        updateHeaderForUser();
        renderAccountStatus();
      }
    } catch (error) {
      console.error("Could not restore session:", error.message);
    }
  }

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
      if (document.activeElement === searchInput) searchInput.blur();
      closeMenu();
    }
  });

  // Initialize accessibility and filters.
  filterContainer?.querySelectorAll("[data-filter]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String((button.dataset.filter || "All") === activeFilter)
    );
  });

  filterCreators();
  restoreSession();
});
