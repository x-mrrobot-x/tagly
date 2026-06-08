import AppState from "../../core/state/app-state.js";
import TaskQueue from "../../core/platform/task-queue.js";
import Logger from "../../core/platform/logger.js";
import ENV from "../../core/platform/env.js";

const state = {
  activeFilter: "screenshots",
  searchTerm: "",
  mode: "folders",
  currentFolder: null,
  currentMedia: [],
  mediaStats: {
    pending: 0,
    tagged: 0,
    skipped: 0
  },
  pendingMedia: [],
  mediaFilter: "all"
};

function getFolders() {
  return AppState.getFolders();
}

function setFilter(filter) {
  state.activeFilter = filter;
}

function setSearchTerm(term) {
  state.searchTerm = term;
}

function deleteFolder(id) {
  const folders = AppState.getFolders().filter(f => f.id !== id);
  AppState.setFolders(folders);
}

function mediaConfig(type) {
  return type === "sr"
    ? { dir: ENV.PATHS.ORGANIZED_RECORDINGS || "" }
    : { dir: ENV.PATHS.ORGANIZED_SCREENSHOTS || "" };
}

function mapMediaFiles(files, dir) {
  return files.map(relativePath => ({
    name: relativePath.split("/").pop(),
    path: `${dir}/${relativePath}`
  }));
}

async function clearMedia(folder, mediaType, basePath) {
  const mediaFolderPath = `${basePath}/${folder.name}`;
  const result = await TaskQueue.add(
    "delete_folder_contents",
    [mediaFolderPath],
    "shell"
  );
  if (result?.deleted > 0) {
    folder[mediaType].count = 0;
    if (result.mtime) folder[mediaType].mtime = result.mtime;
    return result.deleted;
  }
  return 0;
}

function buildClearPromises(folder, type) {
  const promises = [];
  if ((type === "ss" || type === "both") && folder.ss)
    promises.push(clearMedia(folder, "ss", ENV.PATHS.ORGANIZED_SCREENSHOTS));
  if ((type === "sr" || type === "both") && folder.sr)
    promises.push(clearMedia(folder, "sr", ENV.PATHS.ORGANIZED_RECORDINGS));
  return promises;
}

async function clearFolderContents(folderId, type) {
  const folders = AppState.getFolders();
  const folderIndex = folders.findIndex(f => f.id === folderId);
  if (folderIndex === -1) {
    Logger.warn(`[OrganizerModel] Folder ${folderId} not found.`);
    return 0;
  }

  const folder = { ...folders[folderIndex] };
  if (folder.ss) folder.ss = { ...folder.ss };
  if (folder.sr) folder.sr = { ...folder.sr };

  try {
    const counts = await Promise.all(buildClearPromises(folder, type));
    const total = counts.reduce((s, n) => s + n, 0);
    folders[folderIndex] = folder;
    AppState.setFolders(folders);
    return total;
  } catch (error) {
    Logger.error("[OrganizerModel] Error clearing folder:", error);
    return 0;
  }
}

function logClearActivity(folderName, mediaType, removedCount) {
  AppState.addActivity({
    type: "cleaner-folder",
    count: removedCount,
    execution: "manual",
    folder: folderName,
    mediaType,
    timestamp: Date.now()
  });
  AppState.incrementStat("cleanedFiles", removedCount);
}

function getAutoOrganizerSetting() {
  return AppState.getSetting("autoOrganizer");
}

function toggleAutoOrganizer() {
  const newValue = AppState.toggleSetting("autoOrganizer");
  AppState.addActivity({
    type: "feature-toggle",
    feature: "auto-organizer",
    enabled: newValue
  });
  return newValue;
}

function searchFolders(query, activeFilter) {
  const term = query.toLowerCase();
  return AppState.getFolders().filter(f => {
    if (!f.name.toLowerCase().includes(term)) return false;
    if (activeFilter === "screenshots") return !!f.ss;
    if (activeFilter === "recordings") return !!f.sr;
    return true;
  });
}

function enterFolder(folder) {
  state.mode = "media";
  state.currentFolder = folder;
  state.currentMedia = [];
  state.searchTerm = "";
  state.mediaFilter = "all";
}

function exitFolder() {
  state.mode = "folders";
  state.currentFolder = null;
  state.currentMedia = [];
  state.searchTerm = "";
}

function setMedia(files) {
  state.currentMedia = files || [];
}

function updateMediaFile(oldPath, newPath) {
  const newName = newPath.split("/").pop();
  state.currentMedia = state.currentMedia.map(f =>
    f.path === oldPath ? { ...f, path: newPath, name: newName } : f
  );
}

function setMediaFilter(filter) {
  state.mediaFilter = filter || "all";
}

function getMedia() {
  const files = [...state.currentMedia];
  switch (state.mediaFilter) {
    case "tagged":
      return files.filter(
        f => !f.name.includes("[skip]") && f.name.includes("[")
      );
    case "pending":
      return files.filter(f => !f.name.includes("["));
    case "skipped":
      return files.filter(f => f.name.includes("[skip]"));
    default:
      return files;
  }
}

function setMediaStats(stats) {
  state.mediaStats = { ...stats };
}

function getMediaStats() {
  return { ...state.mediaStats };
}

async function loadMediaStats(type) {
  const { dir } = mediaConfig(type);
  try {
    if (!dir) return;
    const result = await TaskQueue.add("get_media_stats", [dir], "shell");
    if (result) setMediaStats(result);
  } catch (error) {
    Logger.warn("[OrganizerModel] Could not load media stats:", error);
  }
}

async function loadMediaInFolder(folderPath) {
  const result = await TaskQueue.add(
    "list_media_in_folder",
    [folderPath],
    "shell"
  );
  const files = (result?.files || []).map(name => ({
    name,
    path: `${folderPath}/${name}`
  }));
  setMedia(files);
  return files;
}

async function searchMediaByTag(tagQuery, type) {
  const { dir } = mediaConfig(type);
  const result = await TaskQueue.add(
    "search_media_by_tag",
    [dir, tagQuery],
    "shell"
  );
  return result?.files || [];
}

async function searchMediaByTagInFolder(folderPath, tagQuery) {
  const result = await TaskQueue.add(
    "search_media_by_tag",
    [folderPath, tagQuery],
    "shell"
  );
  return result?.files || [];
}

async function loadPendingMedia(type) {
  const { dir } = mediaConfig(type);
  try {
    if (!dir) return;
    const result = await TaskQueue.add("get_pending_media", [dir], "shell");
    state.pendingMedia = mapMediaFiles(result?.files || [], dir);
  } catch (error) {
    Logger.warn("[OrganizerModel] Could not load pending media:", error);
  }
}

function getPendingMedia() {
  return [...state.pendingMedia];
}

function removePendingItem(path) {
  state.pendingMedia = state.pendingMedia.filter(f => f.path !== path);
}

function clearPendingItems() {
  state.pendingMedia = [];
}

async function skipMedia(filePath) {
  const result = await TaskQueue.add("skip_screenshot", [filePath], "shell");
  return result?.newPath || null;
}

async function applyTagsToFile(filePath, tags) {
  const tagsCsv = Array.isArray(tags) ? tags.join(",") : tags;
  const result = await TaskQueue.add(
    "apply_tags_to_filename",
    [filePath, tagsCsv],
    "shell"
  );
  return result?.newPath || null;
}

async function clearTagsFromFile(filePath) {
  const result = await TaskQueue.add(
    "clear_tags_from_filename",
    [filePath],
    "shell"
  );
  return result?.newPath || null;
}

async function removeTagFromFile(filePath, tagToRemove) {
  const name = filePath.split("/").pop();
  const match = name.match(/\[([^\]]+)\]/);
  const inner = match?.[1] || "";
  const currentTags = inner === "skip" ? [] : inner.split("_").filter(Boolean);
  const remaining = currentTags.filter(t => t !== tagToRemove);
  if (remaining.length === 0) return clearTagsFromFile(filePath);
  return applyTagsToFile(filePath, remaining.join(","));
}

export default {
  getFolders,
  setFilter,
  setSearchTerm,
  deleteFolder,
  clearFolderContents,
  logClearActivity,
  getAutoOrganizerSetting,
  toggleAutoOrganizer,
  searchFolders,
  enterFolder,
  exitFolder,
  setMedia,
  updateMediaFile,
  getMedia,
  setMediaFilter,
  setMediaStats,
  getMediaStats,
  loadMediaStats,
  loadMediaInFolder,
  searchMediaByTag,
  searchMediaByTagInFolder,
  loadPendingMedia,
  getPendingMedia,
  removePendingItem,
  clearPendingItems,
  skipMedia,
  applyTagsToFile,
  removeTagFromFile,
  clearTagsFromFile,
  getState: () => ({ ...state })
};
