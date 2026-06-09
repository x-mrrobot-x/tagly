import CleanerModel from "./cleaner.model.js";
import CleanerView from "./cleaner.view.js";
import EventBus from "../../core/platform/event-bus.js";
import PaginationManager from "../../core/ui/pagination.js";
import Utils from "../../lib/utils.js";

let isInitialized = false;
let suppressNextRender = false;
let paginator = null;

function renderUI() {
  const folders = CleanerModel.getFolders();
  const { list } = CleanerView.getElements();

  if (!paginator) {
    paginator = PaginationManager.create({
      container: list,
      renderItem: (folder, i) => CleanerView.render.folderNode(folder, i),
      emptyState: () => CleanerView.templates.emptyState()
    });
  }

  paginator.reset(folders);
  CleanerView.render.cleaner(folders);
}

function updatePartial(folderId) {
  const folders = CleanerModel.getFolders();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  CleanerView.update.card(folder);
  CleanerView.render.counts(folders);
}

const debouncedRender = Utils.debounce(renderUI, 100);

const handlers = {
  onListClick: e => {
    const card = e.target.closest(".cleaner-folder-card");
    const btn = e.target.closest("[data-action]");
    if (!card || !btn) return;
    e.stopPropagation();
    const { folderId } = card.dataset;
    const { action, mediaType, days } = btn.dataset;
    suppressNextRender = true;
    try {
      if (action === "setFolderDays")
        CleanerModel.setFolderDays(folderId, mediaType, parseInt(days, 10));
      updatePartial(folderId);
    } finally {
      suppressNextRender = false;
    }
  },
  onListChange: e => {
    const card = e.target.closest(".cleaner-folder-card");
    const input = e.target.closest("input[data-action]");
    if (!card || !input) return;
    const { folderId } = card.dataset;
    const { action, mediaType } = input.dataset;
    suppressNextRender = true;
    try {
      if (action === "toggleFolderClean")
        CleanerModel.toggleFolderClean(folderId, mediaType);
      updatePartial(folderId);
    } finally {
      suppressNextRender = false;
    }
  },
  onStateChange: data => {
    if (data.key === "folders" && !suppressNextRender) debouncedRender();
  }
};

function attachEvents() {
  const { list } = CleanerView.getElements();
  const events = [
    [list, "click", handlers.onListClick],
    [list, "change", handlers.onListChange]
  ];
  events.forEach(([el, event, handler]) => el.addEventListener(event, handler));

  EventBus.on("appstate:changed", handlers.onStateChange);
}

function init() {
  if (isInitialized) return;
  CleanerView.init();
  renderUI();
  attachEvents();
  isInitialized = true;
}

export default {
  init
};
