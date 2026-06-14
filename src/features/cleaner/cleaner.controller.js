import CleanerModel from "./cleaner.model.js";
import CleanerView from "./cleaner.view.js";
import FolderDialogController from "./folder-dialog/folder-dialog.controller.js";
import EventBus from "../../core/platform/event-bus.js";
import PaginationManager from "../../core/ui/pagination.js";
import Utils from "../../lib/utils.js";

let isInitialized = false;
let suppressNextRender = false;
let paginator = null;

function getFilteredFolders() {
  const { search } = CleanerView.getElements();
  const query = search?.value.trim().toLowerCase() ?? "";
  const activeFilter = CleanerModel.getActiveFilter();
  const showEnabledOnly = CleanerModel.getShowEnabledOnly();
  const folders = CleanerView.render.getFiltered(
    CleanerModel.getFolders(),
    activeFilter,
    showEnabledOnly
  );
  if (!query) return folders;
  return folders.filter(f => f.name.toLowerCase().includes(query));
}

function renderUI() {
  const { grid, search } = CleanerView.getElements();
  const activeFilter = CleanerModel.getActiveFilter();
  const showEnabledOnly = CleanerModel.getShowEnabledOnly();

  if (!paginator) {
    paginator = PaginationManager.create({
      container: grid,
      renderItem: (folder, i) =>
        CleanerView.render.folderNode(
          folder,
          i,
          CleanerModel.getActiveFilter()
        ),
      emptyState: () => {
        const query = search?.value.trim() ?? "";
        if (query) return CleanerView.templates.searchEmptyState();
        if (CleanerModel.getShowEnabledOnly())
          return CleanerView.templates.enabledEmptyState();
        return CleanerView.templates.emptyState();
      }
    });
  }

  const folders = getFilteredFolders();
  paginator.reset(folders);
  CleanerView.update.filters(activeFilter);
  CleanerView.update.counts(
    CleanerModel.getFolders(),
    activeFilter,
    showEnabledOnly
  );
}

function updatePartial(folderId) {
  const folders = CleanerModel.getFolders();
  const activeFilter = CleanerModel.getActiveFilter();
  const showEnabledOnly = CleanerModel.getShowEnabledOnly();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;

  const isRecordings = activeFilter === "recordings";
  const stillMatchesFilter = isRecordings
    ? folder.sr?.cleaner?.on
    : folder.ss?.cleaner?.on;

  if (showEnabledOnly && !stillMatchesFilter) {
    paginator.reset(getFilteredFolders());
  } else {
    CleanerView.update.card(folder, activeFilter);
  }

  FolderDialogController.refreshBody(folder, activeFilter);
  CleanerView.update.counts(folders, activeFilter, showEnabledOnly);
}

const debouncedRender = Utils.debounce(renderUI, 100);

const handlers = {
  onFilterClick: e => {
    const filter = e.target.closest("[data-filter]")?.dataset.filter;
    if (!filter || filter === CleanerModel.getActiveFilter()) return;
    CleanerModel.setActiveFilter(filter);
    paginator = null;
    renderUI();
  },
  onListClick: e => {
    const card = e.target.closest(".folder-card");
    if (!card) return;
    const folderId = card.dataset.folderId;
    if (!folderId) return;
    const folders = CleanerModel.getFolders();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    FolderDialogController.open(folder, CleanerModel.getActiveFilter());
  },

  onSearch: Utils.debounce(() => {
    const folders = getFilteredFolders();
    paginator?.reset(folders);
  }, 200),

  onCountsClick: e => {
    const pill = e.target.closest("[data-action='toggleEnabledFilter']");
    if (!pill) return;
    CleanerModel.toggleShowEnabledOnly();
    paginator = null;
    renderUI();
  },

  onStateChange: data => {
    if (data.key === "folders" && !suppressNextRender) debouncedRender();
  }
};

function attachEvents() {
  const { grid, search, filterContainer, infoBar } = CleanerView.getElements();

  const events = [
    [grid, "click", handlers.onListClick],
    [search, "input", handlers.onSearch],
    [filterContainer, "click", handlers.onFilterClick],
    [infoBar, "click", handlers.onCountsClick]
  ];
  events.forEach(([el, event, handler]) => el.addEventListener(event, handler));

  EventBus.on("appstate:changed", handlers.onStateChange);
}

function setupFolderDialog() {
  FolderDialogController.setOnChange((folderId, mutate) => {
    suppressNextRender = true;
    try {
      mutate();
      updatePartial(folderId);
    } finally {
      suppressNextRender = false;
    }
  });
  FolderDialogController.init();
}

function init() {
  if (isInitialized) return;
  CleanerView.init();
  renderUI();
  attachEvents();
  setupFolderDialog();
  isInitialized = true;
}

export default {
  init
};
