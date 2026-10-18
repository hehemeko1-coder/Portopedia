
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const portfolioContent = document.getElementById("portfolioContent");

function showError(message) {
  loadingState.hidden = true;
  portfolioContent.hidden = true;
  errorMessage.textContent = message;
  errorState.hidden = false;
}

function addText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.appendChild(element);
  return element;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function renderPortfolio(portfolio) {
  document.title =
    `${portfolio.display_name || portfolio.username || "Creator"} — Portopedia`;

  document.getElementById("profileName").textContent =
    portfolio.display_name || portfolio.username || "Creator";

  document.getElementById("profileHeadline").textContent =
    portfolio.headline || "";

  document.getElementById("profileCategory").textContent =
    portfolio.category || "Other";

  document.getElementById("profileUsername").textContent =
    "@" + (portfolio.username || portfolio.slug || "creator");

  const bio = document.getElementById("profileBio");

  if (portfolio.bio && portfolio.bio.trim()) {
    bio.textContent = portfolio.bio;
    bio.hidden = false;
  }

  const skills = Array.isArray(portfolio.skills) ? portfolio.skills : [];
  const skillsSection = document.getElementById("skillsSection");
  const skillsContainer = document.getElementById("profileSkills");

  skillsContainer.replaceChildren();

  skills.forEach((skill) => {
    addText(skillsContainer, "span", "profile-skill", skill);
  });

  skillsSection.hidden = skills.length === 0;

  const projects = Array.isArray(portfolio.projects)
    ? portfolio.projects
    : [];

  const projectGrid = document.getElementById("projectGrid");
  projectGrid.replaceChildren();

  document.getElementById("projectCount").textContent =
    `${projects.length} ${projects.length === 1 ? "project" : "projects"}`;

  document.getElementById("noProjects").hidden = projects.length > 0;

  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "public-project";

    const imageUrl = safeHttpsUrl(project.image_url || "");

    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "public-project-image";
      image.src = imageUrl;
      image.alt = project.title || "Project preview";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      card.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "public-project-content";

    if (project.category) {
      addText(content, "span", "public-project-category", project.category);
    }

    addText(content, "h3", "", project.title || "Untitled project");

    if (project.description) {
      addText(content, "p", "", project.description);
    }

    const projectUrl = safeHttpsUrl(project.project_url || "");

    if (projectUrl) {
      const link = addText(
        content,
        "a",
        "public-project-link",
        "View project ↗"
      );

      link.href = projectUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    card.appendChild(content);
    projectGrid.appendChild(card);
  });

  const socialLinks = portfolio.social_links || {};
  const socialContainer = document.getElementById("profileSocials");
  const socialSection = document.getElementById("socialSection");

  socialContainer.replaceChildren();

  const socialNames = {
    website: "Website ↗",
    linkedin: "LinkedIn ↗",
    github: "GitHub ↗",
    instagram: "Instagram ↗",
    youtube: "YouTube ↗"
  };

  Object.entries(socialNames).forEach(([key, label]) => {
    const url = safeHttpsUrl(socialLinks[key] || "");
    if (!url) return;

    const link = addText(socialContainer, "a", "", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  socialSection.hidden = socialContainer.children.length === 0;

  loadingState.hidden = true;
  errorState.hidden = true;
  portfolioContent.hidden = false;
}

async function loadPortfolio() {
  const params = new URLSearchParams(window.location.search);
  const slug = (params.get("slug") || "").trim();

  if (!slug || !/^[a-zA-Z0-9_-]{1,40}$/.test(slug)) {
    showError("This link doesn't contain a valid creator name.");
    return;
  }

  try {
    const response = await fetch(
      `/api/creators/${encodeURIComponent(slug)}`,
      { credentials: "same-origin" }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.portfolio) {
      showError(
        data.error === "Creator not found."
          ? "This creator doesn't exist, or their portfolio isn't published yet."
          : "We couldn't load this portfolio. Please try again later."
      );
      return;
    }

    renderPortfolio(data.portfolio);
  } catch (error) {
    console.error("Public portfolio error:", error);
    showError(
      "We couldn't connect to Portopedia. Check your connection and try again."
    );
  }
}

loadPortfolio();
