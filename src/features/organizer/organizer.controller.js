import History from "../../core/ui/history.js";
import OrganizerModel from "./organizer.model.js";
import OrganizerView from "./organizer.view.js";
import TaggingController from "./tagging/tagging.controller.js";
import TaggingModel from "./tagging/tagging.model.js";
import MediaDetailController from "./media-detail/media-detail.controller.js";
import AppState from "../../core/state/app-state.js";
import Navigation from "../../core/ui/navigation.js";
import PaginationManager from "../../core/ui/pagination.js";
import Logger from "../../core/platform/logger.js";
import Toast from "../../core/ui/toast.js";
import I18n from "../../core/services/i18n.js";
import Utils from "../../lib/utils.js";
import DOM from "../../lib/dom.js";
import EventBus from "../../core/platform/event-bus.js";
import ThumbnailQueue from "../../core/ui/thumbnail-queue.js";
import ThumbnailCache from "../../core/ui/thumbnail-cache.js";
import TaskQueue from "../../core/platform/task-queue.js";

let suppressNextRender = false;
let paginator = null;
let folderContextHandle = null;
let selectionContextHandle = null;
let isInitialized = false;
const selectedFiles = new Map();

function createFoldersPaginator(grid) {
  return PaginationManager.create({
    container: grid,
    renderItem: (folder, i) => {
      const currentFilter = OrganizerModel.getState().activeFilter;
      return OrganizerView.render.folderNode(folder, i, currentFilter);
    },
    emptyState: () => {
      const currentFilter = OrganizerModel.getState().activeFilter;
      return OrganizerView.templates.emptyState(currentFilter);
    }
  });
}

function createMediaPaginator(grid, isRecordings, activeFilter) {
  return PaginationManager.create({
    container: grid,
    renderItem: (file, i) =>
      OrganizerView.render.mediaNode(file, i, isRecordings),
    emptyState: () => OrganizerView.templates.emptyMedia(activeFilter),
    onBatchRendered: isRecordings
      ? nodes => {
          const cards = nodes.filter(n =>
            n.classList?.contains("is-recording")
          );
          ThumbnailQueue.enqueueAll(cards);
        }
      : null
  });
}

function renderFolders() {
  const folders = OrganizerModel.getFolders();
  const state = OrganizerModel.getState();
  const { grid } = OrganizerView.getElements();
  const filtered = OrganizerView.render.getFiltered(
    folders,
    state.activeFilter
  );

  OrganizerView.update.mode("folders", null);

  if (!paginator) paginator = createFoldersPaginator(grid);

  paginator.reset(filtered);
  OrganizerView.update.filters(state.activeFilter);

  const { ssTotal, srTotal } = OrganizerModel.computeFolderTotals(filtered);
  OrganizerView.update.infoBar("folders", {
    folderCount: filtered.length,
    ssTotal,
    srTotal,
    activeFilter: state.activeFilter
  });
}

function renderMedia() {
  const allFiles = OrganizerModel.getState().currentMedia;
  const files = OrganizerModel.getMedia();
  const { grid } = OrganizerView.getElements();
  const { activeFilter, mediaFilter } = OrganizerModel.getState();
  const isRecordings = activeFilter === "recordings";

  if (isRecordings) ThumbnailQueue.reset();

  if (!paginator)
    paginator = createMediaPaginator(grid, isRecordings, activeFilter);

  paginator.reset(files);

  const { tagged, skipped, pending } =
    OrganizerModel.computeMediaStats(allFiles);
  OrganizerView.update.infoBar("media", {
    total: allFiles.length,
    tagged,
    pending,
    skipped,
    activeFilter: mediaFilter
  });
}

function renderUI() {
  const { mode } = OrganizerModel.getState();
  if (mode === "media") renderMedia();
  else renderFolders();
}

function updatePartial(folderId) {
  const folders = OrganizerModel.getFolders();
  const state = OrganizerModel.getState();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;

  OrganizerView.update.card(folder, state.activeFilter);

  const filtered = OrganizerView.render.getFiltered(
    folders,
    state.activeFilter
  );
  const { ssTotal, srTotal } = OrganizerModel.computeFolderTotals(filtered);
  OrganizerView.update.infoBar("folders", {
    folderCount: filtered.length,
    ssTotal,
    srTotal,
    activeFilter: state.activeFilter
  });
}

const debouncedRender = Utils.debounce(renderUI, 100);

function enqueueThumbnailsFromGrid() {
  ThumbnailQueue.reset();
  const { grid } = OrganizerView.getElements();
  ThumbnailQueue.enqueueAll(Array.from(grid.querySelectorAll(".is-recording")));
}

function searchInMedia(query, activeFilter) {
  const isRecordings = activeFilter === "recordings";
  const files = OrganizerModel.searchMediaInFolder(query);

  OrganizerView.update.searchResults([], files, activeFilter);

  if (isRecordings) enqueueThumbnailsFromGrid();

  OrganizerView.update.infoBar("search", {
    folderCount: 0,
    mediaCount: files.length,
    query
  });
  OrganizerView.update.gridLoading(false);
}

function searchRecordings(query) {
  const folders = OrganizerModel.searchFolders(query, "recordings");
  OrganizerModel.searchMediaByTag(query, "sr")
    .then(files => {
      OrganizerView.update.searchResults(folders, files, "recordings");
      enqueueThumbnailsFromGrid();
      OrganizerView.update.infoBar("search", {
        folderCount: folders.length,
        mediaCount: files.length,
        query
      });
    })
    .catch(() => {});
}

function searchScreenshots(query) {
  const folders = OrganizerModel.searchFolders(query, "screenshots");
  OrganizerModel.searchMediaByTag(query, "ss")
    .then(screenshots => {
      OrganizerView.update.searchResults(folders, screenshots, "screenshots");
      OrganizerView.update.infoBar("search", {
        folderCount: folders.length,
        mediaCount: screenshots.length,
        query
      });
    })
    .catch(() => {});
}

function clearSearch(mode, currentFolder) {
  paginator = null;
  if (mode === "media") {
    if (currentFolder) OrganizerModel.setMediaFilter("all");
    renderMedia();
  } else {
    renderFolders();
  }
}

function routeSearch(query, mode, activeFilter, currentFolder) {
  if (mode === "media" && currentFolder) {
    searchInMedia(query, activeFilter);
    return;
  }
  if (activeFilter === "recordings") {
    searchRecordings(query);
    return;
  }
  searchScreenshots(query);
}

function handleSearch(value) {
  OrganizerModel.setSearchTerm(value);
  Navigation.scrollToTop();

  const { activeFilter, mode, currentFolder } = OrganizerModel.getState();
  const query = value.trim();

  if (!query) {
    clearSearch(mode, currentFolder);
    return;
  }

  OrganizerView.update.infoBar("hidden");
  OrganizerView.update.gridLoading(true);
  paginator = null;

  routeSearch(query, mode, activeFilter, currentFolder);
}

const debouncedSearch = Utils.debounce(handleSearch, 300);

function setFolderCardLoading(folderCard, loading) {
  if (!folderCard) return;
  folderCard.style.opacity = loading ? "0.2" : "1";
  folderCard.style.pointerEvents = loading ? "none" : "auto";
}

function buildCountMessage(key, count) {
  return I18n.t(key, {
    count,
    item: count === 1 ? I18n.t("common.items") : I18n.t("common.items_plural"),
    removed:
      count === 1 ? I18n.t("common.removed") : I18n.t("common.removed_plural")
  });
}

async function handleClearAction(folderId) {
  const folder = OrganizerModel.getFolders().find(f => f.id === folderId);
  if (!folder) {
    Toast.error(I18n.t("organizer.folder_not_found"));
    return;
  }

  const { activeFilter } = OrganizerModel.getState();
  const type = activeFilter === "recordings" ? "sr" : "ss";
  const { grid } = OrganizerView.getElements();
  const folderCard = DOM.qs(`[data-folder-id="${folderId}"]`, grid);

  setFolderCardLoading(folderCard, true);
  suppressNextRender = true;

  try {
    const removedCount = await OrganizerModel.clearFolderContents(
      folderId,
      type
    );
    if (removedCount > 0) {
      OrganizerModel.logClearActivity(folder.name, type, removedCount);
      Toast.success(buildCountMessage("organizer.clear_success", removedCount));
    } else {
      Toast.info(I18n.t("organizer.clear_empty"));
    }
    updatePartial(folderId);
  } catch (error) {
    Logger.error("Error clearing folder:", error);
    Toast.error(I18n.t("organizer.clear_error"));
  } finally {
    suppressNextRender = false;
    setFolderCardLoading(folderCard, false);
  }
}

async function enterFolder(folder) {
  const { activeFilter } = OrganizerModel.getState();
  OrganizerView.update.infoBar("hidden");
  paginator = null;
  OrganizerModel.enterFolder(folder);
  OrganizerView.update.mode("media", activeFilter);
  OrganizerView.update.gridLoading(true);

  const folderPath = OrganizerModel.getFolderPath(folder, activeFilter);

  try {
    const files = await OrganizerModel.loadMediaInFolder(folderPath);
    if (activeFilter === "recordings") {
      ThumbnailCache.evictFolder(
        folderPath,
        files.map(f => f.path)
      ).catch(() => {});
    }
  } catch (e) {
    Logger.warn("[OrganizerController] Could not load folder contents:", e);
  }

  folderContextHandle = History.pushContext(exitFolder);
  renderMedia();
}

function exitFolder() {
  History.popContext(folderContextHandle);
  folderContextHandle = null;
  if (isSelectionActive()) {
    if (selectionContextHandle !== null) {
      History.popContext(selectionContextHandle);
      selectionContextHandle = null;
    }
    clearSelection();
  }
  ThumbnailQueue.reset();
  OrganizerView.update.infoBar("hidden");
  paginator = null;
  OrganizerModel.exitFolder();
  OrganizerView.update.mode("folders", null);
  OrganizerView.getElements().search.value = "";
  requestAnimationFrame(() => renderFolders());
}

function openMediaCard(card, type) {
  MediaDetailController.open(
    {
      path: card.dataset.filePath,
      name: card.dataset.fileName,
      mtime: card.dataset.fileMtime
    },
    type
  );
}

function handleFolderCardClick(card, e) {
  const folder = AppState.getFolders().find(
    f => f.id === card.dataset.folderId
  );
  if (folder) enterFolder(folder);
}

function handleCardUpdate(oldPath, newPath, newName, isVideo) {
  if (isVideo) {
    OrganizerView.update.recordingCard(oldPath, newPath, newName);
  } else {
    OrganizerView.update.mediaCard(oldPath, newPath, newName);
  }

  OrganizerModel.updateMediaFile(oldPath, newPath);

  const allFiles = OrganizerModel.getState().currentMedia;
  const { tagged, skipped, pending } =
    OrganizerModel.computeMediaStats(allFiles);
  const { activeFilter, mediaFilter } = OrganizerModel.getState();
  OrganizerView.update.infoBar("media", {
    total: allFiles.length,
    tagged,
    pending,
    skipped,
    activeFilter: mediaFilter
  });
}

function isSelectionActive() {
  return selectedFiles.size > 0;
}

function getAllMediaCards() {
  const grid = OrganizerView.getElements().grid;
  return Array.from(DOM.qsa(".media-card", grid));
}

function isAllSelected() {
  const cards = getAllMediaCards();
  return (
    cards.length > 0 &&
    cards.every(card => selectedFiles.has(card.dataset.filePath))
  );
}

function updateSelectionBar() {
  OrganizerView.update.selectionBar(
    isSelectionActive(),
    selectedFiles.size,
    isAllSelected()
  );
}

function clearSelection() {
  selectedFiles.forEach(card => OrganizerView.update.cardSelected(card, false));
  selectedFiles.clear();
  updateSelectionBar();
}

function exitSelectionMode() {
  clearSelection();
  selectionContextHandle = null;
}

function toggleCardSelection(card) {
  const path = card.dataset.filePath;
  if (selectedFiles.has(path)) {
    selectedFiles.delete(path);
    OrganizerView.update.cardSelected(card, false);
  } else {
    selectedFiles.set(path, card);
    OrganizerView.update.cardSelected(card, true);
  }

  if (selectedFiles.size === 0) {
    if (selectionContextHandle !== null) {
      History.popContext(selectionContextHandle);
      selectionContextHandle = null;
    }
    updateSelectionBar();
    return;
  }

  if (selectionContextHandle === null)
    selectionContextHandle = History.pushContext(exitSelectionMode);

  updateSelectionBar();
}

function startSelection(card) {
  toggleCardSelection(card);
}

function getSelectedPaths() {
  return Array.from(selectedFiles.keys());
}

async function runSelectionTask(action) {
  const files = getSelectedPaths();
  try {
    const result = await TaskQueue.add(action, files, "default");
    return result;
  } catch (error) {
    Logger.error(`[Organizer] Selection action "${action}" failed:`, error);
    Toast.error(I18n.t("organizer.selection_error"));
    return null;
  }
}

async function runDeleteTask() {
  const files = getSelectedPaths();
  try {
    const result = await TaskQueue.add(
      "delete_files_batch",
      [JSON.stringify(files)],
      "shell"
    );
    return { result, files };
  } catch (error) {
    Logger.error("[Organizer] delete_files_batch failed:", error);
    Toast.error(I18n.t("organizer.selection_error"));
    return null;
  }
}

function handleSelectionSelectAll() {
  const cards = getAllMediaCards();
  if (isAllSelected()) {
    cards.forEach(card => {
      selectedFiles.delete(card.dataset.filePath);
      OrganizerView.update.cardSelected(card, false);
    });
    if (selectionContextHandle !== null) {
      History.popContext(selectionContextHandle);
      selectionContextHandle = null;
    }
  } else {
    cards.forEach(card => {
      selectedFiles.set(card.dataset.filePath, card);
      OrganizerView.update.cardSelected(card, true);
    });
    if (selectionContextHandle === null)
      selectionContextHandle = History.pushContext(exitSelectionMode);
  }
  updateSelectionBar();
}

async function runSelectionTaskAndExit(action) {
  await runSelectionTask(action);
  History.goBack();
}

async function handleSelectionGenerate() {
  await runSelectionTaskAndExit("generate_tags");
}

async function handleSelectionShare() {
  await runSelectionTaskAndExit("share_files");
}

async function handleSelectionDelete() {
  const outcome = await runDeleteTask();
  if (outcome === null) return;

  const { result, files } = outcome;
  const deletedCount = result?.deleted ?? files.length;

  OrganizerModel.removeMediaFiles(files);

  const { currentFolder, activeFilter } = OrganizerModel.getState();
  if (currentFolder && deletedCount > 0) {
    OrganizerModel.updateFolderCount(
      currentFolder.id,
      activeFilter,
      deletedCount
    );
  }

  clearSelection();
  paginator = null;
  renderMedia();

  Toast.success(buildCountMessage("organizer.delete_success", deletedCount));
}

const handlers = {
  onInfoBarClick: e => {
    const btn = e.target.closest("[data-ss-filter]");
    if (!btn) return;
    OrganizerModel.setMediaFilter(btn.dataset.ssFilter);
    paginator = null;
    renderMedia();
  },
  onSearch: e => debouncedSearch(e.target.value),
  onFilterClick: e => {
    const filter = e.target.closest("[data-filter]")?.dataset.filter;
    if (!filter) return;
    ThumbnailQueue.reset();
    OrganizerModel.setFilter(filter);
    renderFolders();
  },
  onGridClick: e => {
    const mediaCardEl = e.target.closest(".media-card");
    if (mediaCardEl && isSelectionActive()) {
      toggleCardSelection(mediaCardEl);
      return;
    }

    const recordingCard = e.target.closest(".is-recording");
    if (recordingCard) {
      openMediaCard(recordingCard, "video");
      return;
    }

    const mediaCard = e.target.closest(".media-card:not(.is-recording)");
    if (mediaCard) {
      openMediaCard(mediaCard, "photo");
      return;
    }

    const folderCard = e.target.closest(".folder-card");
    if (folderCard) handleFolderCardClick(folderCard, e);
  },
  onGridContextMenu: e => {
    const card = e.target.closest(".media-card");
    if (!card) return;
    e.preventDefault();
    startSelection(card);
  },
  onBackClick: () => exitFolder(),
  onFabClick: () => TaggingController.openTaggingDialog(),
  onSelectionBarClick: e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const actionMap = {
      "select-all": handleSelectionSelectAll,
      generate: handleSelectionGenerate,
      share: handleSelectionShare,
      delete: handleSelectionDelete,
      cancel: () => History.goBack()
    };
    actionMap[btn.dataset.action]?.();
  },
  onStateChange: data => {
    if (data.key === "folders" && !suppressNextRender) debouncedRender();
  }
};

function attachEvents() {
  const { grid, search, backBtn, fab, infoBar, filterContainer, selectionBar } =
    OrganizerView.getElements();

  const events = [
    [search, "input", handlers.onSearch],
    [grid, "click", handlers.onGridClick],
    [grid, "contextmenu", handlers.onGridContextMenu],
    [filterContainer, "click", handlers.onFilterClick],
    [backBtn, "click", handlers.onBackClick],
    [fab, "click", handlers.onFabClick],
    [infoBar, "click", handlers.onInfoBarClick],
    [selectionBar, "click", handlers.onSelectionBarClick]
  ];
  events.forEach(([el, event, handler]) => el.addEventListener(event, handler));

  EventBus.on("appstate:changed", handlers.onStateChange);
}

function setupMediaDetailController() {
  MediaDetailController.setCardUpdateCallback(handleCardUpdate);
  MediaDetailController.setGenerateFn(TaggingModel.generateTags);
  MediaDetailController.setErrorHandler(TaggingController.handleTaggingError);
  MediaDetailController.setRequireGeminiKey(TaggingController.requireGeminiKey);
}

function init() {
  if (isInitialized) return;
  OrganizerView.init();
  TaggingController.init();
  MediaDetailController.init();
  setupMediaDetailController();
  renderUI();
  attachEvents();
  isInitialized = true;
}

export default {
  init,
  renderUI
};
