import AppState from "../../core/state/app-state.js";
import TaskQueue from "../../core/platform/task-queue.js";
import Logger from "../../core/platform/logger.js";
import ENV from "../../core/platform/env.js";

function getTopOrganizerApp() {
  const folders = AppState.getFolders();
  if (!folders || folders.length === 0) return null;
  const topApp = folders.reduce((best, folder) => {
    const count = (folder.ss?.count || 0) + (folder.sr?.count || 0);
    return count > (best?.count || 0) ? { ...folder, count } : best;
  }, null);
  if (!topApp || topApp.count <= 0) return null;
  return {
    name: topApp.name,
    count: topApp.count,
    pkg: topApp.pkg
  };
}

async function fetchParallelCounts(screenshotsTask, recordingsTask, errorMsg) {
  try {
    const [screenshotsResult, recordingsResult] = await Promise.all([
      screenshotsTask,
      recordingsTask
    ]);
    return {
      screenshots: Number(screenshotsResult) || 0,
      recordings: Number(recordingsResult) || 0
    };
  } catch (error) {
    Logger.error(errorMsg, error);
    return { screenshots: 0, recordings: 0 };
  }
}

async function getToOrganizeFileCounts() {
  return fetchParallelCounts(
    TaskQueue.add(
      "count_media_items",
      [ENV.PATHS.SOURCE_SCREENSHOTS],
      "shell"
    ),
    TaskQueue.add(
      "count_media_items",
      [ENV.PATHS.SOURCE_RECORDINGS],
      "shell"
    ),
    "Failed to update pending files count:"
  );
}

async function getOrganizedFolderCounts() {
  return fetchParallelCounts(
    TaskQueue.add(
      "count_subfolders",
      [ENV.PATHS.ORGANIZED_SCREENSHOTS],
      "shell"
    ),
    TaskQueue.add(
      "count_subfolders",
      [ENV.PATHS.ORGANIZED_RECORDINGS],
      "shell"
    ),
    "Failed to update folders created count:"
  );
}

function resolveTopApp() {
  return (
    getTopOrganizerApp() ?? {
      name: null,
      count: 0,
      pkg: "default.png"
    }
  );
}

function getEnabledTriggers() {
  const raw = ENV.getVariable("PENABLED");
  if (!raw || typeof raw !== "string") return new Set();
  const matches = [...raw.matchAll(/(?:^|,)(TG[^,]+)/g)].map(m => m[1].trim());
  return new Set(matches);
}

function setStats(stats) {
  AppState.setStats(stats);
}

function getState() {
  const stats = AppState.getStats();
  return {
    organizedFiles: stats.organizedFiles || 0,
    removedFiles: stats.cleanedFiles || 0,
    toOrganize: stats.toOrganize || {
      screenshots: 0,
      recordings: 0
    },
    foldersCreated: stats.foldersCreated || {
      screenshots: 0,
      recordings: 0
    },
    lastOrganization: stats.lastOrganization || {
      screenshots: null,
      recordings: null
    },
    lastClean: stats.lastClean || {
      screenshots: null,
      recordings: null
    },
    mostCapturedApp: resolveTopApp(),
    triggers: getEnabledTriggers()
  };
}

export default {
  getState,
  getEnabledTriggers,
  getToOrganizeFileCounts,
  getOrganizedFolderCounts,
  setStats
};
