import DOM from "../../../lib/dom.js";
import I18n from "../../../core/services/i18n.js";

let elements = null;

function queryElements() {
  elements = {
    taggingDialog: DOM.qs("#dialog-tagging"),
    taggingClose: DOM.qs("#dialog-tagging-close"),
    taggingLoader: DOM.qs("#tagging-loader"),
    taggingBtnSkip: DOM.qs("#tagging-btn-skip"),
    taggingBtnGenerate: DOM.qs("#tagging-btn-generate"),
    taggingBtnSkipAll: DOM.qs("#tagging-btn-skip-all"),
    taggingBtnGenerateAll: DOM.qs("#tagging-btn-generate-all"),
    taggingBatchActions: DOM.qs("#tagging-batch-actions"),
    taggingBatchProgress: DOM.qs("#tagging-batch-progress"),
    taggingBatchLabel: DOM.qs("#tagging-batch-label"),
    taggingBtnStop: DOM.qs("#tagging-btn-stop"),
    taggingPreview: DOM.qs("#tagging-preview"),
    taggingFilename: DOM.qs("#tagging-filename"),
    taggingCardArea: DOM.qs("#tagging-card-area"),
    taggingEmpty: DOM.qs("#tagging-empty"),
    taggingMainActions: DOM.qs("#tagging-main-actions"),
    taggingStatPending: DOM.qs("#tagging-stat-pending"),
    taggingStatTagged: DOM.qs("#tagging-stat-tagged"),
    taggingStatSkipped: DOM.qs("#tagging-stat-skipped")
  };
}

function getElements() {
  return elements;
}

function buildBatchLabel(done, total) {
  return I18n.t("tagging.batch_progress")
    .replace("{done}", done)
    .replace("{total}", total);
}

const render = {
  preview(file, videoToThumbnailUrl, isVideoFile) {
    if (isVideoFile(file.path) && typeof videoToThumbnailUrl === "function") {
      elements.taggingPreview.style.visibility = "hidden";
      videoToThumbnailUrl(file.path)
        .then(result => {
          if (elements.taggingFilename.textContent === file.name) {
            elements.taggingPreview.src = result.dataUrl;
            elements.taggingPreview.style.visibility = "";
          }
        })
        .catch(() => {
          elements.taggingPreview.style.visibility = "";
        });
    } else {
      elements.taggingPreview.style.visibility = "";
      elements.taggingPreview.src = file.path;
    }
  },

  emptyState(isProcessing) {
    elements.taggingCardArea.style.display = "none";
    elements.taggingMainActions.style.display = "none";
    elements.taggingEmpty.style.display = "block";
    elements.taggingBatchActions.style.display = "none";
    elements.taggingEmpty.textContent = isProcessing
      ? I18n.t("tagging.processing_remaining")
      : I18n.t("tagging.all_done");
  },

  cardArea() {
    elements.taggingEmpty.style.display = "none";
    elements.taggingCardArea.style.display = "";
    elements.taggingMainActions.style.display = "";
    elements.taggingBatchActions.style.display = "";
  },

  cardEntrance(direction) {
    if (!direction) return;
    const enterClass =
      direction === "left" ? "tagging-enter-left" : "tagging-enter-right";
    elements.taggingCardArea.classList.remove(
      "tagging-enter-left",
      "tagging-enter-right"
    );
    void elements.taggingCardArea.offsetWidth;
    elements.taggingCardArea.classList.add(enterClass);
  }
};

const update = {
  taggingBatchMode(active, done = 0, total = 0) {
    const show = !active;
    elements.taggingMainActions.style.display = show ? "" : "none";
    elements.taggingBtnSkipAll.style.display = show ? "" : "none";
    elements.taggingBtnGenerateAll.style.display = show ? "" : "none";
    elements.taggingBtnStop.style.display = active ? "" : "none";
    elements.taggingBatchProgress.style.display = active ? "flex" : "none";
    elements.taggingBatchLabel.textContent = active
      ? buildBatchLabel(done, total)
      : "";
  },

  taggingBatchCard(file, videoToThumbnailUrl, isVideoFile) {
    if (!file) return;
    elements.taggingFilename.textContent = file.name;
    render.preview(file, videoToThumbnailUrl, isVideoFile);
  },

  taggingBatchLabel(done, total) {
    elements.taggingBatchLabel.textContent = buildBatchLabel(done, total);
  },

  taggingLoader(show) {
    elements.taggingLoader.style.display = show ? "flex" : "none";
    elements.taggingCardArea.style.display = show ? "none" : "";
    elements.taggingMainActions.style.display = show ? "none" : "";
    elements.taggingBatchActions.style.display = show ? "none" : "";
    if (show) elements.taggingEmpty.style.display = "none";
  },

  taggingStats(stats) {
    elements.taggingStatPending.textContent = stats.pending ?? 0;
    elements.taggingStatTagged.textContent = stats.tagged ?? 0;
    elements.taggingStatSkipped.textContent = stats.skipped ?? 0;
  },

  taggingCard(file, direction, videoToThumbnailUrl, isVideoFile, isProcessing) {
    if (!file) {
      render.emptyState(isProcessing);
      return;
    }
    render.cardArea();
    render.preview(file, videoToThumbnailUrl, isVideoFile);
    elements.taggingFilename.textContent = file.name;
    render.cardEntrance(direction);
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
