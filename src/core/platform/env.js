import Defaults from "../../lib/defaults.js";
import Utils from "../../lib/utils.js";
import Logger from "./logger.js";

const { DEFAULT_SETTINGS, DEFAULT_STATS } = Defaults;

const TASKER = {
  MAIN_SCENE: "TG - MAIN SCENE",
  TASKS: {
    QUEUE_WORKER: "TG 06 - RUN QUEUE WORKER",
    ABORT_WORKER: "TG 07 - ABORT QUEUE WORKER",
    NOTIFY: "TG 08 - NOTIFY"
  }
};

const PATHS = {
  get SOURCE_SCREENSHOTS() {
    return (
      (getVariableFn && getVariableFn("screenshots_path")) ||
      "/storage/emulated/0/DCIM/Screenshots"
    );
  },
  set SOURCE_SCREENSHOTS(value) {
    setVariableFn && setVariableFn("screenshots_path", value);
  },
  get SOURCE_RECORDINGS() {
    return (
      (getVariableFn && getVariableFn("recordings_path")) ||
      "/storage/emulated/0/DCIM/ScreenRecorder"
    );
  },
  set SOURCE_RECORDINGS(value) {
    setVariableFn && setVariableFn("recordings_path", value);
  },
  get ORGANIZED_SCREENSHOTS() {
    return resolveDestination("screenshots");
  },
  get ORGANIZED_RECORDINGS() {
    return resolveDestination("recordings");
  }
};

const STORAGE = {
  FOLDERS: {
    web: {
      type: "localStorage",
      key: "folders",
      default: []
    },
    tasker: {
      type: "file",
      path: "src/data/folders.json",
      default: []
    }
  },
  SETTINGS: {
    web: {
      type: "localStorage",
      key: "settings",
      default: DEFAULT_SETTINGS
    },
    tasker: {
      type: "file",
      path: "src/data/settings.json",
      default: DEFAULT_SETTINGS
    }
  },
  STATS: {
    web: {
      type: "localStorage",
      key: "stats",
      default: DEFAULT_STATS
    },
    tasker: {
      type: "file",
      path: "src/data/stats.json",
      default: DEFAULT_STATS
    }
  },
  ACTIVITIES: {
    web: {
      type: "localStorage",
      key: "activities",
      default: []
    },
    tasker: {
      type: "file",
      path: "src/data/activities.json",
      default: []
    }
  },
  TRANSLATIONS: {
    web: {
      type: "fetch",
      path: "src/i18n/{lang}.json",
      default: {}
    },
    tasker: {
      type: "file",
      path: "src/i18n/{lang}.json",
      default: {}
    }
  },
  APPS: {
    web: {
      type: "localStorage",
      key: "apps",
      default: []
    },
    tasker: {
      type: "file",
      path: "src/data/apps.json",
      default: []
    }
  }
};

const isWeb = typeof tk === "undefined";
const USE_MOCK = import.meta.env.DEV || import.meta.env.MODE === "pages";
let settingsGetter = null;
let getVariableFn = null;
let setVariableFn = null;

function setSettingsGetter(fn) {
  settingsGetter = fn;
}

function resolveDestination(type) {
  const settingKey =
    type === "screenshots"
      ? "customDestinationScreenshots"
      : "customDestinationRecordings";
  const custom = settingsGetter ? settingsGetter(settingKey) : null;
  if (custom) return `${custom}/Tagly`;
  const sourceBase =
    type === "screenshots" ? PATHS.SOURCE_SCREENSHOTS : PATHS.SOURCE_RECORDINGS;
  return `${sourceBase}/Tagly`;
}

function resolvePath(path, params = {}) {
  return path.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? _);
}

function getDefault(key) {
  const cfg = STORAGE[key];
  if (!cfg) return null;
  const envCfg = isWeb ? cfg.web : cfg.tasker;
  return JSON.parse(JSON.stringify(envCfg.default));
}

function WebEnvironment() {
  if (USE_MOCK) {
    import("../../data/mock-env.js").then(m => m.default.init());
  }

  const PREFIX = "@tagly:";
  let taskResultHandler = null;

  function setTaskResultHandler(fn) {
    taskResultHandler = fn;
  }

  function resolveIconPath(pkg) {
    return `src/assets/icons/${pkg}.png`;
  }

  function getFilePath() {
    return "";
  }

  function readFromLocalStorage(cfg, key) {
    const raw = localStorage.getItem(PREFIX + cfg.key);
    return raw ? JSON.parse(raw) : getDefault(key);
  }

  async function readFromFetch(cfg, params) {
    const path = resolvePath(cfg.path, params);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.json();
  }

  function getVariable(name) {
    const key = name.toUpperCase();
    const cfg = STORAGE[key]?.web;
    if (cfg?.type === "localStorage") return readFromLocalStorage(cfg, key);
    return null;
  }

  getVariableFn = getVariable;

  function setVariable(name, value) {
    Logger.debug(`[WEB ENV] setVariable("${name}", "${value}")`);
  }

  setVariableFn = setVariable;

  async function readFile(key, params = {}) {
    try {
      const cfg = STORAGE[key].web;
      if (cfg.type === "localStorage") return readFromLocalStorage(cfg, key);
      if (cfg.type === "fetch") return await readFromFetch(cfg, params);
    } catch (e) {
      Logger.error(`Error getting ${key}:`, e);
      return getDefault(key);
    }
  }

  async function writeFile(key, data) {
    try {
      const cfg = STORAGE[key].web;
      if (cfg.type === "fetch")
        throw new Error(`Cannot write to ${key} (fetch type)`);
      localStorage.setItem(PREFIX + cfg.key, JSON.stringify(data));
      return true;
    } catch (e) {
      Logger.error(`Error saving ${key}:`, e);
      return false;
    }
  }

  function notifyTaskResult(id, status, payload) {
    if (taskResultHandler) {
      taskResultHandler(JSON.stringify({ id, status, payload }));
    }
  }

  async function processMockTask(id, realCommand, taskParams, type) {
    if (!USE_MOCK) return;
    try {
      const { default: MockEnv } = await import("../../data/mock-env.js");
      const payload = await MockEnv.processTask(realCommand, taskParams, type);
      notifyTaskResult(id, "success", payload);
    } catch (error) {
      Logger.error(`[WEB ENV] Error processing task "${realCommand}":`, error);
      notifyTaskResult(id, "error", String(error));
    }
  }

  function parseTaskParams(params) {
    const {
      id,
      commandName,
      action,
      params: taskParams,
      type
    } = JSON.parse(params[0]);
    return { id, realCommand: commandName || action, taskParams, type };
  }

  function runTask(taskName, priority, ...params) {
    if (taskName !== TASKER.TASKS.QUEUE_WORKER) return;
    try {
      const { id, realCommand, taskParams, type } = parseTaskParams(params);
      processMockTask(id, realCommand, taskParams, type);
    } catch (e) {
      Logger.error("[WEB ENV] Failed to parse taskerParams:", e);
    }
  }

  function isTaskRunning() {
    return true;
  }

  function getSystemLanguage() {
    return (navigator.language || navigator.userLanguage || "en").split("-")[0];
  }

  function exit() {
    Logger.debug("Closing the application...");
  }

  function toggleTrigger(name, enabled) {
    Logger.debug(`[WEB ENV] toggleTrigger("${name}", ${enabled})`);
  }

  function sendNotification(title, content) {
    console.log("[NOTIFY]", title, "→", content);
  }

  return {
    isWeb: true,
    WORK_DIR: "",
    TASKER,
    PATHS,
    getDefault,
    getSystemLanguage,
    resolveIconPath,
    getFilePath,
    getVariable,
    toggleTrigger,
    readFile,
    writeFile,
    runTask,
    isTaskRunning,
    sendNotification,
    setTaskResultHandler,
    setSettingsGetter,
    exit
  };
}

function TaskerEnvironment() {
  const WORK_DIR = `${tk.local("%tg_work_dir")}/`;

  function resolveIconPath(pkg) {
    return `content://net.dinglisch.android.taskerm.iconprovider//app/${pkg}`;
  }

  function getFilePath(key, params = {}) {
    const cfg = STORAGE[key].tasker;
    const relative = cfg.path ? resolvePath(cfg.path, params) : cfg.path;
    return `${WORK_DIR}${relative}`;
  }

  function buildShellCommand(command, args) {
    const scriptPath = `${WORK_DIR}src/script.sh`;
    const quotedArgs = args.map(Utils.escapeShellArg).join(" ");
    return `sh "${scriptPath}" ${command} ${quotedArgs}`;
  }

  function parseShellResult(result, command) {
    if (!result?.trim()) throw new Error("Shell returned empty result.");
    const parsed = JSON.parse(result);
    if (parsed.success) return parsed.data;
    throw new Error(parsed.error || "Unknown shell error.");
  }

  function runShell(command, args) {
    const cmd = buildShellCommand(command, args);
    const result = tk.shell(cmd, false, 5000);
    return parseShellResult(result, command);
  }

  async function execute({ command, args = [] }) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try {
          resolve(runShell(command, args));
        } catch (e) {
          Logger.error(`Error executing '${command}':`, e);
          reject(new Error(`Failed to execute '${command}': ${e.message}`));
        }
      }, 0);
    });
  }

  function getVariable(name) {
    const isGlobal = /[A-Z]/.test(name);
    const raw = isGlobal ? tk.global(name) : tk.local(name);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    const key = name.toUpperCase();
    return STORAGE[key] ? getDefault(key) : null;
  }

  getVariableFn = getVariable;

  function setVariable(name, value) {
    const isGlobal = /[A-Z]/.test(name);
    if (isGlobal) {
      tk.setGlobal(name, String(value));
    } else {
      tk.setLocal(name, String(value));
    }
  }

  setVariableFn = setVariable;

  async function readFile(key, params = {}) {
    try {
      const result = await execute({
        command: "read_file",
        args: [getFilePath(key, params)]
      });
      return result ?? getDefault(key);
    } catch (e) {
      Logger.error(`Error reading file ${key}:`, e);
      return getDefault(key);
    }
  }

  async function writeFile(key, data, params = {}) {
    try {
      await execute({
        command: "write_file",
        args: [getFilePath(key, params), JSON.stringify(data)]
      });
      return true;
    } catch (e) {
      Logger.error(`Error saving ${key}:`, e);
      return false;
    }
  }

  function runTask(taskName, priority, ...params) {
    return new Promise(function (resolve, reject) {
      try {
        tk.performTask(
          taskName,
          priority,
          params[0] || "",
          params[1] || "",
          "",
          true,
          true,
          "",
          true
        );
        resolve();
      } catch (e) {
        Logger.error(`Error running task '${taskName}':`, e);
        reject(new Error(`Failed: '${taskName}': ${e.message}`));
      }
    });
  }

  function isTaskRunning(taskName) {
    return tk.taskRunning(taskName);
  }

  function getSystemLanguage() {
    return (tk.local("system_language") || "en").split("-")[0];
  }

  function exit() {
    tk.destroyScene(TASKER.MAIN_SCENE);
  }

  function sendNotification(title, content) {
    runTask(TASKER.TASKS.NOTIFY, 10, title, content);
  }

  function setTaskResultHandler() {}

  function toggleTrigger(name, enabled) {
    tk.enableProfile(name, enabled);
  }

  return {
    isWeb: false,
    WORK_DIR,
    TASKER,
    PATHS,
    getDefault,
    getSystemLanguage,
    resolveIconPath,
    getFilePath,
    getVariable,
    toggleTrigger,
    readFile,
    writeFile,
    execute,
    runTask,
    isTaskRunning,
    sendNotification,
    setTaskResultHandler,
    setSettingsGetter,
    exit
  };
}

export default isWeb ? WebEnvironment() : TaskerEnvironment();
