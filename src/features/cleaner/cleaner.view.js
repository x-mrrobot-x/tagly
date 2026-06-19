import DOM from "../../lib/dom.js";
import Icons from "../../core/ui/icons.js";
import I18n from "../../core/services/i18n.js";

let elements = null;

function queryElements() {
  elements = {
    tabContent: DOM.qs("#tab-cleaner"),
    grid: DOM.qs("#cleaner-folders-grid"),
    filterContainer: DOM.qs("#cleaner-filters-row"),
    search: DOM.qs("#cleaner-search-input"),
    infoBar: DOM.qs("#cleaner-info-bar")
  };
}

function getElements() {
  return elements;
}

const templates = {
  cleanerBadge: (folder, activeFilter) => {
    const isRecordings = activeFilter === "recordings";
    const isOn = isRecordings ? folder.sr?.cleaner?.on : folder.ss?.cleaner?.on;
    if (!isOn) return "";
    return `<div class="folder-card-badges">
      <span class="folder-card-badge cleaner-check-badge">${Icons.getSvg(
        "circle-check-big"
      )}</span>
    </div>`;
  },

  folderCard: (folder, index, activeFilter) => {
    if (!folder.ss && !folder.sr) return "";
    return `<div class="folder-card card tap-scale animate-scale-in" style="animation-delay: ${
      0.1 + index * 0.04
    }s" data-folder-id="${folder.id}">
      <div class="folder-card-top">
        ${templates.cleanerBadge(folder, activeFilter)}
        <div class="folder-card-app-icon">${Icons.getAppIcon(folder)}</div>
      </div>
      <div class="folder-card-bottom">
        <span class="folder-card-name truncate-text">${folder.name}</span>
      </div>
    </div>`;
  },

  emptyState: () =>
    `<div class="folder-empty-state animate-fade-in" style="animation-delay: 0.3s">
      <div class="folder-empty-icon-wrapper">${Icons.getSvg("broom")}</div>
      <p class="folder-empty-title">${I18n.t("cleaner.empty_title")}</p>
      <p class="folder-empty-subtitle">${I18n.t("cleaner.empty_subtitle")}</p>
    </div>`,

  searchEmptyState: () =>
    `<div class="folder-empty-state animate-fade-in" style="animation-delay: 0.1s">
      <div class="folder-empty-icon-wrapper">${Icons.getSvg("search")}</div>
      <p class="folder-empty-title">${I18n.t("cleaner.search_empty")}</p>
    </div>`,

  enabledEmptyState: () =>
    `<div class="folder-empty-state animate-fade-in" style="animation-delay: 0.1s">
      <div class="folder-empty-icon-wrapper">${Icons.getSvg(
        "circle-check-big"
      )}</div>
      <p class="folder-empty-title">${I18n.t("cleaner.enabled_empty_title")}</p>
      <p class="folder-empty-subtitle">${I18n.t(
        "cleaner.enabled_empty_subtitle"
      )}</p>
    </div>`,

  countsHtml: (count, activeFilter, showEnabledOnly) => {
    const isRecordings = activeFilter === "recordings";
    const icon = Icons.getSvg(isRecordings ? "video" : "image");
    const pill = `<button type="button" class="cleaner-summary-pill ${
      showEnabledOnly ? "active" : ""
    }" data-action="toggleEnabledFilter" aria-pressed="${String(
      showEnabledOnly
    )}">${icon} ${count}</button>`;
    return `<div class="cleaner-summary-card card animate-fade-in">
      <span class="cleaner-summary-label-title">${I18n.t(
        "cleaner.summary_title"
      )}</span>
      <div class="cleaner-summary-pills">${pill}</div>
    </div>`;
  }
};

const render = {
  getFiltered: (folders, activeFilter, showEnabledOnly) => {
    let result = folders;
    if (activeFilter === "screenshots") result = result.filter(f => f.ss);
    else if (activeFilter === "recordings") result = result.filter(f => f.sr);

    if (showEnabledOnly) {
      const isRecordings = activeFilter === "recordings";
      result = result.filter(f =>
        isRecordings ? f.sr?.cleaner?.on : f.ss?.cleaner?.on
      );
    }
    return result;
  },

  folderNode: (folder, index, activeFilter) => {
    const html = templates.folderCard(folder, index, activeFilter);
    if (!html) return null;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    return wrapper.firstChild;
  }
};

const update = {
  filters: activeFilter => {
    elements.filterContainer.querySelectorAll("[data-filter]").forEach(btn => {
      const isActive = btn.dataset.filter === activeFilter;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  },

  counts: (folders, activeFilter, showEnabledOnly) => {
    const isRecordings = activeFilter === "recordings";
    const count = isRecordings
      ? folders.filter(f => f.sr?.cleaner?.on).length
      : folders.filter(f => f.ss?.cleaner?.on).length;
    elements.infoBar.innerHTML = templates.countsHtml(
      count,
      activeFilter,
      showEnabledOnly
    );
  },

  card: (folder, activeFilter) => {
    if (!folder) return;
    const card = DOM.qs(
      `.folder-card[data-folder-id="${folder.id}"]`,
      elements.grid
    );
    if (!card) return;

    const oldBadges = DOM.qs(".folder-card-badges", card);
    const newBadgesHtml = templates.cleanerBadge(folder, activeFilter);
    if (newBadgesHtml) {
      if (oldBadges) oldBadges.outerHTML = newBadgesHtml;
      else {
        const top = DOM.qs(".folder-card-top", card);
        top?.insertAdjacentHTML("afterbegin", newBadgesHtml);
      }
    } else {
      oldBadges?.remove();
    }
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
  update
};
