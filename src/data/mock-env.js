import Logger from "../core/platform/logger.js";
import Defaults from "../lib/defaults.js";

const { DEFAULT_SETTINGS } = Defaults;

const MOCK_APPS = [
  { name: "WhatsApp", pkg: "com.whatsapp" },
  { name: "Telegram", pkg: "org.telegram.messenger" },
  { name: "Twitter", pkg: "com.twitter.android" },
  { name: "YouTube", pkg: "com.gold.android.youtube" },
  { name: "Instagram", pkg: "com.instagram.android" },
  { name: "Netflix", pkg: "com.netflix.mediaclient" },
  { name: "Spotify", pkg: "com.spotify.music" },
  { name: "TikTok", pkg: "com.zhiliaoapp.musically" },
  { name: "Tasker", pkg: "net.dinglisch.android.taskerm" },
  { name: "Claude", pkg: "com.anthropic.claude" }
];

const MOCK_MEDIA_FILES = {
  screenshots: {
    WhatsApp: 15,
    Telegram: 8,
    Twitter: 25,
    Instagram: 30,
    Spotify: 5
  },
  recordings: { WhatsApp: 5, Telegram: 2, YouTube: 12, Netflix: 3 }
};

const MOCK_FOLDER_TIMESTAMPS = {
  screenshots: {
    WhatsApp: 1771360442,
    Telegram: 1771359365,
    Twitter: 1771412925,
    Instagram: 1771279880,
    Spotify: 1771417649
  },
  recordings: {
    WhatsApp: 1771200625,
    Telegram: 1771074740,
    YouTube: 1771279874,
    Netflix: 1771072772
  }
};

const MOCK_SOURCE_PACKAGES = {
  screenshots: [
    "com.whatsapp",
    "org.telegram.messenger",
    "com.twitter.android"
  ],
  recordings: ["com.whatsapp", "com.gold.android.youtube"]
};

function midnightOf(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAILY_SCREENSHOT_PATTERN = [
  { offset: 8, count: 23 },
  { offset: 7, count: 48 },
  { offset: 6, count: 31 },
  { offset: 5, count: 14 },
  { offset: 4, count: 72 },
  { offset: 3, count: 38 },
  { offset: 2, count: 25 }
];

const DAILY_RECORDING_PATTERN = [
  { offset: 16, count: 8 },
  { offset: 14, count: 15 },
  { offset: 12, count: 6 },
  { offset: 9, count: 22 },
  { offset: 7, count: 11 },
  { offset: 6, count: 4 },
  { offset: 4, count: 18 }
];

const MOCK_STATS = {
  organizedFiles: 150,
  cleanedFiles: 45,
  toOrganize: {
    screenshots: 25,
    recordings: 10
  },
  foldersCreated: {
    screenshots: 15,
    recordings: 8
  },
  lastOrganization: {
    screenshots: Date.now() - 86_400_000,
    recordings: Date.now() - 172_800_000
  },
  lastClean: {
    screenshots: Date.now() - 259_200_000,
    recordings: Date.now() - 345_600_000
  },
  dailyOrganized: {
    screenshots: DAILY_SCREENSHOT_PATTERN.map(({ offset, count }) => ({
      ts: midnightOf(offset),
      count
    })),
    recordings: DAILY_RECORDING_PATTERN.map(({ offset, count }) => ({
      ts: midnightOf(offset),
      count
    }))
  }
};

const MOCK_VARIABLES = {
  process_type: "organize_screenshots"
};

const STORAGE_PREFIX = "@tagly:";

function getVariable(name) {
  return MOCK_VARIABLES[name] || null;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mediaTypeFromPath(path) {
  return path?.includes("Screenshots") ? "screenshots" : "recordings";
}

function sumMediaValues(mediaType) {
  return Object.values(MOCK_MEDIA_FILES[mediaType] ?? {}).reduce(
    (a, b) => a + b,
    0
  );
}

function parseJsonArg(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function resolveMovedCount(countCommand) {
  if (countCommand?.includes("jpg") || countCommand?.includes("png"))
    return sumMediaValues("screenshots");
  if (countCommand?.includes("mp4")) return sumMediaValues("recordings");
  return randomInt(5, 50);
}

function getFolderMediaType(folderPath) {
  return mediaTypeFromPath(folderPath);
}

function getFolderName(folderPath) {
  return folderPath.split("/").pop();
}

const MOCK_COMMANDS = {
  scan_media_app_packages(args) {
    const [folderPath] = args;
    return MOCK_SOURCE_PACKAGES[mediaTypeFromPath(folderPath)] ?? [];
  },

  create_app_media_folders(args) {
    const appNames = parseJsonArg(args[0], []);
    return { created: appNames.length };
  },

  run_batch_command(args) {
    return { moved: resolveMovedCount(args[0]) };
  },

  delete_files_batch(args) {
    const files = parseJsonArg(args[0], []);
    return { deleted: Array.isArray(files) ? files.length : 0 };
  },

  find_expired_files(args) {
    const [folderPath] = args;
    const isRecordings = mediaTypeFromPath(folderPath) === "recordings";
    const exts = isRecordings ? ["mp4"] : ["jpg", "png"];
    return Array.from({ length: randomInt(0, 4) }, (_, i) => {
      const ext = exts[i % exts.length];
      return `${folderPath}/expired_${i}.${ext}`;
    });
  },

  count_media_items(args) {
    return sumMediaValues(mediaTypeFromPath(args[0]));
  },

  count_subfolders(args) {
    const mediaType = mediaTypeFromPath(args[0]);
    return Object.keys(MOCK_MEDIA_FILES[mediaType] ?? {}).length;
  },

  get_subfolders(args) {
    const mediaType = mediaTypeFromPath(args[0]);
    const mediaData = MOCK_MEDIA_FILES[mediaType] ?? {};
    const timestamps = MOCK_FOLDER_TIMESTAMPS[mediaType] ?? {};
    return Object.keys(mediaData).map(
      name => `${name},${timestamps[name] ?? 1771000000}`
    );
  },

  rename_folder() {
    return { renamed: true, timestamp: Math.floor(Date.now() / 1000) };
  },

  get_item_counts_batch(args) {
    const [path, foldersJson] = args;
    const mediaData = MOCK_MEDIA_FILES[mediaTypeFromPath(path)] ?? {};
    const requestedFolders = parseJsonArg(foldersJson, null);
    if (!requestedFolders) {
      Logger.error(
        "[MOCK] get_item_counts_batch: invalid foldersJson",
        foldersJson
      );
      return [];
    }
    return requestedFolders.map(name => `${name},${mediaData[name] ?? 0}`);
  },

  get_app_details_batch(args) {
    const packages = Array.isArray(args) ? args : [];
    return MOCK_APPS.filter(app => packages.includes(app.pkg));
  },

  check_installed_apps() {
    return { changed: true, packages: MOCK_APPS.map(a => a.pkg) };
  },

  select_directory() {
    return { path: "/storage/emulated/0/OrganizedMedia/Custom" };
  },

  export_data() {
    return true;
  },

  import_data() {
    const mockBackup = {
      version: "1",
      exportedAt: Date.now(),
      data: {
        settings: {
          theme: "system",
          notifyOrganizationResult: true,
          notifyCleanupResult: true,
          notifyPendingFiles: false,
          animationsEnabled: true,
          customDestinationScreenshots: null,
          customDestinationRecordings: null,
          language: "en"
        },
        folders: [],
        activities: [],
        stats: {
          organizedFiles: 0,
          cleanedFiles: 0,
          toOrganize: {
            screenshots: 0,
            recordings: 0
          },
          foldersCreated: {
            screenshots: 0,
            recordings: 0
          },
          lastOrganization: {
            screenshots: null,
            recordings: null
          },
          lastClean: {
            screenshots: null,
            recordings: null
          },
          dailyOrganized: {
            screenshots: [],
            recordings: []
          }
        },
        apps: []
      }
    };
    return { content: JSON.stringify(mockBackup) };
  },

  delete_folder_contents(args) {
    const [folderPath] = args;
    const mediaType = getFolderMediaType(folderPath);
    const folderName = getFolderName(folderPath);
    return {
      deleted: MOCK_MEDIA_FILES[mediaType]?.[folderName] ?? 0,
      mtime: MOCK_FOLDER_TIMESTAMPS[mediaType]?.[folderName] ?? null
    };
  },

  get_media_stats(args) {
    const [dir] = args;
    if (mediaTypeFromPath(dir) === "recordings")
      return { pending: 8, tagged: 3, skipped: 1 };
    return { pending: 12, tagged: 5, skipped: 2 };
  },

  get_pending_media(args) {
    const [dir] = args;
    const isRecordings =
      dir?.includes("Recording") || dir?.includes("recording");
    if (isRecordings) {
      return {
        files: [
          "WhatsApp/Recording_2024-10-19-14-04-19.mp4",
          "Instagram/Recording_2024-10-21-10-10-00.mp4",
          "YouTube/Recording_2024-10-22-08-30-00.mp4"
        ]
      };
    }
    return {
      files: [
        "Telegram/Screenshot_2024-08-07-07-26-13-563_org.telegram.messenger.jpg",
        "WhatsApp/Screenshot_2024-09-15-10-44-22_com.whatsapp.png",
        "Instagram/Screenshot_2024-10-01-08-30-05_com.instagram.jpg"
      ]
    };
  },

  list_media_in_folder(args) {
    const [folderPath] = args;
    const isRecordings =
      folderPath?.includes("Recording") || folderPath?.includes("recording");
    if (isRecordings) {
      return {
        files: [
          "Recording_2024-10-19-14-04-19.mp4",
          "Recording_2024-10-20-09-11-45[gaming].mp4",
          "Recording_2024-10-21-10-10-00[skip].mp4"
        ]
      };
    }
    return {
      files: [
        "Screenshot_2024-10-19-14-04-19.jpg",
        "Screenshot_2024-10-19-15-22-01[free_fire_lobby].png",
        "Screenshot_2024-10-20-09-11-45[skip].jpg",
        "Screenshot_2024-10-20-11-33-57.png",
        "Screenshot_2024-10-21-08-55-30.jpg",
        "Screenshot_2024-10-21-10-10-00[youtube_music].png"
      ]
    };
  },

  search_media_by_tag(args) {
    const [dir, query] = args;
    if (!query) return { files: [] };
    const isRecordings =
      dir?.includes("Recording") || dir?.includes("recording");
    if (isRecordings) {
      return {
        files: [
          {
            path: `${dir}/WhatsApp/Recording_2024-10-19[${query}].mp4`,
            name: `Recording_2024-10-19[${query}].mp4`,
            mtime: 1729351321
          },
          {
            path: `${dir}/Instagram/Recording_2024-10-21[${query}_screen].mp4`,
            name: `Recording_2024-10-21[${query}_screen].mp4`,
            mtime: 1729501800
          }
        ]
      };
    }
    return {
      files: [
        {
          path: `${dir}/WhatsApp/Screenshot_2024-10-19[${query}].jpg`,
          name: `Screenshot_2024-10-19[${query}].jpg`,
          mtime: 1729351321
        },
        {
          path: `${dir}/Instagram/Screenshot_2024-10-21[${query}_result].png`,
          name: `Screenshot_2024-10-21[${query}_result].png`,
          mtime: 1729501800
        }
      ]
    };
  },

  skip_screenshot(args) {
    const [filePath] = args;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const name = filePath.substring(filePath.lastIndexOf("/") + 1);
    const ext = name.substring(name.lastIndexOf("."));
    const base = name
      .substring(0, name.lastIndexOf("."))
      .replace(/\[[^\]]*\]/g, "")
      .trimEnd();
    const newPath = `${dir}/${base}[skip]${ext}`;
    return { newPath };
  },

  apply_tags_to_filename(args) {
    const [filePath, tagsCsv] = args;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const name = filePath.substring(filePath.lastIndexOf("/") + 1);
    const ext = name.substring(name.lastIndexOf("."));
    const base = name
      .substring(0, name.lastIndexOf("."))
      .replace(/\[[^\]]*\]/g, "")
      .trimEnd();
    const tagStr = (tagsCsv || "")
      .replace(/,/g, "_")
      .replace(/__+/g, "_")
      .replace(/^_|_$/g, "");
    const newPath = `${dir}/${base}[${tagStr}]${ext}`;
    return { newPath };
  },

  clear_tags_from_filename(args) {
    const [filePath] = args;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const name = filePath.substring(filePath.lastIndexOf("/") + 1);
    const ext = name.substring(name.lastIndexOf("."));
    const base = name
      .substring(0, name.lastIndexOf("."))
      .replace(/\[[^\]]*\]/g, "")
      .trimEnd();
    return { newPath: `${dir}/${base}${ext}` };
  },

  generate_tags_gemini(args) {
    const { image, model, apiKey } = args[0] || {};
    const mockTagSets = [
      ["game", "mobile", "screenshot"],
      ["social_media", "feed", "post"],
      ["chat", "message", "conversation"],
      ["video", "streaming", "player"],
      ["browser", "web", "article"],
      ["settings", "app", "config"]
    ];
    const idx = Math.floor(Math.random() * mockTagSets.length);
    return { tags: mockTagSets[idx] };
  }
};

async function simulateDelay() {
  await new Promise(resolve => setTimeout(resolve, randomInt(150, 600)));
}

function resolveHandler(command) {
  const handler = MOCK_COMMANDS[command];
  if (typeof handler !== "function") {
    Logger.warn(`[MOCK ENV] Command not implemented: "${command}"`);
    return null;
  }
  return handler;
}

async function executeCommand(command, args = []) {
  await simulateDelay();
  const handler = resolveHandler(command);
  if (!handler) return null;
  try {
    return handler(args);
  } catch (error) {
    Logger.error(`[MOCK ENV] Error in "${command}":`, error);
    return null;
  }
}

function resolveArgs(params, type) {
  return type === "shell"
    ? Array.isArray(params)
      ? params
      : [params]
    : params;
}

async function processTask(commandName, params, type) {
  return executeCommand(commandName, resolveArgs(params, type));
}

function seedStorageKey(key, value) {
  if (!localStorage.getItem(STORAGE_PREFIX + key)) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  }
}

function init() {
  seedStorageKey("stats", MOCK_STATS);
  seedStorageKey("settings", DEFAULT_SETTINGS);
}

export default {
  executeCommand,
  processTask,
  getVariable,
  init
};
