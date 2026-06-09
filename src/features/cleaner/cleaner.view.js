import DOM from "../../lib/dom.js";
import Icons from "../../core/ui/icons.js";
import I18n from "../../core/services/i18n.js";

const DAY_OPTIONS = [1, 7, 15, 30, 60];
let elements = null;

function queryElements() {
  elements = {
    tabContent: DOM.qs("#tab-cleaner"),
    list: DOM.qs("#cleaner-folder-list"),
    countText: DOM.qs("#cleaner-subtitle")
  };
}

function getElements() {
  return elements;
}

const templates = {
  dayButton: (mediaType, days, isActive) => `
    <button class="cleaner-day-button tap-scale ${
      isActive ? "active" : ""
    }" data-action="setFolderDays" data-media-type="${mediaType}" data-days="${days}">
      ${days} ${I18n.t("cleaner.day", { n: days })}
    </button>`,

  cleanerGroup: (folder, mediaType, key, label) => {
    if (!folder[key]?.cleaner?.on) return "";
    const currentDays = folder[key].cleaner.days;
    const optionsHtml = DAY_OPTIONS.map(d =>
      templates.dayButton(mediaType, d, currentDays === d)
    ).join("");
    return `<div class="cleaner-group" id="cleaner-group-${
      folder.id
    }-${mediaType}"><p>${label} - ${I18n.t(
      "cleaner.delete_after"
    )}</p><div class="cleaner-day-options">${optionsHtml}</div></div>`;
  },

  switchContainer: (folder, mediaType, key, label) => {
    if (!folder[key]) return "";
    const cleanerOn = folder[key]?.cleaner?.on;
    return `<label class="cleaner-switch-container" data-media-type="${mediaType}"><span class="cleaner-switch-label">${label}</span><input type="checkbox" class="switch-md" data-action="toggleFolderClean" data-media-type="${mediaType}" ${
      cleanerOn ? "checked" : ""
    }></label>`;
  },

  buildSwitches: folder => ({
    screenshots: templates.switchContainer(
      folder,
      "screenshots",
      "ss",
      I18n.t("common.screenshots_short")
    ),
    recordings: templates.switchContainer(
      folder,
      "screenrecordings",
      "sr",
      I18n.t("common.recordings_short")
    )
  }),

  emptyState: () =>
    `<div class="cleaner-empty-state animate-fade-in" style="animation-delay: 0.3s">
      <div class="cleaner-empty-icon-wrapper">${Icons.getSvg("broom")}</div>
      <p class="cleaner-empty-title">${I18n.t("cleaner.empty_title")}</p>
      <p class="cleaner-empty-subtitle">${I18n.t("cleaner.empty_subtitle")}</p>
    </div>`,

  folderCard: (folder, index) => {
    if (!folder.ss && !folder.sr) return "";
    const { screenshots, recordings } = templates.buildSwitches(folder);
    if (!screenshots && !recordings) return "";
    const isEnabled = folder.ss?.cleaner?.on || folder.sr?.cleaner?.on;
    const optionsHtml = isEnabled
      ? `<div class="cleaner-folder-options">${templates.cleanerGroup(
          folder,
          "screenshots",
          "ss",
          I18n.t("common.screenshots_label")
        )}${templates.cleanerGroup(
          folder,
          "screenrecordings",
          "sr",
          I18n.t("common.recordings_label")
        )}</div>`
      : "";
    return `<div class="cleaner-folder-card card ${
      isEnabled ? "enabled" : ""
    } animate-fade-in-up" style="animation-delay: ${
      0.2 + index * 0.05
    }s" data-folder-id="${folder.id}">
      <div class="cleaner-folder-header">${Icons.getAppIcon(
        folder
      )}<span class="cleaner-folder-name truncate-text">${
        folder.name
      }</span><div class="cleaner-folder-switches">${screenshots}${recordings}</div></div>
      ${optionsHtml}
    </div>`;
  }
};

const render = {
  buildCountsHtml: (ssCount, srCount) => `
    <div class="cleaner-subtitle-item"><span class="dot dot-screenshot"></span><span>${ssCount} ${I18n.t(
      "cleaner.count_screenshots",
      { n: ssCount }
    )}</span></div>
    <div class="cleaner-subtitle-item"><span class="dot dot-recording"></span><span>${srCount} ${I18n.t(
      "cleaner.count_recordings",
      { n: srCount }
    )}</span></div>`,

  counts: folders => {
    const ssCount = folders.filter(f => f.ss?.cleaner?.on).length;
    const srCount = folders.filter(f => f.sr?.cleaner?.on).length;
    const hasActive = ssCount > 0 || srCount > 0;
    if (hasActive)
      elements.countText.innerHTML = render.buildCountsHtml(ssCount, srCount);
    else elements.countText.textContent = I18n.t("cleaner.no_active_folders");
  },

  folderNode: (folder, index) => {
    const html = templates.folderCard(folder, index);
    if (!html) return null;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    return wrapper.firstChild;
  },

  cleaner: folders => {
    render.counts(folders);
  }
};

const update = {
  switchButtons: (card, folder) => {
    const ssInput = DOM.qs('input[data-media-type="screenshots"]', card);
    const srInput = DOM.qs('input[data-media-type="screenrecordings"]', card);
    if (ssInput) ssInput.checked = !!folder.ss?.cleaner?.on;
    if (srInput) srInput.checked = !!folder.sr?.cleaner?.on;
  },

  optionsDiv: (card, folder, isEnabled) => {
    let optionsDiv = DOM.qs(".cleaner-folder-options", card);
    if (isEnabled) {
      if (!optionsDiv) {
        optionsDiv = document.createElement("div");
        optionsDiv.className = "cleaner-folder-options";
        card.appendChild(optionsDiv);
      }
      optionsDiv.innerHTML =
        templates.cleanerGroup(
          folder,
          "screenshots",
          "ss",
          I18n.t("common.screenshots_label")
        ) +
        templates.cleanerGroup(
          folder,
          "screenrecordings",
          "sr",
          I18n.t("common.recordings_label")
        );
    } else {
      optionsDiv?.remove();
    }
  },

  card: folder => {
    if (!folder) return;
    const card = DOM.qs(
      `.cleaner-folder-card[data-folder-id="${folder.id}"]`,
      elements.list
    );
    if (!card) return;
    const isEnabled = folder.ss?.cleaner?.on || folder.sr?.cleaner?.on;
    card.classList.toggle("enabled", isEnabled);
    update.switchButtons(card, folder);
    update.optionsDiv(card, folder, isEnabled);
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
