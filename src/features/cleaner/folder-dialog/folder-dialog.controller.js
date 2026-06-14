import FolderDialogModel from "./folder-dialog.model.js";
import FolderDialogView from "./folder-dialog.view.js";
import History from "../../../core/ui/history.js";

let onChange = null;

function setOnChange(fn) {
  onChange = fn;
}

function open(folder, activeFilter) {
  FolderDialogView.update.open(folder, activeFilter);
  History.pushDialog(FolderDialogView.getElements().dialog);
}

function refreshBody(folder, activeFilter) {
  FolderDialogView.update.refreshBody(folder, activeFilter);
}

const handlers = {
  onClose: () => History.goBack(),

  onDialogChange: e => {
    const input = e.target.closest("input[data-action]");
    if (!input) return;
    const folderId = FolderDialogView.getOpenFolderId();
    if (!folderId) return;
    const { action, mediaType } = input.dataset;
    onChange?.(folderId, () => {
      if (action === "toggleFolderClean")
        FolderDialogModel.toggleFolderClean(folderId, mediaType);
    });
  },

  onDialogClick: e => {
    const btn = e.target.closest("[data-action='setFolderDays']");
    if (!btn) return;
    const folderId = FolderDialogView.getOpenFolderId();
    if (!folderId) return;
    onChange?.(folderId, () => {
      FolderDialogModel.setFolderDays(
        folderId,
        btn.dataset.mediaType,
        parseInt(btn.dataset.days, 10)
      );
    });
  }
};

function attachEvents() {
  const { dialog, dialogClose } = FolderDialogView.getElements();

  const events = [
    [dialog, "change", handlers.onDialogChange],
    [dialog, "click", handlers.onDialogClick],
    [dialogClose, "click", handlers.onClose]
  ];
  events.forEach(([el, event, handler]) => el.addEventListener(event, handler));
}

function init() {
  FolderDialogView.init();
  attachEvents();
}

export default {
  init,
  open,
  refreshBody,
  setOnChange
};
