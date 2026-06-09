import DOM from "../../lib/dom.js";
import Icons from "../../core/ui/icons.js";
import I18n from "../../core/services/i18n.js";

let elements = null;

function queryElements() {
  elements = {
    tabContent: DOM.qs("#tab-organizer"),
    grid: DOM.qs("#folders-grid"),
    filterContainer: DOM.qs(".organizer-filters-row"),
    filterBtns: DOM.qsa(".organizer-filter-button"),
    search: DOM.qs(".organizer-search-input"),
    infoBar: DOM.qs("#organizer-info-bar"),
    backBtn: DOM.qs("#organizer-back-btn"),
    fab: DOM.qs("#organizer-fab")
  };
}

function getElements() {
  return elements;
}

const helpers = {
  parseTags(filename) {
    const match = filename.match(/\[([^\]]+)\]/);
    if (!match) return [];
    const inner = match[1];
    if (inner === "skip") return [];
    return inner.split("_").filter(Boolean);
  },

  tagDisplay(tag) {
    return tag.replace(/-/g, " ");
  },

  updateMediaOverlay(card, newName) {
    const existing = card.querySelector(".media-tags, .media-state-label");
    if (existing) existing.remove();
    const html = templates.mediaOverlay(newName);
    if (html) {
      const wrapper = card.querySelector(".media-thumb-wrapper");
      if (wrapper) wrapper.insertAdjacentHTML("beforeend", html);
    }
  },

  updateCardData(selector, oldPath, newPath, newName) {
    const card = DOM.qs(`${selector}[data-file-path="${oldPath}"]`);
    if (!card) return;
    card.dataset.filePath = newPath;
    card.dataset.fileName = newName;
    helpers.updateMediaOverlay(card, newName);
  }
};

const templates = {
  badges(folder, activeFilter) {
    const ssCount = folder.ss?.count ?? 0;
    const srCount = folder.sr?.count ?? 0;
    const isRecordings = activeFilter === "recordings";
    const count = isRecordings ? srCount : ssCount;
    const icon = Icons.getSvg(isRecordings ? "video" : "image");
    const label = isRecordings
      ? I18n.t("common.recordings_label")
      : I18n.t("common.screenshots_label");
    return `<div class="organizer-folder-badge">${icon} <span>${count}</span> <span>${label}</span></div>`;
  },

  mediaOverlay(name) {
    const tags = helpers.parseTags(name);
    if (tags.length) {
      const badges = tags
        .map(
          t => `<span class="media-tag-badge">${helpers.tagDisplay(t)}</span>`
        )
        .join("");
      return `<div class="media-tags">${badges}</div>`;
    }
    const isSkipped = name.includes("[skip]");
    const isPending = !name.includes("[");
    if (isSkipped)
      return `<div class="media-state-label"><span class="state-label-badge state-label-skipped">• ${I18n.t(
        "organizer.info_skipped"
      )}</span></div>`;
    if (isPending)
      return `<div class="media-state-label"><span class="state-label-badge state-label-pending">• ${I18n.t(
        "organizer.info_pending"
      )}</span></div>`;
    return "";
  },

  folderCard: (folder, index, activeFilter) => `
    <div class="organizer-folder-card card animate-scale-in" style="animation-delay: ${
      0.3 + index * 0.05
    }s" data-folder-id="${folder.id}">
      <div class="organizer-folder-top">
        <div class="organizer-folder-badges">${templates.badges(
          folder,
          activeFilter
        )}</div>
        <div class="organizer-folder-app-icon">${Icons.getAppIcon(folder)}</div>
      </div>
      <div class="organizer-folder-bottom">
        <div class="organizer-folder-info-row">
          <span class="organizer-folder-name truncate-text">${
            folder.name
          }</span>
          <div class="organizer-folder-menu-dots">
            <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </div>
        </div>
      </div>
    </div>`,

  mediaCard: (file, index) =>
    `<div class="media-card animate-scale-in" style="animation-delay: ${
      index * 0.02
    }s" data-file-path="${file.path}" data-file-name="${
      file.name
    }" data-file-mtime="${file.mtime || ""}">
      <div class="media-thumb-wrapper">
        <img class="media-thumb" src="${file.path}" alt="${
          file.name
        }" loading="lazy" onerror="this.style.display='none'" />
        ${templates.mediaOverlay(file.name)}
      </div>
    </div>`,

  recordingCard: (file, index) =>
    `<div class="media-card recording-card is-recording animate-scale-in" style="animation-delay: ${
      index * 0.02
    }s" data-file-path="${file.path}" data-file-name="${
      file.name
    }" data-file-mtime="${file.mtime || ""}">
      <div class="media-thumb-wrapper">
        <img class="media-thumb" src="" alt="" />
        <div class="recording-thumb-placeholder"><div class="ui-spinner"></div></div>
        <div class="recording-play-icon">${Icons.getSvg("video")}</div>
        ${templates.mediaOverlay(file.name)}
      </div>
    </div>`,

  emptyState: activeFilter => {
    const copy = {
      screenshots: {
        title: I18n.t("organizer.empty_screenshots_title"),
        subtitle: I18n.t("organizer.empty_screenshots_subtitle")
      },
      recordings: {
        title: I18n.t("organizer.empty_recordings_title"),
        subtitle: I18n.t("organizer.empty_recordings_subtitle")
      }
    };
    const { title, subtitle } = copy[activeFilter] ?? copy.screenshots;
    return `<div class="organizer-empty-state animate-fade-in" style="animation-delay: 0.3s">
      <div class="organizer-empty-icon-wrapper">${Icons.getSvg(
        "folder-open"
      )}</div>
      <p class="organizer-empty-title">${title}</p>
      <p class="organizer-empty-subtitle">${subtitle}</p>
    </div>`;
  },

  emptyMedia: activeFilter => {
    const isRecordings = activeFilter === "recordings";
    return `<div class="organizer-empty-state animate-fade-in" style="animation-delay: 0.3s">
      <div class="organizer-empty-icon-wrapper">${Icons.getSvg(
        isRecordings ? "video" : "image"
      )}</div>
      <p class="organizer-empty-title">${I18n.t(
        isRecordings
          ? "organizer.empty_recordings_folder"
          : "organizer.empty_screenshots_folder"
      )}</p>
    </div>`;
  },

  actionsMenu: folderId => `
    <div class="organizer-folder-actions-popup" data-folder-id="${folderId}">
      <div class="organizer-folder-action-item" data-action="clear">
        ${Icons.getSvg("trash")}
        <span>${I18n.t("organizer.folder_action_clear")}</span>
      </div>
    </div>`,

  searchFoldersSection: (folders, activeFilter) => `
    <div class="search-section">
      <p class="search-section-title">${Icons.getSvg("folder-open")} ${I18n.t(
        "organizer.search_section_folders"
      )}</p>
      <div class="search-section-grid search-folders-grid">
        ${folders
          .map((f, i) => templates.folderCard(f, i, activeFilter))
          .join("")}
      </div>
    </div>`,

  searchFilesSection: (files, activeFilter) => {
    const isRecordings = activeFilter === "recordings";
    const fileCards = isRecordings
      ? files.map((f, i) => templates.recordingCard(f, i)).join("")
      : files.map((f, i) => templates.mediaCard(f, i)).join("");
    const sectionIcon = Icons.getSvg(isRecordings ? "video" : "image");
    const sectionTitle = I18n.t(
      isRecordings
        ? "organizer.search_section_recordings"
        : "organizer.search_section_screenshots"
    );
    const gridClass = isRecordings
      ? "search-recordings-grid"
      : "search-screenshots-grid";
    return `<div class="search-section">
      <p class="search-section-title">${sectionIcon} ${sectionTitle}</p>
      <div class="search-section-grid ${gridClass}">${fileCards}</div>
    </div>`;
  }
};

const render = {
  getFiltered(folders, activeFilter) {
    if (activeFilter === "screenshots") return folders.filter(f => f.ss);
    if (activeFilter === "recordings") return folders.filter(f => f.sr);
    return folders.filter(f => f.ss || f.sr);
  },

  folderNode(folder, index, activeFilter) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = templates
      .folderCard(folder, index, activeFilter)
      .trim();
    return wrapper.firstChild;
  },

  mediaNode(file, index, isRecording = false) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = (
      isRecording
        ? templates.recordingCard(file, index)
        : templates.mediaCard(file, index)
    ).trim();
    return wrapper.firstChild;
  },

  filters(activeFilter) {
    elements.filterBtns.forEach(btn => btn.classList.remove("active"));
    DOM.qs(`#filter-${activeFilter}`)?.classList.add("active");
  },

  searchResults(folders, files, activeFilter) {
    const hasFolders = folders.length > 0;
    const hasFiles = files.length > 0;

    if (!hasFolders && !hasFiles) {
      elements.grid.innerHTML = `<div class="organizer-empty-state animate-fade-in" style="animation-delay:0.1s">
        <div class="organizer-empty-icon-wrapper">${Icons.getSvg(
          "search"
        )}</div>
        <p class="organizer-empty-title">${I18n.t("organizer.search_empty")}</p>
      </div>`;
      return;
    }

    let html = "";
    if (hasFolders)
      html += templates.searchFoldersSection(folders, activeFilter);
    if (hasFiles) html += templates.searchFilesSection(files, activeFilter);
    elements.grid.innerHTML = html;
  }
};

const update = {
  infoBar(mode, data) {
    if (mode === "hidden" || !mode) {
      elements.infoBar.innerHTML = "";
      return;
    }

    if (mode === "folders") {
      const { folderCount, ssTotal, srTotal, activeFilter } = data;
      const chips = [
        `<span class="organizer-info-chip">${Icons.getSvg(
          "folder-open"
        )} ${folderCount} ${I18n.t("organizer.info_folders")}</span>`
      ];
      if (activeFilter === "screenshots")
        chips.push(
          `<span class="organizer-info-chip">${Icons.getSvg(
            "image"
          )} ${ssTotal}</span>`
        );
      if (activeFilter === "recordings")
        chips.push(
          `<span class="organizer-info-chip">${Icons.getSvg(
            "video"
          )} ${srTotal}</span>`
        );
      elements.infoBar.innerHTML = chips.join("");
      return;
    }

    if (mode === "media") {
      const { total, tagged, pending, skipped, activeFilter } = data;
      const chip = (filter, icon, count, label = "", cls = "") => {
        const active = filter === activeFilter ? " chip-active" : "";
        return count > 0 || filter === "all"
          ? `<button class="organizer-info-chip tap-scale${
              cls ? " " + cls : ""
            }${active}" data-ss-filter="${filter}">${Icons.getSvg(
              icon
            )} ${count}${label ? " " + I18n.t(label) : ""}</button>`
          : "";
      };
      elements.infoBar.innerHTML = [
        chip("all", "image", total),
        chip(
          "tagged",
          "check",
          tagged,
          "organizer.info_tagged",
          "chip-success"
        ),
        chip(
          "pending",
          "clock",
          pending,
          "organizer.info_pending",
          "chip-pending"
        ),
        chip("skipped", "x", skipped, "organizer.info_skipped", "chip-skipped")
      ]
        .filter(Boolean)
        .join("");
      return;
    }

    if (mode === "search") {
      const { folderCount, mediaCount, query } = data;
      const chips = [];
      if (folderCount > 0)
        chips.push(
          `<span class="organizer-info-chip">${Icons.getSvg(
            "folder-open"
          )} ${folderCount} ${I18n.t("organizer.info_folders")}</span>`
        );
      if (mediaCount > 0)
        chips.push(
          `<span class="organizer-info-chip">${Icons.getSvg(
            "image"
          )} ${mediaCount}</span>`
        );
      chips.push(
        `<span class="organizer-info-chip">${Icons.getSvg(
          "tag"
        )} ${query}</span>`
      );
      elements.infoBar.innerHTML = chips.join("");
    }
  },

  card(folder, activeFilter) {
    const card = DOM.qs(
      `.organizer-folder-card[data-folder-id="${folder.id}"]`,
      elements.grid
    );
    if (!card) return;
    const badgesContainer = DOM.qs(".organizer-folder-badges", card);
    if (badgesContainer)
      badgesContainer.innerHTML = templates.badges(folder, activeFilter);
  },

  actionsMenu(folderId, folderCard) {
    const existingMenu = DOM.qs(
      `.organizer-folder-actions-popup[data-folder-id="${folderId}"]`
    );
    if (existingMenu) {
      existingMenu.remove();
      return null;
    }
    const wrapper = document.createElement("div");
    wrapper.innerHTML = templates.actionsMenu(folderId).trim();
    const popup = wrapper.firstChild;
    const menuDots = DOM.qs(".organizer-folder-menu-dots", folderCard);
    if (!menuDots) return null;
    if (getComputedStyle(folderCard).position === "static")
      folderCard.style.position = "relative";
    folderCard.appendChild(popup);
    const dotsRect = menuDots.getBoundingClientRect();
    const cardRect = folderCard.getBoundingClientRect();
    popup.style.top = `${
      dotsRect.top - cardRect.top - popup.offsetHeight - 20
    }px`;
    popup.style.display = "block";
    return popup;
  },

  mode(mode, activeFilter) {
    const isFiles = mode === "media";
    const isRecordings = isFiles && activeFilter === "recordings";
    elements.backBtn.style.display = isFiles ? "flex" : "none";
    elements.filterContainer.style.display = isFiles ? "none" : "";
    elements.grid.classList.toggle("media-mode", isFiles);
    elements.grid.classList.toggle("recordings-mode", isRecordings);
    elements.fab.style.display = isFiles ? "none" : "flex";
  },

  gridLoading(show) {
    if (show)
      elements.grid.innerHTML = `<div class="organizer-loading animate-fade-in"><div class="ui-spinner"></div></div>`;
  },

  recordingCard(oldPath, newPath, newName) {
    helpers.updateCardData(".recording-card", oldPath, newPath, newName);
  },

  mediaCard(oldPath, newPath, newName) {
    helpers.updateCardData(".media-card", oldPath, newPath, newName);
  }
};

function init() {
  queryElements();
}

export default {
  init,
  getElements,
  templates,
  render,
  update,
  parseTags: helpers.parseTags
};
