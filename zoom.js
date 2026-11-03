'use strict';
// Use native CSS zoom instead of transform so controls, text and hit targets scale
// together and browser layout can reflow. Clamp stored values before using them.
const UI_ZOOM_KEY = 'ki_workspace_ui_zoom';
const UI_ZOOM_MIN = 70;
const UI_ZOOM_MAX = 150;
const UI_ZOOM_STEP = 10;
let uiZoom = 100;

function normalizeUiZoom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, Math.round(number / UI_ZOOM_STEP) * UI_ZOOM_STEP));
}
function setUiZoom(value) {
  uiZoom = normalizeUiZoom(value);
  // CSS zoom scales the root visually, but viewport units still describe the
  // unscaled viewport. Compensate the app shell's height so the composer stays
  // within the visible area even at 150 %.
  document.documentElement.style.setProperty('--ui-zoom', String(uiZoom / 100));
  document.documentElement.style.zoom = String(uiZoom / 100);
  const readout = document.getElementById('zoom-reset');
  if (readout) readout.textContent = uiZoom + ' %';
  const minus = document.getElementById('zoom-out');
  const plus = document.getElementById('zoom-in');
  if (minus) minus.disabled = uiZoom <= UI_ZOOM_MIN;
  if (plus) plus.disabled = uiZoom >= UI_ZOOM_MAX;
  try { localStorage.setItem(UI_ZOOM_KEY, String(uiZoom)); } catch { /* Zoom works even without storage */ }
}
function changeUiZoom(delta) { setUiZoom(uiZoom + delta); }

try { setUiZoom(localStorage.getItem(UI_ZOOM_KEY) || 100); }
catch { setUiZoom(100); }
