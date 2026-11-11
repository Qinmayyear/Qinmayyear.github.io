(() => {
  const folder = document.querySelector(".dossier");
  const tablist = folder.querySelector(".dossier-tabs");
  const tabs = Array.from(tablist.querySelectorAll(".dossier-tab"));
  const panels = [document.getElementById("dossier-profile"), document.getElementById("dossier-projects")];
  const archive = tabs[1].href;
  const embeddedSource = document.getElementById("dossier-project-source");
  const projectContent = panels[1].querySelector(".dossier-project-content");
  const status = panels[1].querySelector(".dossier-status");
  let selected = 0;
  let pending = false;

  function makeProjectList(source, base) {
    const list = document.createElement("ul");
    list.className = "dossier-project-list";
    for (const entry of source.querySelectorAll(".research-list .research-entry")) {
      const item = document.createElement("li");
      item.className = "dossier-project-entry";
      const copy = document.createElement("div");
      const paperTitle = entry.querySelector("h2");
      const title = document.createElement("h3");
      const titleLink = document.createElement("a");
      titleLink.href = archive + "#" + paperTitle.id;
      titleLink.textContent = paperTitle.firstChild.textContent.trim() || paperTitle.textContent.trim();
      title.append(titleLink);
      const venue = entry.querySelector(".research-venue").cloneNode(true);
      const summary = entry.querySelector(".research-copy > p:last-of-type").cloneNode(true);
      const links = entry.querySelector(".research-links").cloneNode(true);
      links.classList.add("dossier-project-links");
      copy.append(venue, title, summary, links);

      const figure = entry.querySelector(".research-figure").cloneNode(true);
      figure.classList.add("dossier-project-figure");
      const image = figure.querySelector("img");
      image.src = new URL(image.getAttribute("src"), base).href;
      image.loading = "lazy";
      for (const link of [...links.querySelectorAll("a"), ...figure.querySelectorAll("a")]) {
        link.href = new URL(link.getAttribute("href"), base).href;
      }
      item.append(copy, figure);
      list.append(item);
    }
    if (!list.childElementCount) throw new Error("Research archive has no project entries.");
    return list;
  }

  async function loadProjects() {
    if (pending || projectContent.childElementCount) return;
    pending = true;
    status.textContent = "Loading projects…";
    try {
      if (embeddedSource) {
        projectContent.append(makeProjectList(embeddedSource.content, embeddedSource.dataset.base || archive));
      } else {
        const response = await fetch(archive, { mode: "same-origin" });
        if (!response.ok) throw new Error("Research archive could not be loaded.");
        const source = new DOMParser().parseFromString(await response.text(), "text/html");
        projectContent.append(makeProjectList(source, response.url || archive));
      }
      status.textContent = "";
    } catch {
      status.textContent = "The project list could not be loaded here. Use the full research archive above.";
    } finally {
      pending = false;
    }
  }

  function focusTab(index) {
    tabs.forEach((tab, position) => { tab.tabIndex = position === index ? 0 : -1; });
    tabs[index].focus();
  }

  function showPanel(index) {
    selected = index;
    for (const [position, tab] of tabs.entries()) {
      const active = position === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[position].hidden = !active;
    }
    folder.closest("#profile").setAttribute("aria-labelledby", index === 0 ? "profile-title" : "dossier-project-title");
    if (index === 1) void loadProjects();
  }

  tablist.setAttribute("role", "tablist");
  tabs.forEach((tab, index) => {
    const panel = panels[index];
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.tabIndex = 0;

    tab.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showPanel(index);
    });
    tab.addEventListener("keydown", (event) => {
      let next;
      switch (event.key) {
        case "ArrowLeft":
          next = (index + tabs.length - 1) % tabs.length;
          break;
        case "ArrowRight":
          next = (index + 1) % tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = tabs.length - 1;
          break;
        case " ":
          event.preventDefault();
          showPanel(index);
          return;
        default:
          return;
      }
      event.preventDefault();
      focusTab(next);
    });
  });

  tablist.addEventListener("focusout", (event) => {
    if (tablist.contains(event.relatedTarget)) return;
    tabs.forEach((tab, index) => { tab.tabIndex = index === selected ? 0 : -1; });
  });
  document.querySelector(".open-profile")?.addEventListener("click", () => showPanel(0));
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#profile") showPanel(0);
  });
  showPanel(0);
})();
