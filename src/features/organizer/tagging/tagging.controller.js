import OrganizerModel from "../organizer.model.js";
import TaggingModel from "./tagging.model.js";
import TaggingView from "./tagging.view.js";
import AppState from "../../../core/state/app-state.js";
import Navigation from "../../../core/ui/navigation.js";
import History from "../../../core/ui/history.js";
import Toast from "../../../core/ui/toast.js";
import I18n from "../../../core/services/i18n.js";
import ImageUtils from "../../../lib/image-utils.js";
import { GeminiError } from "../../../lib/gemini.js";
import EventBus from "../../../core/platform/event-bus.js";

let taggingQueue = [];
let taggingIndex = 0;
let batchCancelled = false;

function buildTaggingQueue() {
  taggingQueue = OrganizerModel.getPendingMedia();
  taggingIndex = 0;
}

function showCurrentTaggingCard(direction) {
  const file = taggingQueue[taggingIndex] || null;
  TaggingView.update.taggingCard(
    file,
    direction,
    ImageUtils.videoToThumbnailUrl,
    TaggingModel.isVideoFile
  );
  TaggingView.update.taggingStats(OrganizerModel.getMediaStats());
}

async function openTaggingDialog() {
  const { activeFilter } = OrganizerModel.getState();
  const type = activeFilter === "recordings" ? "sr" : "ss";
  const { taggingDialog } = TaggingView.getElements();
  History.pushDialog(taggingDialog);
  TaggingView.update.taggingLoader(true);

  await Promise.all([
    OrganizerModel.loadPendingMedia(type),
    OrganizerModel.loadMediaStats(type)
  ]);

  buildTaggingQueue();
  TaggingView.update.taggingStats(OrganizerModel.getMediaStats());
  TaggingView.update.taggingLoader(false);
  showCurrentTaggingCard(null);
}

function handleTaggingError(err) {
  if (!(err instanceof GeminiError)) {
    Toast.error(I18n.t("tagging.error_server"));
    return;
  }
  const keyMap = {
    quota_exceeded: "tagging.error_quota_exceeded",
    rate_limit: "tagging.error_rate_limit",
    overloaded: "tagging.error_overloaded",
    invalid_key: "tagging.error_invalid_key",
    bad_request: "tagging.error_bad_request",
    server_error: "tagging.error_server",
    network_error: "tagging.error_network"
  };
  Toast.error(I18n.t(keyMap[err.code] || "tagging.error_server"));
}

function requireGeminiKey() {
  const gemini = AppState.getSetting("gemini") || {};
  if (gemini.apiKeys?.length) return true;
  History.goBack();
  Toast.info(I18n.t("gemini.api_key_required"), 5000);
  Navigation.navigateToAndHighlight("settings", "#gemini-config-card");
  return false;
}

function incrementStats(key) {
  const stats = OrganizerModel.getMediaStats();
  OrganizerModel.setMediaStats({
    ...stats,
    [key]: (stats[key] || 0) + 1,
    pending: Math.max(0, (stats.pending || 0) - 1)
  });
  TaggingView.update.taggingStats(OrganizerModel.getMediaStats());
}

function handleSkip() {
  const file = taggingQueue[taggingIndex];
  if (!file) return;

  OrganizerModel.removePendingItem(file.path);
  OrganizerModel.skipMedia(file.path)
    .then(() => incrementStats("skipped"))
    .catch(() => {});

  taggingIndex++;
  showCurrentTaggingCard("left");
}

async function applyTagsAndUpdateStats(path, tags) {
  if (!tags.length) return;
  await OrganizerModel.applyTagsToFile(path, tags);
  incrementStats("tagged");
}

function handleGenerateTags() {
  const file = taggingQueue[taggingIndex];
  if (!file) return;
  if (!requireGeminiKey()) return;

  OrganizerModel.removePendingItem(file.path);
  TaggingModel.generateTags(file.path)
    .then(tags => applyTagsAndUpdateStats(file.path, tags))
    .catch(handleTaggingError);

  taggingIndex++;
  showCurrentTaggingCard("right");
}

async function skipBatchItem(file, skippedCount, total) {
  TaggingView.update.taggingBatchCard(
    file,
    ImageUtils.videoToThumbnailUrl,
    TaggingModel.isVideoFile
  );
  TaggingView.update.taggingBatchLabel(skippedCount, total);
  await OrganizerModel.skipMedia(file.path);
  incrementStats("skipped");
}

async function handleSkipAll() {
  const remaining = taggingQueue.slice(taggingIndex);
  if (!remaining.length) return;

  OrganizerModel.clearPendingItems();
  taggingIndex = taggingQueue.length;
  batchCancelled = false;

  TaggingView.update.taggingBatchMode(true, 0, remaining.length);

  let skippedCount = 0;
  let processedIndex = 0;

  for (const file of remaining) {
    if (batchCancelled) break;
    try {
      await skipBatchItem(file, skippedCount, remaining.length);
      skippedCount++;
      processedIndex++;
    } catch {
      processedIndex++;
    }
  }

  TaggingView.update.taggingBatchMode(false);

  if (batchCancelled && processedIndex < remaining.length) {
    taggingIndex = taggingIndex - remaining.length + processedIndex;
    showCurrentTaggingCard(null);
  } else {
    showCurrentTaggingCard("left");
  }
}

function startPrefetch(prefetchMap, file) {
  if (prefetchMap.has(file.path)) return;
  prefetchMap.set(
    file.path,
    TaggingModel.isVideoFile(file.path)
      ? ImageUtils.videoToBase64(file.path)
      : ImageUtils.imageToBase64(file.path)
  );
}

function prefetchLookahead(prefetchMap, remaining, currentIdx) {
  const nextIdx = currentIdx + 10;
  if (nextIdx < remaining.length)
    startPrefetch(prefetchMap, remaining[nextIdx]);
}

function isFatalGeminiError(err) {
  return (
    err instanceof GeminiError &&
    (err.code === "rate_limit" || err.code === "quota_exceeded")
  );
}

async function fetchBase64Cached(prefetchMap, file) {
  if (!prefetchMap.has(file.path)) startPrefetch(prefetchMap, file);
  return prefetchMap.get(file.path);
}

async function generateAndApply(file, prefetchMap, doneCountRef, total) {
  const base64 = await fetchBase64Cached(prefetchMap, file);
  if (batchCancelled) return;
  const tags = await TaggingModel.generateTagsGeminiFromBase64(
    base64,
    file.path
  );
  if (!batchCancelled) {
    await applyTagsAndUpdateStats(file.path, tags);
    doneCountRef.value++;
    TaggingView.update.taggingBatchLabel(doneCountRef.value, total);
  }
}

async function runGenerateWorker(
  remaining,
  prefetchMap,
  lock,
  total,
  doneCountRef
) {
  while (true) {
    if (batchCancelled) return true;

    const idx = lock.i++;
    if (idx >= remaining.length) return false;

    const file = remaining[idx];
    prefetchLookahead(prefetchMap, remaining, idx);

    TaggingView.update.taggingBatchCard(
      file,
      ImageUtils.videoToThumbnailUrl,
      TaggingModel.isVideoFile
    );
    TaggingView.update.taggingBatchLabel(doneCountRef.value, total);

    try {
      await generateAndApply(file, prefetchMap, doneCountRef, total);
    } catch (err) {
      if (isFatalGeminiError(err)) {
        handleTaggingError(err);
        batchCancelled = true;
        return true;
      }
      handleTaggingError(err);
    }
  }
}

function resolveIndexAfterBatch(stopped, lock, remaining) {
  if (!stopped) return taggingQueue.length;
  const startIndex = taggingQueue.length - remaining.length;
  return Math.min(startIndex + lock.i, taggingQueue.length);
}

function initBatchGenerate(remaining) {
  const prefetchMap = new Map();
  remaining.slice(0, 10).forEach(f => startPrefetch(prefetchMap, f));
  TaggingView.update.taggingBatchMode(true, 0, remaining.length);
  return prefetchMap;
}

async function handleGenerateAll() {
  const remaining = taggingQueue.slice(taggingIndex);
  if (!remaining.length) return;
  if (!requireGeminiKey()) return;

  OrganizerModel.clearPendingItems();
  taggingIndex = taggingQueue.length;
  batchCancelled = false;

  const total = remaining.length;
  const prefetchMap = initBatchGenerate(remaining);
  const lock = { i: 0 };
  const doneCountRef = { value: 0 };

  const workerResults = await Promise.all(
    Array.from({ length: 3 }, () =>
      runGenerateWorker(remaining, prefetchMap, lock, total, doneCountRef)
    )
  );

  const stopped = workerResults.some(Boolean);
  TaggingView.update.taggingBatchMode(false);
  taggingIndex = resolveIndexAfterBatch(stopped, lock, remaining);

  if (stopped) {
    showCurrentTaggingCard(null);
  } else {
    showCurrentTaggingCard("right");
    if (doneCountRef.value > 0)
      Toast.success(`${doneCountRef.value} ${I18n.t("tagging.generate_all")}`);
  }
}

function attachEvents() {
  const {
    taggingClose,
    taggingBtnSkip,
    taggingBtnGenerate,
    taggingBtnSkipAll,
    taggingBtnGenerateAll,
    taggingBtnStop
  } = TaggingView.getElements();

  const events = [
    [taggingClose, "click", History.goBack],
    [taggingBtnSkip, "click", handleSkip],
    [taggingBtnGenerate, "click", handleGenerateTags],
    [taggingBtnSkipAll, "click", handleSkipAll],
    [taggingBtnGenerateAll, "click", handleGenerateAll],
    [
      taggingBtnStop,
      "click",
      () => {
        batchCancelled = true;
      }
    ]
  ];
  events.forEach(([el, evt, fn]) => el.addEventListener(evt, fn));

  EventBus.on("tagging:open-dialog", openTaggingDialog);
}

function init() {
  TaggingView.init();
  attachEvents();
}

export default {
  init,
  openTaggingDialog,
  handleSkip,
  handleGenerateTags,
  handleSkipAll,
  handleGenerateAll,
  handleTaggingError,
  requireGeminiKey
};
