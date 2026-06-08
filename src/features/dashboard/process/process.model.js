import AppState from "../../../core/state/app-state.js";
import TaskQueue from "../../../core/platform/task-queue.js";
import Logger from "../../../core/platform/logger.js";
import Utils from "../../../lib/utils.js";

function buildIdentifierMap(apps) {
  const map = {};
  apps.forEach(app => {
    map[app.pkg] = app.name;
    map[app.name] = app.name;
  });
  return map;
}

async function resolveAppNames(packageNames) {
  const identifierMap = buildIdentifierMap(AppState.getApps());
  const resolvedMap = {};
  for (const identifier of packageNames) {
    const appName = identifierMap[identifier] || identifier;
    resolvedMap[identifier] = Utils.sanitizeFolderName(appName);
  }
  return resolvedMap;
}

function buildEmptyCommands() {
  return {
    countCommand: "echo 0",
    moveCommand: "echo 'No files to move'"
  };
}

function buildMoveEntries(resolvedNames, destPath, extensions) {
  const findPatterns = [];
  const moveStatements = [];
  const extList = Array.isArray(extensions) ? extensions : [extensions];

  for (const [pkgName, appName] of Object.entries(resolvedNames)) {
    const dest = `"${destPath}/${appName.trim()}/"`;

    for (const ext of extList) {
      const safePkg = pkgName.replace(/ /g, "?");
      const exactPattern = `*_${safePkg}.${ext}`;
      const suffixPattern = `*_${safePkg}-*.${ext}`;

      if (findPatterns.length > 0) findPatterns.push(`-o`);
      findPatterns.push(
        `-name '${exactPattern}'`,
        `-o`,
        `-name '${suffixPattern}'`
      );

      moveStatements.push(
        `mv ${exactPattern} ${dest} 2>/dev/null`,
        `mv ${suffixPattern} ${dest} 2>/dev/null`
      );
    }
  }

  return { findPatterns, moveStatements };
}

function buildMoveCommands(resolvedNames, sourcePath, destPath, extension) {
  const { findPatterns, moveStatements } = buildMoveEntries(
    resolvedNames,
    destPath,
    extension
  );

  if (findPatterns.length === 0) return buildEmptyCommands();

  const cdCommand = `cd "${sourcePath}"`;

  return {
    countCommand: `find "${sourcePath}" -maxdepth 1 -type f \\( ${findPatterns.join(
      " "
    )} \\) | wc -l`,
    moveCommand: [cdCommand, ...moveStatements].join(" ; ")
  };
}

async function prepareMediaOrganization(
  resolvedNames,
  sourcePath,
  destPath,
  extension
) {
  return buildMoveCommands(resolvedNames, sourcePath, destPath, extension);
}

function extractFolderCleanerRules(folder) {
  const rules = { screenshots: [], recordings: [] };
  if (folder.ss?.cleaner?.on)
    rules.screenshots.push({
      folder: folder.name,
      days: folder.ss.cleaner.days
    });
  if (folder.sr?.cleaner?.on)
    rules.recordings.push({
      folder: folder.name,
      days: folder.sr.cleaner.days
    });
  return rules;
}

async function loadCleanupRules() {
  const rules = { screenshots: [], recordings: [] };
  AppState.getFolders().forEach(folder => {
    const folderRules = extractFolderCleanerRules(folder);
    rules.screenshots.push(...folderRules.screenshots);
    rules.recordings.push(...folderRules.recordings);
  });
  return rules;
}

async function findExpired(configs, rootDir) {
  const results = await Promise.allSettled(
    configs.map(async config => {
      const folderPath = `${rootDir}/${config.folder}`;
      const expired = await TaskQueue.add(
        "find_expired_files",
        [folderPath, config.days],
        "shell"
      );
      return expired || [];
    })
  );
  return results.flatMap(r =>
    r.status === "fulfilled"
      ? r.value
      : (Logger.error("Failed to list expired files:", r.reason), [])
  );
}

async function findAllExpiredMedia(rules, screenshotsPath, recordingsPath) {
  const [expiredScreenshots, expiredRecordings] = await Promise.all([
    findExpired(rules.screenshots, screenshotsPath),
    findExpired(rules.recordings, recordingsPath)
  ]);
  return {
    screenshots: expiredScreenshots,
    recordings: expiredRecordings,
    all: [...expiredScreenshots, ...expiredRecordings]
  };
}

function getTodayMidnight(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function recordDailyCount(mediaType, count, stats, now) {
  if (count <= 0)
    return stats.dailyOrganized ?? { screenshots: [], recordings: [] };

  const daily = {
    screenshots: [...(stats.dailyOrganized?.screenshots ?? [])],
    recordings: [...(stats.dailyOrganized?.recordings ?? [])]
  };

  const ts = getTodayMidnight(now);
  const entries = daily[mediaType];
  const last = entries[entries.length - 1];

  if (last && last.ts === ts) {
    entries[entries.length - 1] = { ts, count: last.count + count };
  } else {
    entries.push({ ts, count });
  }

  daily[mediaType] = entries.slice(-20);
  return daily;
}

function getOrganizeMediaType(processType) {
  return processType.includes("screenshots") ? "screenshots" : "recordings";
}

function updateOrganizeStats(stats, processType, organizedCount, now) {
  const mediaType = getOrganizeMediaType(processType);
  const dailyOrganized = recordDailyCount(
    mediaType,
    organizedCount,
    stats,
    now
  );
  AppState.setStats({
    organizedFiles: (stats.organizedFiles || 0) + organizedCount,
    lastOrganization: {
      ...stats.lastOrganization,
      [mediaType]: now
    },
    dailyOrganized
  });
}

function updateCleanupStats(stats, cleanedCount, now) {
  AppState.setStats({
    cleanedFiles: (stats.cleanedFiles || 0) + cleanedCount,
    lastClean: {
      screenshots: now,
      recordings: now
    }
  });
}

function updateStats({ processType, organizedCount = 0, cleanedCount = 0 }) {
  const stats = AppState.getStats();
  const now = Date.now();
  if (processType.includes("organize")) {
    updateOrganizeStats(stats, processType, organizedCount, now);
  } else if (processType.includes("cleanup")) {
    updateCleanupStats(stats, cleanedCount, now);
  }
}

async function saveSummary(
  processType,
  stats,
  activityType,
  mediaType,
  execution = "manual"
) {
  updateStats({
    processType,
    organizedCount: stats.moved || 0,
    cleanedCount: stats.total_removed || 0
  });
  AppState.addActivity({
    execution,
    type: activityType,
    count: stats.moved || stats.total_removed || 0,
    ...(mediaType && { mediaType })
  });
  return {
    success: true,
    savedStats: stats
  };
}

async function saveScreenshotSummary(processType, stats, execution) {
  return saveSummary(processType, stats, "organizer", "screenshots", execution);
}

async function saveRecordingSummary(processType, stats, execution) {
  return saveSummary(processType, stats, "organizer", "recordings", execution);
}

async function saveCleanupSummary(processType, stats, execution) {
  return saveSummary(processType, stats, "cleaner", undefined, execution);
}

async function hasCleanerConfigs() {
  return AppState.getFolders().some(
    folder => folder.ss?.cleaner?.on || folder.sr?.cleaner?.on
  );
}

export default {
  resolveAppNames,
  prepareMediaOrganization,
  loadCleanupRules,
  findAllExpiredMedia,
  saveScreenshotSummary,
  saveRecordingSummary,
  saveCleanupSummary,
  hasCleanerConfigs
};
