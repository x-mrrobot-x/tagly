import "./assets/css/base/reset.css";
import "./assets/css/base/variables.css";
import "./assets/css/base/typography.css";
import "./assets/css/base/globals.css";
import "./assets/css/base/folder-card.css";
import "./assets/css/base/info-card.css";
import "./assets/css/base/buttons.css";
import "./assets/css/base/dialog.css";
import "./assets/css/base/toast.css";
import "./assets/css/base/media-filters.css";
import "./assets/css/animations.css";
import "./assets/css/navigation.css";
import "./features/dashboard/dashboard.css";
import "./features/dashboard/process/process.css";
import "./features/stats/stats.css";
import "./features/cleaner/cleaner.css";
import "./features/organizer/organizer.css";
import "./features/settings/settings.css";

import Logger from "./core/platform/logger.js";
import ENV from "./core/platform/env.js";
import TaskQueue from "./core/platform/task-queue.js";
import AppState from "./core/state/app-state.js";
import App from "./app.js";

ENV.setTaskResultHandler(result => TaskQueue.onResult(result));
ENV.setSettingsGetter(key => AppState.getSetting(key));

if (import.meta.env.DEV || import.meta.env.MODE === "pages") {
  await import("./assets/css/responsive.css");
}

if (import.meta.env.DEV) {
  const { default: eruda } = await import("eruda");
  eruda.init();
}

(async () => {
  const t0 = performance.now();
  await App.init();
  window.App = App;
  Logger.warn(`App initialized in ${(performance.now() - t0).toFixed(2)} ms`);
})();
