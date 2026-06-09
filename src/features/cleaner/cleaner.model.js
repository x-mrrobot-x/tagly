import AppState from "../../core/state/app-state.js";

function updateFolderState(folderId, mediaType, updateFn) {
  const folders = AppState.getFolders();
  const updatedFolders = folders.map(folder => {
    if (folder.id === folderId) {
      const newState = { ...folder };
      updateFn(newState);
      return newState;
    }
    return folder;
  });
  AppState.setFolders(updatedFolders);
  return updatedFolders;
}

function toggleFolderClean(folderId, mediaType) {
  const updatedFolders = updateFolderState(folderId, mediaType, folder => {
    const key = mediaType === "screenshots" ? "ss" : "sr";
    if (folder[key]?.cleaner) folder[key].cleaner.on = !folder[key].cleaner.on;
  });

  const folder = updatedFolders.find(f => f.id === folderId);
  if (folder) {
    const actionType =
      mediaType === "screenshots" ? "screenshots" : "recordings";
    const key = mediaType === "screenshots" ? "ss" : "sr";
    if (folder[key]?.cleaner) {
      AppState.addActivity({
        type: "cleaner-folder-toggle",
        feature: `cleaner-folder-${actionType}`,
        folder: folder.name,
        enabled: folder[key].cleaner.on
      });
    }
  }
}

function setFolderDays(folderId, mediaType, days) {
  updateFolderState(folderId, mediaType, folder => {
    const key = mediaType === "screenshots" ? "ss" : "sr";
    if (folder[key]?.cleaner) folder[key].cleaner.days = days;
  });
}

function getFolders() {
  return AppState.getFolders();
}

export default {
  toggleFolderClean,
  setFolderDays,
  getFolders
};
