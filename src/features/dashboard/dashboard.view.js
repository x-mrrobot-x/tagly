import DOM from "../../lib/dom.js";
import Icons from "../../core/ui/icons.js";
import I18n from "../../core/services/i18n.js";
import ENV from "../../core/platform/env.js";
import Format from "../../core/ui/format.js";

let elements = null;

function queryElements() {
  elements = {
    tabContent: DOM.qs("#tab-dashboard"),
    summary: {
      organized: DOM.qs("#dashboard-summary-organized-files"),
      removed: DOM.qs("#dashboard-summary-removed-files")
    },
    toOrganize: {
      screenshots: DOM.qs("#to-organize-screenshots"),
      recordings: DOM.qs("#to-organize-recordings")
    },
    foldersCreated: {
      screenshots: DOM.qs("#folders-created-screenshots"),
      recordings: DOM.qs("#folders-created-recordings")
    },
    lastOrg: {
      screenshots: DOM.qs("#last-organization-screenshots"),
      recordings: DOM.qs("#last-organization-recordings")
    },
    lastClean: {
      screenshots: DOM.qs("#last-cleanup-screenshots"),
      recordings: DOM.qs("#last-cleanup-recordings")
    },
    topApp: {
      icon: DOM.qs("#top-app-icon"),
      name: DOM.qs("#top-app-name"),
      count: DOM.qs("#top-app-count")
    },
    triggers: {
      section: DOM.qs("#triggers")
    },
    generateTagsBtn: DOM.qs("#dashboard-action-generate-tags")
  };
}

function getElements() {
  return elements;
}

function animateValue(element, newValue) {
  if (!element) return;
  const newText = String(newValue);
  if (element.textContent === newText) return;
  element.textContent = newText;

  const pulse = () => {
    element.classList.remove("animate-pulse-highlight");
    void element.offsetWidth;
    element.classList.add("animate-pulse-highlight");
    element.addEventListener("animationend", function onEnd() {
      element.classList.remove("animate-pulse-highlight");
      element.removeEventListener("animationend", onEnd);
    });
  };

  const entranceParent = element.closest(
    ".animate-fade-in-up, .animate-fade-in, .animate-scale-in"
  );
  if (entranceParent?.getAnimations) {
    const animations = entranceParent.getAnimations();
    if (animations.length > 0) {
      Promise.all(animations.map(a => a.finished)).then(pulse);
      return;
    }
  }
  pulse();
}

const update = {
  summary: (organizedFiles, removedFiles) => {
    animateValue(elements.summary.organized, organizedFiles.toLocaleString());
    animateValue(elements.summary.removed, removedFiles.toLocaleString());
  },
  toOrganize: (screenshots, recordings) => {
    animateValue(elements.toOrganize.screenshots, screenshots ?? 0);
    animateValue(elements.toOrganize.recordings, recordings ?? 0);
  },
  foldersCreated: (screenshots, recordings) => {
    animateValue(elements.foldersCreated.screenshots, screenshots ?? 0);
    animateValue(elements.foldersCreated.recordings, recordings ?? 0);
  },
  lastOrganization: (screenshots, recordings) => {
    animateValue(
      elements.lastOrg.screenshots,
      Format.formatTimestamp(screenshots)
    );
    animateValue(
      elements.lastOrg.recordings,
      Format.formatTimestamp(recordings)
    );
  },
  lastClean: (screenshots, recordings) => {
    animateValue(
      elements.lastClean.screenshots,
      Format.formatTimestamp(screenshots)
    );
    animateValue(
      elements.lastClean.recordings,
      Format.formatTimestamp(recordings)
    );
  },
  mostCapturedApp: app => {
    const displayName = app.name || I18n.t("common.none");
    if (elements.topApp.name.textContent !== displayName)
      elements.topApp.name.textContent = displayName;
    animateValue(elements.topApp.count, app.count.toLocaleString());
    const newIconSrc = ENV.resolveIconPath(app.pkg);
    if (elements.topApp.icon.getAttribute("src") !== newIconSrc)
      elements.topApp.icon.src = newIconSrc;
  },
  triggers: enabledSet => {
    const cards = DOM.qsa("[data-trigger]", elements.triggers.section);
    cards.forEach(card => {
      const isActive = enabledSet.has(card.dataset.trigger);
      const badge = card.querySelector(".dashboard-trigger-badge");
      card.classList.toggle("active", isActive);
      badge.textContent = isActive
        ? I18n.t("dashboard.status_active")
        : I18n.t("dashboard.status_inactive");
    });
  },
  all: data => {
    if (!data) return;
    update.summary(data.organizedFiles, data.removedFiles);
    update.toOrganize(
      data.toOrganize?.screenshots,
      data.toOrganize?.recordings
    );
    update.foldersCreated(
      data.foldersCreated?.screenshots,
      data.foldersCreated?.recordings
    );
    update.lastOrganization(
      data.lastOrganization.screenshots,
      data.lastOrganization.recordings
    );
    update.lastClean(data.lastClean.screenshots, data.lastClean.recordings);
    update.mostCapturedApp(data.mostCapturedApp);
    if (data.triggers) update.triggers(data.triggers);
  }
};

function init() {
  queryElements();
}

export default {
  init,
  getElements,
  update
};
