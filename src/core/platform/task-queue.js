import ENV from "./env.js";
import Utils from "../../lib/utils.js";
import Logger from "./logger.js";

const WORKER_TASK_PRIORITY = 9;
const STOPPER_TASK_PRIORITY = 10;
const TASK_CHECK_INTERVAL = 2000;
const MAX_CHECKS = 180;
const MAX_CONCURRENT_TASKS = 6;

const queue = [];
const pending = {};
let activeTasks = 0;
let taskIdCounter = 0;

function buildShellCommand(task) {
  const scriptPath = `${ENV.WORK_DIR}src/script.sh`;
  const quotedArgs = (Array.isArray(task.params) ? task.params : [])
    .map(Utils.escapeShellArg)
    .join(" ");
  return `sh "${scriptPath}" ${task.action} ${quotedArgs}`;
}

function buildBaseParams(task) {
  return {
    id: task.id,
    action: task.action,
    commandName: task.action,
    params: task.params,
    type: task.type,
    fullCommand: null
  };
}

function buildTaskerParams(task) {
  const base = buildBaseParams(task);

  if (task.type === "shell") {
    base.fullCommand = buildShellCommand(task);
    base.action = "run_shell";
  }

  return base;
}

function createTask(action, params, type, resolve, reject) {
  return {
    id: ++taskIdCounter,
    action,
    params,
    type,
    onSuccess: resolve,
    onError: reject
  };
}

function checkHeartbeat(task, checks, interval) {
  if (!pending[task.id]) {
    clearInterval(interval);
    return;
  }
  if (!ENV.isTaskRunning(ENV.TASKER.TASKS.QUEUE_WORKER)) {
    clearInterval(interval);
    resolveTask(task.id, "error", "Worker task disappeared.");
  } else if (checks >= MAX_CHECKS) {
    clearInterval(interval);
    resolveTask(task.id, "error", "Task timed out.");
  }
}

function startHeartbeatMonitor(task) {
  let checks = 0;
  const interval = setInterval(
    () => checkHeartbeat(task, ++checks, interval),
    TASK_CHECK_INTERVAL
  );
  return interval;
}

function settleTask(task, status, payload) {
  if (status === "success") task.onSuccess(payload);
  else task.onError(payload);
}

function resolveTask(id, status, payload) {
  const task = pending[id];
  if (!task) return;
  clearInterval(task.monitorInterval);
  settleTask(task, status, payload);
  delete pending[id];
  activeTasks--;
  setTimeout(runNext, 0);
}

function dispatchTask(task) {
  task.monitorInterval = startHeartbeatMonitor(task);
  pending[task.id] = task;
  const taskerParams = buildTaskerParams(task);
  ENV.runTask(
    ENV.TASKER.TASKS.QUEUE_WORKER,
    WORKER_TASK_PRIORITY,
    JSON.stringify(taskerParams)
  );
}

function runNext() {
  while (activeTasks < MAX_CONCURRENT_TASKS && queue.length > 0) {
    activeTasks++;
    dispatchTask(queue.shift());
  }
}

function parseResult(resultJson) {
  return typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
}

function handleResultError(error, resultJson) {
  Logger.error("[TaskQueue] Failed to process result:", { error, resultJson });
  activeTasks = Math.max(0, activeTasks - 1);
  setTimeout(runNext, 0);
}

function onResult(resultJson) {
  try {
    const { id, status, payload } = parseResult(resultJson);
    if (!pending[id]) {
      Logger.error(`[TaskQueue] Task ID ${id} not found in pending.`);
      return;
    }
    resolveTask(id, status, payload);
  } catch (error) {
    handleResultError(error, resultJson);
  }
}

function add(action, params = [], type = "default") {
  return new Promise((resolve, reject) => {
    queue.push(createTask(action, params, type, resolve, reject));
    runNext();
  });
}

function stopRunningTasks() {
  ENV.runTask(
    ENV.TASKER.TASKS.ABORT_WORKER,
    STOPPER_TASK_PRIORITY,
    ENV.TASKER.TASKS.QUEUE_WORKER
  );
}

function clearPendingTasks() {
  for (const id of Object.keys(pending)) {
    const task = pending[id];
    clearInterval(task.monitorInterval);
    task.onError("Cancelled");
    delete pending[id];
  }
  activeTasks = 0;
}

function cancelAll() {
  queue.length = 0;
  if (Object.keys(pending).length === 0) return;
  stopRunningTasks();
  clearPendingTasks();
}

export default {
  add,
  onResult,
  cancelAll
};
