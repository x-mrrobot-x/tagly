import ENV from "../src/core/platform/env.js";
import AppState from "../src/core/state/app-state.js";
import I18n from "../src/core/services/i18n.js";
import TaskQueue from "../src/core/platform/task-queue.js";
import ProcessConfig from "../src/features/dashboard/process/process.config.js";
import ProcessEngine from "../src/core/services/process-engine.js";
import ProcessModel from "../src/features/dashboard/process/process.model.js";
import Logger from "../src/core/platform/logger.js";
import Format from "../src/core/ui/format.js";

// ─── Engine Helpers ───

function buildCallbacks(processType) {
  return {
    onError: (error, step) => {
      Logger.error(
        "[Runner] Error in step:",
        step?.id,
        error?.message ?? String(error)
      );
      TaskQueue.cancelAll();
    }
  };
}

function buildJsExecutor() {
  return (funcName, args) => ProcessModel[funcName](...args);
}

// ─── Process Execution ───

function getProcessData(processType) {
  const processData = ProcessConfig.PROCESS_TYPES[processType];
  if (!processData) {
    Logger.error(`[Runner] Unknown process type: "${processType}"`);
    return null;
  }
  return processData;
}

async function executeProcess(processData, processType) {
  let stats = null;
  await ProcessEngine.run(
    processData.steps,
    {
      ...buildCallbacks(processType),
      onDone: async s => {
        stats = s;
      }
    },
    { execution: "automatic" },
    buildJsExecutor()
  );
  return stats;
}

async function runProcess(processType) {
  const processData = getProcessData(processType);
  if (!processData) return null;

  const stats = await executeProcess(processData, processType);
  await AppState.flushPersist();
  return stats;
}

// ─── Notifications ───

function sendOrganizerNotification(ssStats, srStats) {
  if (!AppState.getSetting("notifyOrganizationResult")) return;
  if ((ssStats?.moved || 0) + (srStats?.moved || 0) < 1) return;

  ENV.sendNotification(
    I18n.t("nav.organizer"),
    Format.buildOrganizerNotification(ssStats, srStats)
  );
}

function sendCleanerNotification(stats) {
  if (!AppState.getSetting("notifyCleanupResult")) return;
  if ((stats?.total_removed || 0) < 1) return;

  ENV.sendNotification(
    I18n.t("nav.cleaner"),
    Format.buildCompletionText("cleanup_old_files", stats)
  );
}

// ─── Feature Runners ───

async function runOrganizerProcesses() {
  const ssStats = await runProcess("organize_screenshots");
  const srStats = await runProcess("organize_recordings");
  sendOrganizerNotification(ssStats, srStats);
}

async function runCleanerProcess() {
  const canProceed = await ProcessModel.hasCleanerConfigs();
  if (!canProceed) return;

  const stats = await runProcess("cleanup_old_files");
  sendCleanerNotification(stats);
}

// ─── Bootstrap ───

async function initServices() {
  AppState.init();
  ENV.setSettingsGetter(key => AppState.getSetting(key));
  await I18n.init();
}

async function runAllProcesses() {
  await runOrganizerProcesses();
  await runCleanerProcess();
}

async function run() {
  try {
    await initServices();
    await runAllProcesses();
  } catch (err) {
    Logger.error("[Runner] Critical error:", String(err));
  } finally {
    ENV.exit();
  }
}

function setupGlobalHandlers() {
  window.App = {
    handleTaskResult: json => TaskQueue.onResult(json)
  };
}

function init() {
  setupGlobalHandlers();
  run();
}

init();
