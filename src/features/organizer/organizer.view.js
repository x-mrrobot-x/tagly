import DOM from "../../lib/dom.js";
import Icons from "../../core/ui/icons.js";
import I18n from "../../core/services/i18n.js";

let elements = null;

function queryElements() {
  elements = {
    tabContent: DOM.qs("#tab-organizer"),
    grid: DOM.qs("#organizer-folders-grid"),
    filterContainer: DOM.qs("#organizer-filters-row"),
    search: DOM.qs("#organizer-search-input"),
    infoBar: DOM.qs("#organizer-info-bar"),
    backBtn: DOM.qs("#organizer-back-btn"),
    fab: DOM.qs("#organizer-fab"),
    selectionBar: DOM.qs("#organizer-selection-bar")
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
    return `<div class="folder-card-badge">${icon} <span>${count}</span></div>`;
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
    <div class="folder-card card tap-scale animate-scale-in" style="animation-delay: ${
      0.1 + index * 0.04
    }s" data-folder-id="${folder.id}">
      <div class="folder-card-top">
        <div class="folder-card-badges">${templates.badges(
          folder,
          activeFilter
        )}</div>
        <div class="folder-card-app-icon">${Icons.getAppIcon(folder)}</div>
      </div>
      <div class="folder-card-bottom">
        <span class="folder-card-name truncate-text">${folder.name}</span>
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
    return `<div class="folder-empty-state animate-fade-in" style="animation-delay: 0.3s">
      <div class="folder-empty-icon-wrapper">${Icons.getSvg(
        "folder-open"
      )}</div>
      <p class="folder-empty-title">${title}</p>
      <p class="folder-empty-subtitle">${subtitle}</p>
    </div>`;
  },

  emptyMedia: activeFilter => {
    const isRecordings = activeFilter === "recordings";
    return `<div class="folder-empty-state animate-fade-in" style="animation-delay: 0.3s">
      <div class="folder-empty-icon-wrapper">${Icons.getSvg(
        isRecordings ? "video" : "image"
      )}</div>
      <p class="folder-empty-title">${I18n.t(
        isRecordings
          ? "organizer.empty_recordings_folder"
          : "organizer.empty_screenshots_folder"
      )}</p>
    </div>`;
  },

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
  }
};

const update = {
  filters(activeFilter) {
    elements.filterContainer.querySelectorAll("[data-filter]").forEach(btn => {
      const isActive = btn.dataset.filter === activeFilter;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  },

  searchResults(folders, files, activeFilter) {
    const hasFolders = folders.length > 0;
    const hasFiles = files.length > 0;

    if (!hasFolders && !hasFiles) {
      elements.grid.innerHTML = `<div class="folder-empty-state animate-fade-in" style="animation-delay:0.1s">
        <div class="folder-empty-icon-wrapper">${Icons.getSvg("search")}</div>
        <p class="folder-empty-title">${I18n.t("organizer.search_empty")}</p>
      </div>`;
      return;
    }

    let html = "";
    if (hasFolders)
      html += templates.searchFoldersSection(folders, activeFilter);
    if (hasFiles) html += templates.searchFilesSection(files, activeFilter);
    elements.grid.innerHTML = html;
  },

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
      `.folder-card[data-folder-id="${folder.id}"]`,
      elements.grid
    );
    if (!card) return;
    const badgesContainer = DOM.qs(".folder-card-badges", card);
    if (badgesContainer)
      badgesContainer.innerHTML = templates.badges(folder, activeFilter);
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
  },

  selectionBar(visible, count, allSelected) {
    const bar = elements.selectionBar;
    if (visible) {
      bar.classList.remove("is-hiding");
      bar.classList.add("is-visible");
      const selectAllBtn = bar.querySelector('[data-action="select-all"]');
      const countEl = selectAllBtn?.querySelector(".organizer-selection-count");
      if (countEl) countEl.textContent = String(count);
      selectAllBtn?.classList.toggle("is-all-selected", !!allSelected);
    } else if (bar.classList.contains("is-visible")) {
      bar.classList.add("is-hiding");
      const onEnd = () => {
        bar.classList.remove("is-visible", "is-hiding");
        bar.removeEventListener("animationend", onEnd);
      };
      bar.addEventListener("animationend", onEnd);
    }
  },

  cardSelected(card, selected) {
    card.classList.toggle("is-selected", selected);
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
