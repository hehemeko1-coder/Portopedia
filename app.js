
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // =========================================
  // EXISTING HOMEPAGE ELEMENTS
  // =========================================
  const searchInput = document.getElementById("creatorSearch");
  const creatorGrid = document.getElementById("creatorGrid");
  const filterContainer = document.getElementById("creatorFilters");
  const emptyState = document.getElementById("emptyState");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const getStartedButton = document.getElementById("getStartedButton");
  const ctaMessage = document.getElementById("ctaMessage");

  // =========================================
  // ACCOUNT DIALOG
  // =========================================
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

  // =========================================
  // PORTFOLIO EDITOR ELEMENTS
  // =========================================
  const portfolioEditor = document.getElementById("portfolioEditor");
  const portfolioForm = document.getElementById("portfolioForm");
  const editorStatus = document.getElementById("editorStatus");
  const backToHomeButton = document.getElementById("backToHome");
  const savePortfolioButton = document.getElementById("savePortfolio");

  const displayNameInput = document.getElementById("portfolioDisplayName");
  const headlineInput = document.getElementById("portfolioHeadline");
  const bioInput = document.getElementById("portfolioBio");
  const categoryInput = document.getElementById("portfolioCategory");
  const skillsInput = document.getElementById("portfolioSkills");
  const publishedInput = document.getElementById("portfolioPublished");

  const socialInputs = {
    website: document.getElementById("socialWebsite"),
    github: document.getElementById("socialGithub"),
    linkedin: document.getElementById("socialLinkedin"),
    instagram: document.getElementById("socialInstagram"),
    youtube: document.getElementById("socialYoutube")
  };

  const projectForm = document.getElementById("projectForm");
  const projectIdInput = document.getElementById("projectId");
  const projectTitleInput = document.getElementById("projectTitle");
  const projectCategoryInput = document.getElementById("projectCategory");
  const projectDescriptionInput = document.getElementById("projectDescription");
  const projectUrlInput = document.getElementById("projectUrl");
  const projectImageUrlInput = document.getElementById("projectImageUrl");
  const saveProjectButton = document.getElementById("saveProject");
  const cancelProjectEditButton = document.getElementById("cancelProjectEdit");
  const savedProjectsContainer = document.getElementById("savedProjects");

  const publicPortfolioLink = document.getElementById("publicPortfolioLink");
  const publicPortfolioUrl = document.getElementById("publicPortfolioUrl");

  let activeFilter = "All";
  let currentUser = null;
  let currentPortfolio = null;
  let savedProjects = [];
  let isLoadingPortfolio = false;

  // =========================================
  // CREATOR SEARCH AND FILTERS
  // =========================================
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

  // =========================================
  // MOBILE NAVIGATION
  // =========================================
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

  // =========================================
  // API HELPER
  // =========================================
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

  function setFormBusy(form, busy, busyText = "Please wait...") {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.textContent = busy ? busyText : button.dataset.originalText;
  }

  // =========================================
  // ACCOUNT DIALOG
  // =========================================
  function showAccountMessage(message, isError = false) {
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

    showAccountMessage("");
  }

  function openAccountDialog(mode = "register") {
    if (!dialog) {
      if (ctaMessage) {
        ctaMessage.textContent = "The account form is missing. Refresh the page and try again.";
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

  // =========================================
  // REGISTER
  // =========================================
  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      showAccountMessage(
        "Username must be 3–24 characters and contain only letters, numbers or underscores.",
        true
      );
      return;
    }

    if (password.length < 8 || password.length > 128) {
      showAccountMessage("Password must be between 8 and 128 characters.", true);
      return;
    }

    setFormBusy(registerForm, true);
    showAccountMessage("Creating your account...");

    try {
      const data = await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });

      currentUser = data.user;
      showAccountMessage(`Welcome to Portopedia, ${data.user.username}!`);
      updateHeaderForUser();
      renderAccountStatus();

      setTimeout(() => {
        closeAccountDialog();
        openPortfolioEditor();
      }, 700);
    } catch (error) {
      showAccountMessage(error.message, true);
    } finally {
      setFormBusy(registerForm, false);
    }
  });

  // =========================================
  // LOGIN
  // =========================================
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const identifier = String(formData.get("identifier") || "").trim();
    const password = String(formData.get("password") || "");

    if (!identifier || !password) {
      showAccountMessage("Enter your username or email and password.", true);
      return;
    }

    setFormBusy(loginForm, true);
    showAccountMessage("Signing you in...");

    try {
      const data = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password })
      });

      currentUser = data.user;
      showAccountMessage(`Welcome back, ${data.user.username}!`);
      updateHeaderForUser();
      renderAccountStatus();

      setTimeout(() => {
        closeAccountDialog();
        openPortfolioEditor();
      }, 700);
    } catch (error) {
      showAccountMessage(error.message, true);
    } finally {
      setFormBusy(loginForm, false);
    }
  });

  // =========================================
  // SIGNED-IN HEADER
  // =========================================
  function updateHeaderForUser() {
    const actions = document.querySelector(".header-actions");
    if (!actions || !currentUser) return;

    actions.replaceChildren();

    const accountLabel = document.createElement("span");
    accountLabel.className = "signed-in-label";
    accountLabel.textContent = `Hi, ${currentUser.username}`;

    const portfolioButton = document.createElement("button");
    portfolioButton.className = "button button-small";
    portfolioButton.type = "button";
    portfolioButton.textContent = "My portfolio ↗";
    portfolioButton.addEventListener("click", openPortfolioEditor);

    const logoutButton = document.createElement("button");
    logoutButton.className = "sign-in-link";
    logoutButton.type = "button";
    logoutButton.textContent = "Sign out";
    logoutButton.addEventListener("click", signOut);

    actions.append(accountLabel, portfolioButton, logoutButton);
  }

  async function signOut() {
    try {
      await apiRequest("/api/logout", { method: "POST" });
      currentUser = null;
      window.location.reload();
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

  // =========================================
  // PORTFOLIO EDITOR
  // =========================================
  function setEditorStatus(message, state = "") {
    if (!editorStatus) return;

    editorStatus.textContent = message;
    editorStatus.dataset.state = state;
  }

  function openPortfolioEditor() {
    if (!currentUser) {
      openAccountDialog("login");
      showAccountMessage("Sign in to open your portfolio.");
      return;
    }

    if (!portfolioEditor) {
      window.alert("The portfolio editor HTML is missing. Check index.html.");
      return;
    }

    portfolioEditor.hidden = false;
    portfolioEditor.scrollIntoView({ behavior: "smooth", block: "start" });

    loadPortfolio();
  }

  backToHomeButton?.addEventListener("click", () => {
    if (portfolioEditor) portfolioEditor.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function fillPortfolioForm(portfolio) {
    if (!portfolioForm) return;

    displayNameInput.value = portfolio.display_name || "";
    headlineInput.value = portfolio.headline || "";
    bioInput.value = portfolio.bio || "";
    categoryInput.value = portfolio.category || "Other";

    const skills = Array.isArray(portfolio.skills) ? portfolio.skills : [];
    skillsInput.value = skills.join(", ");

    const links = portfolio.social_links || {};
    Object.entries(socialInputs).forEach(([key, input]) => {
      if (input) input.value = links[key] || "";
    });

    publishedInput.checked = Boolean(portfolio.published);
  }

  function resetProjectForm() {
    projectForm?.reset();

    if (projectIdInput) projectIdInput.value = "";
    if (saveProjectButton) {
      saveProjectButton.textContent = "Add project ↗";
      saveProjectButton.disabled = false;
      saveProjectButton.dataset.originalText = "Add project ↗";
    }

    if (cancelProjectEditButton) cancelProjectEditButton.hidden = true;
  }

  async function loadPortfolio() {
    if (isLoadingPortfolio || !currentUser) return;

    isLoadingPortfolio = true;
    setEditorStatus("Loading your saved portfolio...");

    try {
      const data = await apiRequest("/api/portfolio", { method: "GET" });

      currentPortfolio = data.portfolio || {};
      savedProjects = Array.isArray(data.projects) ? data.projects : [];

      fillPortfolioForm(currentPortfolio);
      renderProjects();
      updatePublicPortfolioLink();

      setEditorStatus("Your saved portfolio is loaded.", "success");
    } catch (error) {
      setEditorStatus(error.message, "error");
    } finally {
      isLoadingPortfolio = false;
    }
  }

  function updatePublicPortfolioLink() {
    if (!publicPortfolioLink || !publicPortfolioUrl) return;

    if (currentPortfolio?.published) {
      publicPortfolioLink.hidden = false;

      // The public profile page is not yet implemented.
      // Link to the creator directory until that page is built.
      publicPortfolioUrl.href = "/#creators";
      publicPortfolioUrl.textContent = "Browse creator directory ↗";
    } else {
      publicPortfolioLink.hidden = true;
    }
  }

  // Save profile details to PostgreSQL through the existing API.
  portfolioForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setEditorStatus("Please sign in again before saving.", "error");
      return;
    }

    const social_links = {};

    for (const [key, input] of Object.entries(socialInputs)) {
      const value = (input?.value || "").trim();

      if (value && !/^https:\/\//i.test(value)) {
        setEditorStatus(
          `The ${key} link must start with https://`,
          "error"
        );
        input?.focus();
        return;
      }

      social_links[key] = value;
    }

    const profile = {
      display_name: displayNameInput.value.trim(),
      headline: headlineInput.value.trim(),
      bio: bioInput.value.trim(),
      category: categoryInput.value,
      skills: skillsInput.value
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 30),
      social_links,
      published: publishedInput.checked
    };

    if (!profile.display_name) {
      setEditorStatus("Please enter a display name.", "error");
      displayNameInput.focus();
      return;
    }

    setFormBusy(portfolioForm, true, "Saving profile...");
    setEditorStatus("Saving your profile...");

    try {
      const data = await apiRequest("/api/portfolio", {
        method: "PUT",
        body: JSON.stringify(profile)
      });

      currentPortfolio = data.portfolio || {
        ...currentPortfolio,
        ...profile
      };

      // Use the values the user just saved even if the API
      // returns a response without the portfolio object.
      currentPortfolio = { ...currentPortfolio, ...profile };

      updatePublicPortfolioLink();
      setEditorStatus("Profile saved successfully.", "success");
    } catch (error) {
      setEditorStatus(error.message, "error");
    } finally {
      setFormBusy(portfolioForm, false);
    }
  });

  // =========================================
  // PROJECT LIST
  // =========================================
  function renderProjects() {
    if (!savedProjectsContainer) return;

    savedProjectsContainer.replaceChildren();

    if (savedProjects.length === 0) {
      const message = document.createElement("p");
      message.textContent = "No projects yet. Add your first project above.";
      savedProjectsContainer.append(message);
      return;
    }

    savedProjects.forEach((project) => {
      const card = document.createElement("article");
      card.className = "saved-project-card";

      const info = document.createElement("div");
      info.className = "saved-project-info";

      if (project.category) {
        const category = document.createElement("span");
        category.className = "saved-project-category";
        category.textContent = project.category;
        info.append(category);
      }

      const title = document.createElement("h4");
      title.textContent = project.title || "Untitled project";
      info.append(title);

      if (project.description) {
        const description = document.createElement("p");
        description.textContent = project.description;
        info.append(description);
      }

      if (project.project_url) {
        const link = document.createElement("a");
        link.href = project.project_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open project ↗";
        link.style.color = "#e69a69";
        link.style.fontSize = "13px";
        info.append(link);
      }

      const actions = document.createElement("div");
      actions.className = "saved-project-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => beginProjectEdit(project));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-project";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteProject(project));

      actions.append(editButton, deleteButton);
      card.append(info, actions);
      savedProjectsContainer.append(card);
    });
  }

  function beginProjectEdit(project) {
    projectIdInput.value = String(project.id);
    projectTitleInput.value = project.title || "";
    projectCategoryInput.value = project.category || "";
    projectDescriptionInput.value = project.description || "";
    projectUrlInput.value = project.project_url || "";
    projectImageUrlInput.value = project.image_url || "";

    saveProjectButton.textContent = "Save project changes ↗";
    saveProjectButton.dataset.originalText = "Save project changes ↗";
    cancelProjectEditButton.hidden = false;

    projectForm.scrollIntoView({ behavior: "smooth", block: "center" });
    projectTitleInput.focus();
  }

  cancelProjectEditButton?.addEventListener("click", resetProjectForm);

  // =========================================
  // ADD OR UPDATE A PROJECT
  // =========================================
  projectForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setEditorStatus("Please sign in again before managing projects.", "error");
      return;
    }

    const title = projectTitleInput.value.trim();
    const category = projectCategoryInput.value.trim();
    const description = projectDescriptionInput.value.trim();
    const project_url = projectUrlInput.value.trim();
    const image_url = projectImageUrlInput.value.trim();
    const projectId = projectIdInput.value.trim();

    if (!title) {
      setEditorStatus("Enter a title for your project.", "error");
      projectTitleInput.focus();
      return;
    }

    if (!projectId && savedProjects.length >= 20) {
      setEditorStatus("You have reached the 20-project limit.", "error");
      return;
    }

    for (const [label, value, input] of [
      ["Project link", project_url, projectUrlInput],
      ["Image URL", image_url, projectImageUrlInput]
    ]) {
      if (value && !/^https:\/\//i.test(value)) {
        setEditorStatus(`${label} must start with https://`, "error");
        input.focus();
        return;
      }
    }

    const payload = {
      title,
      category,
      description,
      project_url,
      image_url
    };

    saveProjectButton.disabled = true;
    saveProjectButton.textContent = projectId
      ? "Saving changes..."
      : "Adding project...";

    try {
      if (projectId) {
        await apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/api/projects", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      resetProjectForm();
      await refreshProjects();
      setEditorStatus(
        projectId ? "Project updated successfully." : "Project added successfully.",
        "success"
      );
    } catch (error) {
      setEditorStatus(error.message, "error");
    } finally {
      saveProjectButton.disabled = false;
      if (projectIdInput.value) {
        saveProjectButton.textContent = "Save project changes ↗";
      } else {
        saveProjectButton.textContent = "Add project ↗";
      }
    }
  });

  async function refreshProjects() {
    const data = await apiRequest("/api/portfolio", { method: "GET" });
    currentPortfolio = data.portfolio || currentPortfolio;
    savedProjects = Array.isArray(data.projects) ? data.projects : [];
    renderProjects();
    updatePublicPortfolioLink();
  }

  // =========================================
  // DELETE A PROJECT
  // =========================================
  async function deleteProject(project) {
    const confirmed = window.confirm(
      `Delete "${project.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setEditorStatus(`Deleting "${project.title}"...`);

    try {
      await apiRequest(
        `/api/projects/${encodeURIComponent(String(project.id))}`,
        { method: "DELETE" }
      );

      savedProjects = savedProjects.filter(
        (item) => String(item.id) !== String(project.id)
      );

      if (String(projectIdInput.value) === String(project.id)) {
        resetProjectForm();
      }

      renderProjects();
      setEditorStatus("Project deleted.", "success");
    } catch (error) {
      setEditorStatus(error.message, "error");
    }
  }

  // =========================================
  // RESTORE SESSION AFTER REFRESH
  // =========================================
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

  // =========================================
  // KEYBOARD SHORTCUTS
  // =========================================
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

  // =========================================
  // INITIALIZE
  // =========================================
  filterContainer?.querySelectorAll("[data-filter]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String((button.dataset.filter || "All") === activeFilter)
    );
  });

  filterCreators();
  restoreSession();
});
