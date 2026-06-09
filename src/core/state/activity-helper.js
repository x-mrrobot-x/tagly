import Utils from "../../lib/utils.js";
import I18n from "../services/i18n.js";

const ACTIVITY_CONFIG = {
  cleaner: {
    icon: "broom",
    class: "icon-purple",
    getTitle: () => I18n.t("nav.cleaner"),
    getDescription: data =>
      I18n.t("activity.cleaner_desc", { count: data.count || 0 })
  },

  "cleaner-folder": {
    icon: "folder-minus",
    class: "icon-purple",
    getTitle: () => I18n.t("activity.cleaner_folder_title"),
    getDescription: data => {
      const media =
        data.mediaType === "ss" || data.mediaType === "screenshots"
          ? I18n.t("common.screenshots_label").toLowerCase()
          : I18n.t("common.recordings_label").toLowerCase();
      return I18n.t("activity.cleaner_folder_desc", {
        count: data.count || 0,
        media,
        folder: data.folder
      });
    }
  },

  organizer: {
    icon: "folder-open",
    class: "icon-green",
    getTitle: data => {
      const label =
        data.mediaType === "screenshots"
          ? I18n.t("common.screenshots_short")
          : data.mediaType === "recordings"
          ? I18n.t("common.recordings_short")
          : I18n.t("common.files_plural");
      return I18n.t("activity.organizer_title", {
        label: Utils.capitalizeFirstLetter(label)
      });
    },
    getDescription: data => {
      const media =
        data.mediaType === "screenshots"
          ? I18n.t("common.screenshots_label")
          : I18n.t("common.recordings_label");
      return I18n.t("activity.organizer_desc", {
        count: data.count || 0,
        media
      });
    }
  },

  "trigger-toggle": {
    icon: "clock",
    class: "icon-blue",
    getTitle: data => data.trigger,
    getDescription: data =>
      data.enabled
        ? I18n.t("activity.trigger_toggle_on")
        : I18n.t("activity.trigger_toggle_off"),
    getIcon: data => (data.enabled ? "toggle-right" : "toggle-left"),
    getClass: data => (data.enabled ? "icon-blue" : "icon-gray")
  },

  "cleaner-folder-toggle": {
    icon: "toggle-right",
    class: "icon-blue",
    getTitle: () => I18n.t("activity.cleaner_folder_title"),
    getDescription: data => {
      const media = data.feature.includes("screenshots")
        ? I18n.t("common.screenshots_label").toLowerCase()
        : I18n.t("common.recordings_label").toLowerCase();
      const state = data.enabled
        ? I18n.t("activity.toggle_activated")
        : I18n.t("activity.toggle_deactivated");
      return I18n.t("activity.folder_toggle_desc", {
        media,
        folder: data.folder,
        state
      });
    },
    getIcon: data => (data.enabled ? "toggle-right" : "toggle-left"),
    getClass: data => (data.enabled ? "icon-blue" : "icon-gray")
  }
};

const OVERRIDDEN_KEYS = new Set([
  "id",
  "type",
  "title",
  "description",
  "timestamp",
  "icon",
  "class"
]);

function enrichActivity(activity) {
  const config = ACTIVITY_CONFIG[activity.type];
  if (!config) return activity;

  const extra = {};
  for (const [key, value] of Object.entries(activity)) {
    if (!OVERRIDDEN_KEYS.has(key)) extra[key] = value;
  }

  return {
    id: activity.id,
    type: activity.type,
    timestamp: activity.timestamp,
    title: config.getTitle(activity),
    description: config.getDescription(activity),
    icon: config.getIcon ? config.getIcon(activity) : config.icon,
    class: config.getClass ? config.getClass(activity) : config.class,
    ...extra
  };
}

function enrichActivities(activities) {
  return activities.map(enrichActivity);
}

export default {
  enrichActivities
};
