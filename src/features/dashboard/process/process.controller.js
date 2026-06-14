import ProcessView from "./process.view.js";
import ProcessModel from "./process.model.js";
import ProcessConfig from "./process.config.js";
import ProcessEngine from "../../../core/services/process-engine.js";
import History from "../../../core/ui/history.js";
import EventBus from "../../../core/platform/event-bus.js";
import Navigation from "../../../core/ui/navigation.js";
import AppState from "../../../core/state/app-state.js";
import TaskQueue from "../../../core/platform/task-queue.js";
import Logger from "../../../core/platform/logger.js";
import Toast from "../../../core/ui/toast.js";
import I18n from "../../../core/services/i18n.js";
import Format from "../../../core/ui/format.js";
import ENV from "../../../core/platform/env.js";
import SubfolderMonitor from "../../../core/services/subfolder-monitor.js";

const state = {
  isRunning: false,
  processType: null
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function notifyChanges(stats) {
  if ((stats.moved ?? 0) > 0 || (stats.total_removed ?? 0) > 0) {
    SubfolderMonitor.runScan();
    EventBus.emit("dashboard:reload-stats");
  }
}

function sendCompletionNotification(processType, stats) {
  const processData = ProcessConfig.PROCESS_TYPES[processType];
  const notifKey = processData?.notificationKey;
  if (!notifKey || !AppState.getSettings()[notifKey]) return;

  const title = I18n.t(processData.notificationTitleKey);
  const content = Format.buildCompletionText(processType, stats);
  ENV.sendNotification(title, content);
}

function activateStep(i, step, steps) {
  ProcessView.update.stepStatus(i, "running");
  ProcessView.update.scrollToStep(i);
  ProcessView.update.stepLabel(I18n.t(step.labelKey));
  ProcessView.update.progress((i / steps.length) * 100);
}

function handleStepRunning(i, step, steps) {
  activateStep(i, step, steps);
}

async function handleStepComplete(i, step, steps) {
  ProcessView.update.stepStatus(i, "completed");

  const hasNext = i < steps.length - 1;
  if (!hasNext || !state.isRunning) return;

  activateStep(i + 1, steps[i + 1], steps);
  await sleep(500);
}

function handleProcessDone(processType, stats) {
  const processData = ProcessConfig.PROCESS_TYPES[processType];
  const doneLabel = I18n.t(processData?.doneLabelKey ?? "process.step_done");

  ProcessView.update.progress(100);
  ProcessView.update.stepLabel(doneLabel);
  ProcessView.update.completion(
    Format.buildCompletionText(processType, stats),
    doneLabel
  );

  state.isRunning = false;
  notifyChanges(stats);
  sendCompletionNotification(processType, stats);
}

function handleProcessError(error, step, index) {
  if (error === "Cancelled") {
    Logger.warn(`Processo '${state.processType}' cancelado pelo usuário.`);
    return;
  }
  Logger.error(`Erro na etapa ${step?.id}:`, error);
  ProcessView.update.stepStatus(index, "failed");
  ProcessView.update.completion(
    I18n.t("process.step_error", { label: I18n.t(step.labelKey) }),
    undefined,
    false
  );
  state.isRunning = false;
}

const EMPTY_MESSAGES = {
  scan_screenshots: "process.empty_screenshots",
  scan_recordings: "process.empty_recordings",
  find_all_expired: "process.empty_expired"
};

function buildCallbacks(processType, steps) {
  return {
    isCancelled: () => !state.isRunning,
    onStepStart: (i, step) => handleStepRunning(i, step, steps),
    onStepComplete: async (i, step) => handleStepComplete(i, step, steps),
    onEmpty: stepId => {
      state.isRunning = false;
      Toast.info(I18n.t(EMPTY_MESSAGES[stepId]));
      close();
    },
    onDone: stats => handleProcessDone(processType, stats),
    onError: (error, step, index) => handleProcessError(error, step, index)
  };
}

function scheduleProcessExecution(processData, processType) {
  const jsExecutor = (funcName, args) => ProcessModel[funcName](...args);
  setTimeout(
    () =>
      ProcessEngine.run(
        processData.steps,
        buildCallbacks(processType, processData.steps),
        { execution: "manual" },
        jsExecutor
      ),
    500
  );
}

function cancelCurrentProcess() {
  if (state.isRunning) {
    Toast.info(I18n.t("process.cancelling"));
    state.isRunning = false;
    TaskQueue.cancelAll();
  }
  ProcessView.reset();
}

function open() {
  const { dialog } = ProcessView.getElements();
  History.pushDialog(dialog, cancelCurrentProcess);
}

function close() {
  History.goBack();
}

async function validateProcess(processType) {
  if (processType !== "cleanup_old_files") return true;
  const hasConfigs = await ProcessModel.hasCleanerConfigs();
  if (!hasConfigs) {
    Toast.info(I18n.t("process.no_cleaner_folders"));
    Navigation.navigateToAndHighlight("cleaner", ".cleaner-folders-grid");
    return false;
  }
  return true;
}

function setupProcessView(processData) {
  ProcessView.reset();
  ProcessView.update.icon(processData.icon, processData.iconClass);
  ProcessView.update.title(I18n.t(processData.titleKey));
  ProcessView.render(processData.steps);
  open();
}

async function start(processType) {
  if (state.isRunning) return;

  const isValid = await validateProcess(processType);
  if (!isValid) return;

  const processData = ProcessConfig.PROCESS_TYPES[processType];
  if (!processData) {
    Logger.error(`Tipo de processo "${processType}" não encontrado.`);
    return;
  }

  state.isRunning = true;
  state.processType = processType;

  setupProcessView(processData);
  scheduleProcessExecution(processData, processType);
}

const handlers = {
  onProcessBtn: e => {
    const processType = e.target.closest("[data-process-type]")?.dataset
      .processType;
    if (processType) start(processType);
  },
  onClose: () => close()
};

function attachEvents() {
  const { closeBtn } = ProcessView.getElements();

  const events = [
    [document, "click", handlers.onProcessBtn],
    [closeBtn, "click", handlers.onClose]
  ];
  events.forEach(([el, event, handler]) => el.addEventListener(event, handler));
}

function init() {
  ProcessView.init();
  attachEvents();
}

export default {
  init
};
