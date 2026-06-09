import SettingsModel from "./settings.model.js";
import SettingsView from "./settings.view.js";
import GeminiController from "./gemini/gemini.controller.js";
import EventBus from "../../core/platform/event-bus.js";
import I18n from "../../core/services/i18n.js";
import Toast from "../../core/ui/toast.js";
import ConfirmationDialog from "../../core/ui/confirmation-dialog.js";
import Logger from "../../core/platform/logger.js";
import TaskQueue from "../../core/platform/task-queue.js";
import ThumbnailCache from "../../core/ui/thumbnail-cache.js";
import SubfolderMonitor from "../../core/services/subfolder-monitor.js";
import AppState from "../../core/state/app-state.js";
import ENV from "../../core/platform/env.js";

let isInitialized = false;

const THEMES = ["light", "dark", "system"];

const SETTINGS_KEYS = [
  "animationsEnabled",
  "notifyOrganizationResult",
  "notifyCleanupResult",
  "notifyPendingFiles"
];

function renderAll() {
  const settings = SettingsModel.getSettings();
  SettingsView.render.all(settings, THEMES, SETTINGS_KEYS);
}

const handlers = {
  onThemeClick: e => {
    const theme = e.target.closest("[data-theme]")?.dataset.theme;
    if (!theme) return;
    SettingsModel.setSetting("theme", theme);
  },
  onSwitchChange: e => {
    const switchEl = e.target.closest("[data-setting-key]");
    if (!switchEl) return;
    SettingsModel.toggleSetting(switchEl.dataset.settingKey);
  },
  onLanguageChange: e => {
    const lang = e.target.value;
    if (!lang) return;
    SettingsModel.setSetting("language", lang);
    I18n.setLocale(lang).then(() => {
      SettingsView.update.languageLabel(lang);
      EventBus.emit("dashboard:reload-stats");
      EventBus.emit("appstate:changed", { key: "stats" });
      EventBus.emit("appstate:changed", { key: "folders" });
      EventBus.emit("appstate:changed", { key: "activities" });
    });
  },
  onReset: () => {
    SettingsModel.resetAllSettings();
    Toast.success(I18n.t("settings.reset_success"));
  },
  onDelete: () => {
    ConfirmationDialog.open(
      {
        title: I18n.t("settings.delete_all_title"),
        message: I18n.t("settings.delete_message")
      },
      () => {
        const ok = SettingsModel.deleteAllData();
        ThumbnailCache.clearAll().catch(() => {});
        Toast[ok ? "success" : "error"](
          ok
            ? I18n.t("settings.delete_success")
            : I18n.t("settings.delete_error")
        );
      }
    );
  },
  onDestinationScreenshotsClick: async () => {
    try {
      const result = await TaskQueue.add("select_directory", [], "default");
      const path = result?.path ?? null;
      if (!path) return;
      SettingsModel.setSetting("customDestinationScreenshots", path);
      SettingsView.update.destinationPath("screenshots", path);
      EventBus.emit("dashboard:reload-stats");
      SubfolderMonitor.runScan();
    } catch (error) {
      Logger.error("[Settings] Failed to select screenshots directory:", error);
      Toast.error(I18n.t("settings.destination_error"));
    }
  },
  onDestinationRecordingsClick: async () => {
    try {
      const result = await TaskQueue.add("select_directory", [], "default");
      const path = result?.path ?? null;
      if (!path) return;
      SettingsModel.setSetting("customDestinationRecordings", path);
      SettingsView.update.destinationPath("recordings", path);
      EventBus.emit("dashboard:reload-stats");
      SubfolderMonitor.runScan();
    } catch (error) {
      Logger.error("[Settings] Failed to select recordings directory:", error);
      Toast.error(I18n.t("settings.destination_error"));
    }
  },
  onSourceScreenshotsClick: async () => {
    try {
      const result = await TaskQueue.add("select_directory", [], "default");
      const path = result?.path ?? null;
      if (!path) return;
      ENV.PATHS.SOURCE_SCREENSHOTS = path;
      SettingsView.update.sourcePath("screenshots");
      EventBus.emit("dashboard:reload-stats");
    } catch (error) {
      Logger.error(
        "[Settings] Failed to select source screenshots directory:",
        error
      );
      Toast.error(I18n.t("settings.source_error"));
    }
  },
  onSourceRecordingsClick: async () => {
    try {
      const result = await TaskQueue.add("select_directory", [], "default");
      const path = result?.path ?? null;
      if (!path) return;
      ENV.PATHS.SOURCE_RECORDINGS = path;
      SettingsView.update.sourcePath("recordings");
      EventBus.emit("dashboard:reload-stats");
    } catch (error) {
      Logger.error(
        "[Settings] Failed to select source recordings directory:",
        error
      );
      Toast.error(I18n.t("settings.source_error"));
    }
  },
  onExport: async () => {
    try {
      const backup = SettingsModel.buildBackup();
      const filename = `tagly-backup-${backup.exportedAt}.json`;

      const result = await TaskQueue.add(
        "export_data",
        { filename, data: JSON.stringify(backup) },
        "default"
      );
      if (!result.success) return;

      Toast.success(I18n.t("settings.export_success"));
    } catch (error) {
      Logger.error("[Settings] Export failed:", error);
      Toast.error(I18n.t("settings.export_error"));
    }
  },
  onImport: async () => {
    try {
      const result = await TaskQueue.add("import_data", [], "default");
      const content = result?.content ?? null;
      if (!content) return;

      let backup;
      try {
        backup = typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        Toast.error(I18n.t("settings.import_invalid"));
        return;
      }

      const ok = SettingsModel.restoreBackup(backup);
      if (!ok) {
        Toast.error(I18n.t("settings.import_invalid"));
        return;
      }

      await AppState.flushPersist();
      Toast.success(I18n.t("settings.import_success"));
    } catch (error) {
      Logger.error("[Settings] Import failed:", error);
      Toast.error(I18n.t("settings.import_error"));
    }
  },
  onGeminiConfigClick: () => GeminiController.open(),
  onStateChange: data => {
    if (data?.key === "settings") renderAll();
  }
};

function attachEvents() {
  const {
    tabContent,
    resetBtn,
    deleteBtn,
    languageSelect,
    destinationScreenshotsBtn,
    destinationRecordingsBtn,
    sourceScreenshotsBtn,
    sourceRecordingsBtn,
    geminiConfigBtn,
    exportBtn,
    importBtn
  } = SettingsView.getElements();

  const events = [
    [tabContent, "click", handlers.onThemeClick],
    [tabContent, "change", handlers.onSwitchChange],
    [languageSelect, "change", handlers.onLanguageChange],
    [resetBtn, "click", handlers.onReset],
    [deleteBtn, "click", handlers.onDelete],
    [
      destinationScreenshotsBtn,
      "click",
      handlers.onDestinationScreenshotsClick
    ],
    [destinationRecordingsBtn, "click", handlers.onDestinationRecordingsClick],
    [sourceScreenshotsBtn, "click", handlers.onSourceScreenshotsClick],
    [sourceRecordingsBtn, "click", handlers.onSourceRecordingsClick],
    [geminiConfigBtn, "click", handlers.onGeminiConfigClick],
    [exportBtn, "click", handlers.onExport],
    [importBtn, "click", handlers.onImport]
  ];
  events.forEach(([el, event, handler]) => {
    if (el) el.addEventListener(event, handler);
  });

  EventBus.on("appstate:changed", handlers.onStateChange);
}

function init() {
  if (isInitialized) return;
  SettingsView.init();
  GeminiController.init();
  renderAll();
  attachEvents();
  isInitialized = true;
}

export default {
  init
};
