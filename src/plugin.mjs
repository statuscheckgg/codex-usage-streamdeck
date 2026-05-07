#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import streamDeck, { SingletonAction } from "@elgato/streamdeck";

const PLUGIN_UUID = "com.statuscheck.codex-usage";
const ACTION_UUID = "com.statuscheck.codex-usage.usage";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const PLUGIN_VERSION = "0.1.4.0";

const actions = new Map();

class CodexUsageAction extends SingletonAction {
  constructor() {
    super();
    this.manifestId = ACTION_UUID;
  }

  async onWillAppear(ev) {
    const context = ev.action.id;
    const settings = normalizeSettings(ev.payload?.settings);
    actions.set(context, {
      context,
      sdkAction: ev.action,
      settings,
      timer: null,
      lastUsage: null,
      lastError: null,
    });
    schedule(context);
    await refreshAction(context, { force: true });
  }

  onWillDisappear(ev) {
    const action = actions.get(ev.action.id);
    if (action?.timer) {
      clearInterval(action.timer);
    }
    actions.delete(ev.action.id);
  }

  async onKeyDown(ev) {
    await refreshAction(ev.action.id, { force: true, feedback: true });
  }

  async onDidReceiveSettings(ev) {
    const context = ev.action.id;
    const settings = normalizeSettings(ev.payload?.settings);
    const action = actions.get(context) || {
      context,
      sdkAction: ev.action,
      timer: null,
      lastUsage: null,
      lastError: null,
    };
    action.sdkAction = ev.action;
    action.settings = settings;
    actions.set(context, action);
    schedule(context);
    await refreshAction(context, { force: true });
  }

  async onSendToPlugin(ev) {
    if (ev.payload?.type === "refresh") {
      await refreshAction(ev.action.id, { force: true, feedback: true });
    }
  }
}

streamDeck.actions.registerAction(new CodexUsageAction());

const runtimeKeepAlive = setInterval(() => {}, 60 * 60 * 1000);

main();

async function main() {
  try {
    await streamDeck.connect();
  } catch (error) {
    clearInterval(runtimeKeepAlive);
    streamDeck.logger.error("Failed to connect Codex Usage Monitor.", error);
    process.exit(1);
  }
}

function schedule(context) {
  const action = actions.get(context);
  if (!action) {
    return;
  }

  if (action.timer) {
    clearInterval(action.timer);
    action.timer = null;
  }

  const refreshMs = Math.max(15, action.settings.refreshSeconds) * 1000;
  action.timer = setInterval(() => {
    refreshAction(context, { force: true }).catch(() => {});
  }, refreshMs);
}

async function refreshAction(context, options = {}) {
  const action = actions.get(context);
  if (!action) {
    return;
  }

  try {
    const usage = await fetchCodexUsage(action.settings);
    action.lastUsage = usage;
    action.lastError = null;
    await renderAction(action, usage);
    if (options.feedback) {
      await action.sdkAction.showOk();
    }
  } catch (error) {
    action.lastError = error;
    await renderError(action, error);
    if (options.feedback) {
      await action.sdkAction.showAlert();
    }
  }
}

function defaultSettings() {
  return {
    displayMode: "dual-bars",
    refreshSeconds: 300,
    yellowThreshold: 50,
    redThreshold: 20,
    criticalThreshold: 10,
    moodEnabled: true,
    greenMoodMinutes: 15,
    yellowMoodMinutes: 5,
    redMoodMinutes: 1,
    pulseEnabled: true,
    showReset: true,
    showPlan: false,
    showSpark: false,
    authPath: "",
    basis: "remaining",
    singleWindow: "auto",
  };
}

function normalizeSettings(raw = {}) {
  const defaults = defaultSettings();
  const legacyDisplayMode = pick(raw.displayMode, defaults.displayMode);
  return {
    displayMode: normalizeDisplayMode(legacyDisplayMode),
    refreshSeconds: clampNumber(raw.refreshSeconds, defaults.refreshSeconds, 15, 3600),
    yellowThreshold: clampNumber(raw.yellowThreshold, defaults.yellowThreshold, 1, 99),
    redThreshold: clampNumber(raw.redThreshold, defaults.redThreshold, 1, 99),
    criticalThreshold: clampNumber(raw.criticalThreshold, defaults.criticalThreshold, 1, 99),
    moodEnabled: toBool(raw.moodEnabled, defaults.moodEnabled),
    greenMoodMinutes: clampNumber(raw.greenMoodMinutes, defaults.greenMoodMinutes, 1, 240),
    yellowMoodMinutes: clampNumber(raw.yellowMoodMinutes, defaults.yellowMoodMinutes, 1, 120),
    redMoodMinutes: clampNumber(raw.redMoodMinutes, defaults.redMoodMinutes, 1, 60),
    pulseEnabled: toBool(raw.pulseEnabled, defaults.pulseEnabled),
    showReset: toBool(raw.showReset, defaults.showReset),
    showPlan: toBool(raw.showPlan, defaults.showPlan),
    showSpark: toBool(raw.showSpark, defaults.showSpark),
    authPath: typeof raw.authPath === "string" ? raw.authPath.trim() : defaults.authPath,
    basis: pick(raw.basis, defaults.basis),
    singleWindow: normalizeSingleWindow(raw.singleWindow, legacyDisplayMode, defaults.singleWindow),
  };
}

function pick(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function normalizeDisplayMode(value) {
  if (value === "dual-bars" || value === "ring" || value === "warning-tile" || value === "split") {
    return value;
  }
  if (value === "weekly-tile" || value === "lowest") {
    return "ring";
  }
  return "dual-bars";
}

function normalizeSingleWindow(value, displayMode, fallback) {
  if (value === "primary" || value === "weekly" || value === "auto") {
    return value;
  }
  if (displayMode === "weekly-tile") {
    return "weekly";
  }
  return fallback;
}

function toBool(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" || value === "1" || value === "on";
  }
  return fallback;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

async function fetchCodexUsage(settings) {
  if (process.env.CODEX_USAGE_MOCK_ERROR) {
    const err = new Error(`Mock ${process.env.CODEX_USAGE_MOCK_ERROR}`);
    err.code = process.env.CODEX_USAGE_MOCK_ERROR;
    throw err;
  }

  if (process.env.CODEX_USAGE_MOCK_PAYLOAD) {
    const payload = JSON.parse(fs.readFileSync(process.env.CODEX_USAGE_MOCK_PAYLOAD, "utf8"));
    if (!payload?.rate_limit?.primary_window || !payload?.rate_limit?.secondary_window) {
      const err = new Error("Mock Codex usage response changed shape.");
      err.code = "ENDPOINT";
      throw err;
    }
    return payload;
  }

  const auth = readCodexAuth(settings.authPath);
  const tokens = auth.tokens || {};
  const accessToken = tokens.access_token;
  const accountId = tokens.account_id;

  if (!accessToken || !accountId) {
    const err = new Error("Codex is not logged in.");
    err.code = "LOGIN";
    throw err;
  }

  let response;
  try {
    response = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "ChatGPT-Account-Id": accountId,
        "User-Agent": "codex-cli",
        Accept: "application/json",
      },
    });
  } catch {
    const err = new Error("Network error while checking Codex usage.");
    err.code = "NETWORK";
    throw err;
  }

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Codex login needs refresh.");
    err.code = "AUTH";
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`Usage request failed: ${response.status}`);
    err.code = response.status === 404 ? "ENDPOINT" : "HTTP";
    err.status = response.status;
    throw err;
  }

  const payload = await response.json();
  if (!payload?.rate_limit?.primary_window || !payload?.rate_limit?.secondary_window) {
    const err = new Error("Codex usage response changed shape.");
    err.code = "ENDPOINT";
    throw err;
  }
  return payload;
}

function readCodexAuth(authPathOverride) {
  const authPath = authPathOverride || path.join(os.homedir(), ".codex", "auth.json");
  if (!fs.existsSync(authPath)) {
    const err = new Error("Codex auth file not found.");
    err.code = "LOGIN";
    throw err;
  }

  try {
    return JSON.parse(fs.readFileSync(authPath, "utf8"));
  } catch {
    const err = new Error("Codex auth file could not be read.");
    err.code = "AUTH";
    throw err;
  }
}

async function renderAction(action, payload) {
  const snapshot = makeSnapshot(payload, action.settings);
  const svg = renderUsageSvg(snapshot, action.settings);
  await action.sdkAction.setImage(`data:image/svg+xml,${encodeURIComponent(svg)}`, { target: 0 });
  await action.sdkAction.setTitle("");
}

async function renderError(action, error) {
  const svg = renderErrorSvg(error);
  await action.sdkAction.setImage(`data:image/svg+xml,${encodeURIComponent(svg)}`, { target: 0 });
  await action.sdkAction.setTitle("");
}

function makeSnapshot(payload, settings) {
  const primary = makeWindow("5H", payload.rate_limit?.primary_window, payload.rate_limit);
  const weekly = makeWindow("WK", payload.rate_limit?.secondary_window, payload.rate_limit);
  const lowest = primary.remainingPercent <= weekly.remainingPercent ? primary : weekly;
  const level = getLevel(lowest.remainingPercent, settings);
  const mood = getMood(level, settings);
  const rawSpark = (payload.additional_rate_limits || []).find((limit) => limit.limit_name || limit.metered_feature);
  const spark = rawSpark ? {
    name: rawSpark.limit_name || rawSpark.metered_feature || "Extra",
    primary: makeWindow("SP", rawSpark.rate_limit?.primary_window, rawSpark.rate_limit),
    weekly: makeWindow("SP", rawSpark.rate_limit?.secondary_window, rawSpark.rate_limit),
  } : null;

  return {
    planType: payload.plan_type || "codex",
    primary,
    weekly,
    lowest,
    level,
    mood,
    spark,
    credits: payload.credits || null,
    allowed: payload.rate_limit?.allowed !== false,
    limitReached: payload.rate_limit?.limit_reached === true,
  };
}

function makeWindow(label, raw, root = {}) {
  const usedPercent = clampNumber(raw?.used_percent, 0, 0, 100);
  const remainingPercent = 100 - usedPercent;
  const resetAt = Number(raw?.reset_at || 0);
  return {
    label,
    usedPercent,
    remainingPercent,
    windowSeconds: Number(raw?.limit_window_seconds || 0),
    resetAfterSeconds: Number(raw?.reset_after_seconds || 0),
    resetAt,
    resetText: formatReset(raw?.reset_after_seconds),
    allowed: root.allowed !== false,
    limitReached: root.limit_reached === true,
  };
}

function getLevel(remaining, settings) {
  if (remaining <= settings.redThreshold) {
    return remaining <= settings.criticalThreshold ? "critical" : "red";
  }
  if (remaining <= settings.yellowThreshold) {
    return "yellow";
  }
  return "green";
}

function getMood(level, settings) {
  if (!settings.moodEnabled) {
    return null;
  }

  const moodSets = {
    green: [
      { text: "OK", face: "smile" },
      { text: "SAFE", face: "check" },
      { text: "GOOD", face: "spark" },
    ],
    yellow: [
      { text: "WATCH", face: "flat" },
      { text: "LOW", face: "warn" },
      { text: "EASY", face: "flat" },
    ],
    red: [
      { text: "OH NO", face: "sad" },
      { text: "LOW", face: "warn" },
      { text: "WAIT", face: "sad" },
    ],
    critical: [
      { text: "OH NO", face: "sad" },
      { text: "LIMIT", face: "warn" },
    ],
  };

  const minutes = level === "green"
    ? settings.greenMoodMinutes
    : level === "yellow"
      ? settings.yellowMoodMinutes
      : settings.redMoodMinutes;
  const set = moodSets[level] || moodSets.green;
  const cycle = Math.floor(Date.now() / (minutes * 60 * 1000));
  return {
    ...set[cycle % set.length],
    pulse: settings.pulseEnabled && (level === "red" || level === "critical") && cycle % 2 === 1,
  };
}

function renderUsageSvg(snapshot, settings) {
  switch (settings.displayMode) {
    case "ring":
      return renderRing(snapshot, settings);
    case "warning-tile":
      return renderWarningTile(snapshot, settings);
    case "split":
      return renderSplit(snapshot, settings);
    case "dual-bars":
    default:
      return renderDualBars(snapshot, settings);
  }
}

function palette(level, pulse = false) {
  if (level === "critical") {
    return {
      bg: pulse ? "#2a0811" : "#15121d",
      panel: "#1d1421",
      accent: "#ff335d",
      soft: "#ffb1c0",
      text: "#fff8fb",
      muted: "#a99aa9",
      track: "#34303f",
    };
  }
  if (level === "red") {
    return {
      bg: pulse ? "#2a1508" : "#15121d",
      panel: "#1b1624",
      accent: "#ffb020",
      soft: "#ffd28a",
      text: "#fffaf1",
      muted: "#aea0a4",
      track: "#34303f",
    };
  }
  if (level === "yellow") {
    return {
      bg: "#14151c",
      panel: "#181b25",
      accent: "#f6d84d",
      soft: "#fff2a6",
      text: "#fffbe5",
      muted: "#a9a692",
      track: "#333640",
    };
  }
  return {
    bg: "#071312",
    panel: "#111a25",
    accent: "#34e977",
    soft: "#9dffbe",
    text: "#f6fff8",
    muted: "#9ba9a9",
    track: "#263241",
  };
}

function base(p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".36"/>
    </filter>
  </defs>
  <rect width="144" height="144" rx="28" fill="${p.bg}"/>
  <rect x="10" y="10" width="124" height="124" rx="23" fill="${p.panel}" filter="url(#shadow)"/>`;
}

function end() {
  return "</svg>";
}

function renderDualBars(snapshot, settings) {
  const p = palette(snapshot.level, snapshot.mood?.pulse);
  const primaryPalette = palette(getLevel(snapshot.primary.remainingPercent, settings));
  const weeklyPalette = palette(getLevel(snapshot.weekly.remainingPercent, settings));
  const primary = valueFor(snapshot.primary, settings);
  const weekly = valueFor(snapshot.weekly, settings);
  const primaryWidth = Math.max(4, primary * 0.83);
  const weeklyWidth = Math.max(4, weekly * 0.83);
  return `${base(p)}
  <text x="23" y="45" fill="${p.text}" font-size="26" font-family="Arial, sans-serif" font-weight="800">${primary}%</text>
  <text x="110" y="33" fill="${primaryPalette.accent}" font-size="15" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">5H</text>
  <text x="110" y="52" fill="${p.text}" font-size="13" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${settings.showReset ? esc(snapshot.primary.resetText) : " "}</text>
  <line x1="24" y1="65" x2="107" y2="65" stroke="${p.track}" stroke-width="6" stroke-linecap="round"/>
  <line x1="24" y1="65" x2="${24 + primaryWidth}" y2="65" stroke="${primaryPalette.accent}" stroke-width="6" stroke-linecap="round"/>
  <text x="23" y="103" fill="${p.text}" font-size="26" font-family="Arial, sans-serif" font-weight="800">${weekly}%</text>
  <text x="110" y="91" fill="${weeklyPalette.accent}" font-size="15" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">WK</text>
  <text x="110" y="110" fill="${p.text}" font-size="13" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${settings.showReset ? esc(snapshot.weekly.resetText) : " "}</text>
  <line x1="24" y1="123" x2="107" y2="123" stroke="${p.track}" stroke-width="6" stroke-linecap="round"/>
  <line x1="24" y1="123" x2="${24 + weeklyWidth}" y2="123" stroke="${weeklyPalette.accent}" stroke-width="6" stroke-linecap="round"/>
  ${renderMood(snapshot, p, 0)}
  ${settings.showSpark ? sparkLabel(snapshot, p, settings) : ""}
  ${settings.showPlan ? planLabel(snapshot.planType, p) : ""}
${end()}`;
}

function renderRing(snapshot, settings) {
  const active = selectSingleWindow(snapshot, settings, "lowest");
  const level = getLevel(active.remainingPercent, settings);
  const mood = getMood(level, settings);
  const p = palette(level, mood?.pulse);
  const value = valueFor(active, settings);
  const arc = ringArc(72, 68, 43, Math.max(0.01, value / 100));
  return `${base(p)}
  <circle cx="72" cy="68" r="43" fill="none" stroke="${p.track}" stroke-width="10" stroke-linecap="round"/>
  <path d="${arc}" fill="none" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>
  <text x="72" y="67" fill="${p.text}" font-size="28" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">${value}%</text>
  <text x="72" y="84" fill="${p.text}" font-size="12" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">${active.label}</text>
  <text x="72" y="111" fill="${p.text}" font-size="13" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${settings.showReset ? esc(active.resetText) : ""}</text>
  ${renderMood({ ...snapshot, level, mood }, p, 1)}
  ${settings.showSpark ? sparkLabel(snapshot, p, settings) : ""}
  ${settings.showPlan ? planLabel(snapshot.planType, p) : ""}
${end()}`;
}

function renderWarningTile(snapshot, settings) {
  const active = selectSingleWindow(snapshot, settings, "lowest");
  const level = getLevel(active.remainingPercent, settings);
  const mood = getMood(level, settings);
  const p = palette(level, mood?.pulse);
  const value = valueFor(active, settings);
  const label = level === "green" ? active.label : mood?.text || active.label;
  return `${base(p)}
  <text x="72" y="39" fill="${p.accent}" font-size="16" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle">${esc(label)}</text>
  <text x="72" y="87" fill="${p.text}" font-size="47" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle">${value}%</text>
  <line x1="38" y1="104" x2="106" y2="104" stroke="${p.track}" stroke-width="9" stroke-linecap="round"/>
  <line x1="38" y1="104" x2="${38 + Math.max(5, value * 0.68)}" y2="104" stroke="${p.accent}" stroke-width="9" stroke-linecap="round"/>
  <text x="72" y="126" fill="${p.text}" font-size="14" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">${settings.showReset ? esc(active.resetText) : active.label}</text>
${end()}`;
}

function renderSplit(snapshot, settings) {
  const p = palette(snapshot.level, snapshot.mood?.pulse);
  const primaryPalette = palette(getLevel(snapshot.primary.remainingPercent, settings));
  const weeklyPalette = palette(getLevel(snapshot.weekly.remainingPercent, settings));
  const p1 = valueFor(snapshot.primary, settings);
  const w1 = valueFor(snapshot.weekly, settings);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="28" fill="${p.bg}"/>
  <rect x="10" y="10" width="124" height="59" rx="21" fill="${p.panel}"/>
  <rect x="10" y="75" width="124" height="59" rx="21" fill="${p.panel}"/>
  <text x="24" y="34" fill="${primaryPalette.accent}" font-size="14" font-family="Arial, sans-serif" font-weight="900">5H</text>
  <text x="24" y="59" fill="${p.text}" font-size="28" font-family="Arial, sans-serif" font-weight="900">${p1}%</text>
  <text x="105" y="55" fill="${p.muted}" font-size="13" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">${settings.showReset ? esc(snapshot.primary.resetText) : ""}</text>
  <text x="24" y="99" fill="${weeklyPalette.accent}" font-size="14" font-family="Arial, sans-serif" font-weight="900">WK</text>
  <text x="24" y="124" fill="${p.text}" font-size="28" font-family="Arial, sans-serif" font-weight="900">${w1}%</text>
  <text x="105" y="120" fill="${p.muted}" font-size="13" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">${settings.showReset ? esc(snapshot.weekly.resetText) : ""}</text>
  ${renderMood(snapshot, p, 0)}
${end()}`;
}

function renderErrorSvg(error) {
  const state = errorState(error);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="28" fill="${state.bg}"/>
  <rect x="10" y="10" width="124" height="124" rx="23" fill="${state.panel}"/>
  <circle cx="72" cy="49" r="22" fill="none" stroke="${state.accent}" stroke-width="8"/>
  ${state.icon}
  <text x="72" y="94" fill="#fff8ef" font-size="${state.size}" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle">${state.label}</text>
  <text x="72" y="115" fill="#fff8ef" font-size="17" font-family="Arial, sans-serif" font-weight="900" text-anchor="middle">${state.sub}</text>
  <text x="72" y="130" fill="#b8abb6" font-size="9" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">v${PLUGIN_VERSION}</text>
</svg>`;
}

function errorState(error) {
  if (error.code === "LOGIN") {
    return {
      bg: "#101722",
      panel: "#151d2b",
      accent: "#34e977",
      label: "LOGIN",
      sub: "CODEX",
      size: "24",
      icon: `<path d="M62 49h20M72 39v20" stroke="#34e977" stroke-width="7" stroke-linecap="round"/>`,
    };
  }
  if (error.code === "AUTH") {
    return {
      bg: "#171019",
      panel: "#211522",
      accent: "#ffb020",
      label: "AUTH",
      sub: "EXPIRED",
      size: "24",
      icon: `<path d="M72 31v24" stroke="#ffb020" stroke-width="8" stroke-linecap="round"/><circle cx="72" cy="66" r="4" fill="#ffb020"/>`,
    };
  }
  if (error.code === "NETWORK") {
    return {
      bg: "#10141c",
      panel: "#171d28",
      accent: "#60a5fa",
      label: "NETWORK",
      sub: "RETRY",
      size: "19",
      icon: `<path d="M58 50q14-15 28 0M64 58q8-8 16 0" fill="none" stroke="#60a5fa" stroke-width="6" stroke-linecap="round"/>`,
    };
  }
  if (error.code === "ENDPOINT") {
    return {
      bg: "#181015",
      panel: "#221820",
      accent: "#ff5f7c",
      label: "API",
      sub: "CHANGED",
      size: "26",
      icon: `<path d="M72 31v24" stroke="#ff5f7c" stroke-width="8" stroke-linecap="round"/><circle cx="72" cy="66" r="4" fill="#ff5f7c"/>`,
    };
  }
  return {
    bg: "#120f18",
    panel: "#1b1422",
    accent: "#ffb020",
    label: "RETRY",
    sub: "USAGE",
    size: "24",
    icon: `<path d="M72 31v24" stroke="#ffb020" stroke-width="8" stroke-linecap="round"/><circle cx="72" cy="66" r="4" fill="#ffb020"/>`,
  };
}

function renderMood(snapshot, p, position) {
  if (!snapshot.mood) {
    return "";
  }
  const x = position === 1 ? 111 : position === 2 ? 111 : 112;
  const y = position === 1 ? 26 : position === 2 ? 27 : 27;
  return `<g>
    <circle cx="${x}" cy="${y}" r="13" fill="${p.bg}" stroke="${p.accent}" stroke-width="2"/>
    ${facePath(snapshot.mood.face, x, y, p.accent)}
  </g>`;
}

function facePath(face, x, y, color) {
  if (face === "check") {
    return `<path d="M${x - 7} ${y}l4 4 8-9" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (face === "warn") {
    return `<path d="M${x} ${y - 8}v10" stroke="${color}" stroke-width="3" stroke-linecap="round"/><circle cx="${x}" cy="${y + 6}" r="1.8" fill="${color}"/>`;
  }
  if (face === "sad") {
    return `<circle cx="${x - 4}" cy="${y - 3}" r="1.7" fill="${color}"/><circle cx="${x + 4}" cy="${y - 3}" r="1.7" fill="${color}"/><path d="M${x - 6} ${y + 7}q6-6 12 0" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  if (face === "flat") {
    return `<circle cx="${x - 4}" cy="${y - 3}" r="1.7" fill="${color}"/><circle cx="${x + 4}" cy="${y - 3}" r="1.7" fill="${color}"/><path d="M${x - 6} ${y + 6}h12" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  if (face === "spark") {
    return `<path d="M${x} ${y - 9}l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="${color}"/>`;
  }
  return `<circle cx="${x - 4}" cy="${y - 3}" r="1.7" fill="${color}"/><circle cx="${x + 4}" cy="${y - 3}" r="1.7" fill="${color}"/><path d="M${x - 6} ${y + 4}q6 6 12 0" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`;
}

function planLabel(planType, p) {
  return `<text x="72" y="23" fill="${p.muted}" font-size="9" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle">${esc(String(planType).toUpperCase())}</text>`;
}

function sparkLabel(snapshot, p, settings) {
  if (!snapshot.spark) {
    return "";
  }
  const value = valueFor(snapshot.spark.primary, settings);
  return `<text x="72" y="133" fill="${p.muted}" font-size="9" font-family="Arial, sans-serif" font-weight="800" text-anchor="middle">SP ${value}%</text>`;
}

function selectSingleWindow(snapshot, settings, fallback) {
  if (settings.singleWindow === "primary") {
    return snapshot.primary;
  }
  if (settings.singleWindow === "weekly") {
    return snapshot.weekly;
  }
  return fallback === "weekly" ? snapshot.weekly : snapshot.lowest;
}

function valueFor(window, settings) {
  return settings.basis === "used" ? window.usedPercent : window.remainingPercent;
}

function formatReset(seconds) {
  const value = Number(seconds || 0);
  if (value <= 0) {
    return "now";
  }
  const minutes = Math.ceil(value / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function ringArc(cx, cy, r, fraction) {
  const start = -140;
  const end = start + 280 * fraction;
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function polar(cx, cy, r, degrees) {
  const rad = (degrees - 90) * Math.PI / 180;
  return {
    x: Number((cx + r * Math.cos(rad)).toFixed(2)),
    y: Number((cy + r * Math.sin(rad)).toFixed(2)),
  };
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
