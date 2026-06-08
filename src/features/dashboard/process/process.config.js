import ENV from "../../../core/platform/env.js";

const PROCESS_TYPES = {
  organize_screenshots: {
    icon: "image",
    iconClass: "icon-blue",
    titleKey: "process.organize_screenshots_title",
    notificationTitleKey: "nav.organizer",
    doneLabelKey: "process.organize_done_label",
    notificationKey: "notifyOrganizationResult",
    steps: [
      {
        id: "scan_screenshots",
        labelKey: "process.step_scan_screenshots",
        type: "shell",
        func: "scan_media_app_packages",
        params: () => [ENV.PATHS.SOURCE_SCREENSHOTS]
      },
      {
        id: "resolve_app_names",
        labelKey: "process.step_resolve_apps",
        type: "js",
        func: "resolveAppNames",
        params: ctx => [ctx.scan_screenshots]
      },
      {
        id: "create_app_folders",
        labelKey: "process.step_create_folders",
        type: "shell",
        func: "create_app_media_folders",
        params: ctx => [
          JSON.stringify([...new Set(Object.values(ctx.resolve_app_names))]),
          ENV.PATHS.ORGANIZED_SCREENSHOTS
        ]
      },
      {
        id: "prepare_file_moves",
        labelKey: "process.step_prepare_moves",
        type: "js",
        func: "prepareMediaOrganization",
        params: ctx => [
          ctx.resolve_app_names,
          ENV.PATHS.SOURCE_SCREENSHOTS,
          ENV.PATHS.ORGANIZED_SCREENSHOTS,
          ["jpg", "png"]
        ]
      },
      {
        id: "move_and_count",
        labelKey: "process.step_move_screenshots",
        type: "shell",
        func: "run_batch_command",
        params: ctx => [
          ctx.prepare_file_moves.countCommand,
          ctx.prepare_file_moves.moveCommand
        ]
      },
      {
        id: "save_summary",
        labelKey: "process.step_save_summary",
        type: "js",
        func: "saveScreenshotSummary",
        params: ctx => [
          "organize_screenshots",
          {
            moved: ctx.move_and_count.moved || 0,
            created: ctx.create_app_folders.created
          },
          ctx.executionMode
        ]
      }
    ]
  },

  organize_recordings: {
    icon: "video",
    iconClass: "icon-green",
    titleKey: "process.organize_recordings_title",
    notificationTitleKey: "nav.organizer",
    doneLabelKey: "process.organize_done_label",
    notificationKey: "notifyOrganizationResult",
    steps: [
      {
        id: "scan_recordings",
        labelKey: "process.step_scan_recordings",
        type: "shell",
        func: "scan_media_app_packages",
        params: () => [ENV.PATHS.SOURCE_RECORDINGS]
      },
      {
        id: "resolve_app_names",
        labelKey: "process.step_resolve_apps",
        type: "js",
        func: "resolveAppNames",
        params: ctx => [ctx.scan_recordings]
      },
      {
        id: "create_app_folders",
        labelKey: "process.step_create_folders",
        type: "shell",
        func: "create_app_media_folders",
        params: ctx => [
          JSON.stringify(Object.values(ctx.resolve_app_names)),
          ENV.PATHS.ORGANIZED_RECORDINGS
        ]
      },
      {
        id: "prepare_file_moves",
        labelKey: "process.step_prepare_moves",
        type: "js",
        func: "prepareMediaOrganization",
        params: ctx => [
          ctx.resolve_app_names,
          ENV.PATHS.SOURCE_RECORDINGS,
          ENV.PATHS.ORGANIZED_RECORDINGS,
          ["mp4"]
        ]
      },
      {
        id: "move_and_count",
        labelKey: "process.step_move_recordings",
        type: "shell",
        func: "run_batch_command",
        params: ctx => [
          ctx.prepare_file_moves.countCommand,
          ctx.prepare_file_moves.moveCommand
        ]
      },
      {
        id: "save_summary",
        labelKey: "process.step_save_summary",
        type: "js",
        func: "saveRecordingSummary",
        params: ctx => [
          "organize_recordings",
          {
            moved: ctx.move_and_count.moved || 0,
            created: ctx.create_app_folders.created
          },
          ctx.executionMode
        ]
      }
    ]
  },

  cleanup_old_files: {
    icon: "broom",
    iconClass: "icon-purple",
    titleKey: "process.cleanup_title",
    notificationTitleKey: "nav.cleaner",
    doneLabelKey: "process.cleanup_done_label",
    notificationKey: "notifyCleanupResult",
    steps: [
      {
        id: "load_cleanup_rules",
        labelKey: "process.step_load_rules",
        type: "js",
        func: "loadCleanupRules",
        params: () => []
      },
      {
        id: "find_all_expired",
        labelKey: "process.step_find_expired",
        type: "js",
        func: "findAllExpiredMedia",
        params: ctx => [
          ctx.load_cleanup_rules,
          ENV.PATHS.ORGANIZED_SCREENSHOTS,
          ENV.PATHS.ORGANIZED_RECORDINGS
        ]
      },
      {
        id: "delete_all_expired",
        labelKey: "process.step_delete_expired",
        type: "shell",
        func: "delete_files_batch",
        params: ctx => [JSON.stringify(ctx.find_all_expired.all)]
      },
      {
        id: "save_cleanup_summary",
        labelKey: "process.step_save_cleanup",
        type: "js",
        func: "saveCleanupSummary",
        params: ctx => [
          "cleanup_old_files",
          {
            ss_removed: ctx.find_all_expired.screenshots.length,
            sr_removed: ctx.find_all_expired.recordings.length,
            total_removed: ctx.delete_all_expired?.deleted ?? 0
          },
          ctx.executionMode
        ]
      }
    ]
  }
};

export default {
  PROCESS_TYPES
};
