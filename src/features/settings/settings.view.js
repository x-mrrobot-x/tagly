import DOM from "../../lib/dom.js";
import I18n from "../../core/services/i18n.js";
import ENV from "../../core/platform/env.js";

let elements = null;

function queryElements() {
  elements = {
    tabContent: DOM.qs("#tab-settings"),
    themeBtns: DOM.qsa(".settings-theme-button"),
    resetBtn: DOM.qs("#reset-settings-btn"),
    deleteBtn: DOM.qs("#delete-all-btn"),
    languageSelect: DOM.qs("#language-select"),
    languageLabel: DOM.qs("#current-language-label"),
    destinationScreenshotsBtn: DOM.qs("#setting-destination-screenshots"),
    destinationScreenshotsPathEl: DOM.qs("#destination-screenshots-path"),
    destinationRecordingsBtn: DOM.qs("#setting-destination-recordings"),
    destinationRecordingsPathEl: DOM.qs("#destination-recordings-path"),
    geminiConfigBtn: DOM.qs("#setting-gemini-config"),
    exportBtn: DOM.qs("#setting-export-data"),
    importBtn: DOM.qs("#setting-import-data")
  };
}

function getElements() {
  return elements;
}

const render = {
  theme: (theme, themes) => {
    const root = document.documentElement;
    root.classList.remove(...themes);
    const themeToApply =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    root.classList.add(themeToApply);
  },

  all: (settings, themes, settingsKeys) => {
    settingsKeys.forEach(key => update.setting(key, settings[key]));
    render.theme(settings.theme, themes);
    update.themeSelector(settings.theme);
    update.languageLabel(settings.language || "en");
    update.destinationPath(
      "screenshots",
      settings.customDestinationScreenshots
    );
    update.destinationPath("recordings", settings.customDestinationRecordings);
  }
};

const update = {
  themeSelector: theme => {
    elements.themeBtns.forEach(btn => btn.classList.remove("active"));
    DOM.qs(`#theme-${theme}`)?.classList.add("active");
  },
  languageLabel: lang => {
    const label = I18n.t(`languages.${lang}`);
    if (elements.languageLabel) elements.languageLabel.textContent = label;
    if (elements.languageSelect) elements.languageSelect.value = lang;
  },
  destinationPath: (type, path) => {
    const el =
      type === "screenshots"
        ? elements.destinationScreenshotsPathEl
        : elements.destinationRecordingsPathEl;
    if (!el) return;
    el.removeAttribute("data-i18n");
    el.textContent = path
      ? `${path}/Tagly`
      : type === "screenshots"
      ? `${ENV.PATHS.SOURCE_SCREENSHOTS}/Tagly`
      : `${ENV.PATHS.SOURCE_RECORDINGS}/Tagly`;
  },
  setting: (key, value) => {
    const switchEl = DOM.qs(
      `#switch-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`
    );
    if (switchEl) switchEl.checked = !!value;
    if (key === "animationsEnabled")
      document.documentElement.classList.toggle("no-animations", !value);
  }
};

function init() {
  queryElements();
}

export default {
  init,
  getElements,
  render,
  update
};
