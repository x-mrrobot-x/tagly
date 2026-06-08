const DEFAULT_STATS = {
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
};

const DEFAULT_SETTINGS = {
  theme: "system",
  autoOrganizer: true,
  autoCleaner: false,
  notifyOrganizationResult: true,
  notifyCleanupResult: true,
  notifyPendingFiles: false,
  animationsEnabled: true,
  customDestinationScreenshots: null,
  customDestinationRecordings: null,
  language: null
};

export default {
  DEFAULT_STATS,
  DEFAULT_SETTINGS
};
