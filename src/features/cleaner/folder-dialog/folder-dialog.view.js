import DOM from "../../../lib/dom.js";
import Icons from "../../../core/ui/icons.js";
import I18n from "../../../core/services/i18n.js";

const DAY_OPTIONS = [1, 7, 15, 30, 60];
let elements = null;

function queryElements() {
  elements = {
    dialog: DOM.qs("#dialog-cleaner-folder"),
    dialogIcon: DOM.qs("#dialog-cleaner-folder-icon"),
    dialogTitle: DOM.qs("#dialog-cleaner-folder-title"),
    dialogBody: DOM.qs("#dialog-cleaner-folder-body"),
    dialogClose: DOM.qs("#dialog-cleaner-folder-close")
  };
}

function getElements() {
  return elements;
}

function getOpenFolderId() {
  const row = DOM.qs(".cleaner-dialog-row", elements?.dialogBody);
  return row?.dataset.dialogFolderId ?? null;
}

const templates = {
  dayButton: (mediaType, days, isActive) => `
    <button class="cleaner-day-button tap-scale ${
      isActive ? "active" : ""
    }" data-action="setFolderDays" data-media-type="${mediaType}" data-days="${days}">
      ${days} ${I18n.t("cleaner.day", { n: days })}
    </button>`,

  cleanerGroup: (folder, mediaType, key) => {
    if (!folder[key]?.cleaner?.on) return "";
    const currentDays = folder[key].cleaner.days;
    const optionsHtml = DAY_OPTIONS.map(d =>
      templates.dayButton(mediaType, d, currentDays === d)
    ).join("");
    return `<div class="cleaner-group" id="cleaner-group-${folder.id}-${mediaType}">
      <p class="cleaner-group-label">${I18n.t("cleaner.delete_after")}</p>
      <div class="cleaner-day-options">${optionsHtml}</div>
    </div>`;
  },

  switchRow: (folder, mediaType, key, label) => {
    if (!folder[key]) return "";
    const cleanerOn = folder[key]?.cleaner?.on;
    const groupHtml = cleanerOn ? templates.cleanerGroup(folder, mediaType, key) : "";
    return `<div class="cleaner-dialog-row" data-row-media-type="${mediaType}" data-dialog-folder-id="${folder.id}">
      <label class="cleaner-switch-container" data-media-type="${mediaType}">
        <span class="cleaner-switch-label">${label}</span>
        <input type="checkbox" class="switch-md" data-action="toggleFolderClean"
          data-media-type="${mediaType}" ${cleanerOn ? "checked" : ""}>
      </label>
      ${groupHtml}
    </div>`;
  },

  bodyRows: (folder, activeFilter) => {
    const isRecordings = activeFilter === "recordings";
    const ssRow = !isRecordings
      ? templates.switchRow(folder, "screenshots", "ss", I18n.t("common.screenshots_label"))
      : "";
    const srRow = isRecordings
      ? templates.switchRow(folder, "screenrecordings", "sr", I18n.t("common.recordings_label"))
      : "";
    return ssRow + srRow;
  }
};

const update = {
  open(folder, activeFilter) {
    elements.dialogIcon.innerHTML = Icons.getAppIcon(folder);
    elements.dialogTitle.textContent = folder.name;
    elements.dialogBody.innerHTML = templates.bodyRows(folder, activeFilter);
  },

  refreshBody(folder, activeFilter) {
    const row = DOM.qs(".cleaner-dialog-row", elements.dialogBody);
    if (!row || row.dataset.dialogFolderId !== folder.id) return;
    elements.dialogBody.innerHTML = templates.bodyRows(folder, activeFilter);
  }
};

function init() {
  queryElements();
}

export default {
  init,
  getElements,
  getOpenFolderId,
  templates,
  update
};