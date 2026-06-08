import DOM from "../../../lib/dom.js";
import I18n from "../../../core/services/i18n.js";

let elements = null;

function queryElements() {
  elements = {
    dialog: DOM.qs("#dialog-media-detail"),
    closeBtn: DOM.qs("#media-detail-close"),
    wrapper: DOM.qs("#media-detail-wrapper"),
    preview: DOM.qs("#media-detail-preview"),
    player: DOM.qs("#media-detail-player"),
    filename: DOM.qs("#media-detail-filename"),
    tags: DOM.qs("#media-detail-tags"),
    generateBtn: DOM.qs("#media-detail-generate-btn")
  };
}

function getElements() {
  return elements;
}

const helpers = {
  parseTags(filename) {
    const match = filename.match(/\[([^\]]+)\]/);
    if (!match) return [];
    const inner = match[1];
    if (inner === "skip") return [];
    return inner.split("_").filter(Boolean);
  },

  tagDisplay(tag) {
    return tag.replace(/-/g, " ");
  }
};

const templates = {
  tag: t =>
    `<span class="tag-badge removable-tag">` +
    `<span class="tag-label">${helpers.tagDisplay(t)}</span>` +
    `<button class="tag-remove-btn tap-scale" data-tag="${t}" aria-label="Remove tag">×</button>` +
    `</span>`,

  tagsList: tags => tags.map(templates.tag).join("")
};

const render = {
  tags(filename) {
    const tags = helpers.parseTags(filename);
    const hasTags = tags.length > 0;
    elements.tags.innerHTML = hasTags ? templates.tagsList(tags) : "";
    elements.generateBtn.style.display = hasTags ? "none" : "";
  },

  mediaType(isVideo) {
    elements.preview.style.display = isVideo ? "none" : "block";
    elements.player.style.display = isVideo ? "block" : "none";
    elements.wrapper.classList.toggle("detail-media-wrapper--video", isVideo);
    elements.dialog.setAttribute(
      "aria-label",
      I18n.t(
        isVideo
          ? "media_detail.recording_title"
          : "media_detail.screenshot_title"
      )
    );
  }
};

const update = {
  open(file, type) {
    if (!file) return;
    const isVideo = type === "video";
    render.mediaType(isVideo);

    if (isVideo) {
      elements.player.pause();
      elements.player.src = file.path;
      elements.player.load();
    } else {
      elements.preview.src = file.path;
    }

    elements.filename.textContent = file.name;
    render.tags(file.name);
  },

  tags(filename) {
    render.tags(filename);
    elements.filename.textContent = filename;
  },

  stopVideo() {
    elements.player.pause();
    elements.player.src = "";
    elements.player.load();
  },

  generateBtnLoading(loading) {
    elements.generateBtn.disabled = loading;
    elements.generateBtn.classList.toggle("is-loading", loading);
  }
};

function init() {
  queryElements();
}

export default {
  init,
  getElements,
  update,
  parseTags: helpers.parseTags
};
