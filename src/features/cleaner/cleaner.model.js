import AppState from "../../core/state/app-state.js";

let activeFilter = "screenshots";
let showEnabledOnly = false;

function getActiveFilter() {
  return activeFilter;
}

function setActiveFilter(filter) {
  activeFilter = filter;
  showEnabledOnly = false;
}

function getShowEnabledOnly() {
  return showEnabledOnly;
}

function toggleShowEnabledOnly() {
  showEnabledOnly = !showEnabledOnly;
  return showEnabledOnly;
}

function getFolders() {
  return AppState.getFolders();
}

export default {
  getFolders,
  getActiveFilter,
  setActiveFilter,
  getShowEnabledOnly,
  toggleShowEnabledOnly
};
