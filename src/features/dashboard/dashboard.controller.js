import DashboardModel from "./dashboard.model.js";
import DashboardView from "./dashboard.view.js";
import EventBus from "../../core/platform/event-bus.js";
import ENV from "../../core/platform/env.js";
import Logger from "../../core/platform/logger.js";
import Utils from "../../lib/utils.js";
import Navigation from "../../core/ui/navigation.js";


let isInitialized = false;

function updateUI() {
  const data = DashboardModel.getState();
  DashboardView.update.all(data);
}

const debouncedUpdateUI = Utils.debounce(updateUI, 100);

async function loadStats() {
  try {
    const [toOrganize, foldersCreated] = await Promise.all([
      DashboardModel.getToOrganizeFileCounts(),
      DashboardModel.getOrganizedFolderCounts()
    ]);
    DashboardModel.setStats({ toOrganize, foldersCreated });
  } catch (error) {
    Logger.error("Failed to load dashboard stats:", error);
  }
}

const handlers = {
  onStateChange: data => {
    if (["stats", "folders"].includes(data.key)) debouncedUpdateUI();
  },
  onGenerateTagsClick: () => {
    Navigation.navigateTo("organizer");
    EventBus.emit("tagging:open-dialog");
  },
  onTriggersClick: e => {
    const card = e.target.closest("[data-trigger]");
    if (!card) return;
    const triggerName = card.dataset.trigger;
    const isActive = card.classList.contains("active");
    const newState = !isActive;

    ENV.toggleTrigger(triggerName, newState);

    const currentEnabled = DashboardModel.getEnabledTriggers();
    if (newState) {
      currentEnabled.add(triggerName);
    } else {
      currentEnabled.delete(triggerName);
    }
    DashboardView.update.triggers(currentEnabled);
  }
};

function attachEvents() {
  const { triggers, generateTagsBtn } = DashboardView.getElements();

  const events = [
    [triggers.section, "click", handlers.onTriggersClick],
    [generateTagsBtn, "click", handlers.onGenerateTagsClick]
  ];
  events.forEach(([el, event, handler]) => el.addEventListener(event, handler));

  EventBus.on("appstate:changed", handlers.onStateChange);
  EventBus.on("dashboard:reload-stats", loadStats);
}

async function init() {
  if (isInitialized) return;
  DashboardView.init();
  updateUI();
  loadStats();
  attachEvents();
  isInitialized = true;
}

export default {
  init,
  loadStats
};
