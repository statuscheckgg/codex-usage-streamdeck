# Marketplace Handoff

## Package

Built plugin installer:

`com.statuscheck.codex-usage.streamDeckPlugin`

Public release:

`https://github.com/statuscheckgg/codex-usage-streamdeck/releases/tag/v0.1.3`

## Current Status

- Stream Deck validation passes.
- Plugin packages successfully.
- Runtime has no npm dependencies.
- Users do not need npm, PowerShell, API Ninja, or a local server.
- Local websocket harness passes normal, critical, login, auth-expired, and endpoint-changed scenarios.
- The plugin has been installed into the local Stream Deck plugin directory and Stream Deck has been restarted.

## Listing Draft

Name:

`Codex Usage Monitor`

Short description:

`Track Codex 5-hour and weekly usage windows directly on your Stream Deck.`

Description:

`Codex Usage Monitor is an unofficial local Stream Deck plugin that shows Codex 5-hour and weekly usage windows using your existing Codex login. Choose from dual-bar, ring gauge, warning tile, and split-key visual modes. Configure thresholds, reset countdowns, single-window targeting, and optional mood indicators that update more frequently as limits get low.`

Disclosure:

`This plugin is unofficial and is not affiliated with OpenAI. It reads the local Codex auth file and sends authenticated usage requests only to OpenAI/ChatGPT. Tokens are not displayed, logged, or sent to the plugin author.`

Optional support note:

`This plugin is free. If it saves you time, optional support is welcome.`

## Required Marketplace Assets

- Thumbnail: `1920x960 PNG`
- Minimum 3 gallery items: `1920x960 PNG` or `1920x1080 MP4`
- Public support URL
- Public privacy policy URL
- Release notes

Generated local assets:

- `marketplace-assets\thumbnail-1920x960.png`
- `marketplace-assets\gallery-dual-bars-green.png`
- `marketplace-assets\gallery-ring-warning.png`
- `marketplace-assets\gallery-oh-no-critical.png`
- `marketplace-assets\gallery-property-inspector.png`

Public links:

- Support: `https://github.com/statuscheckgg/codex-usage-streamdeck/issues`
- Privacy: `https://github.com/statuscheckgg/codex-usage-streamdeck/blob/main/PRIVACY.md`
- Release notes: `https://github.com/statuscheckgg/codex-usage-streamdeck/blob/main/RELEASE_NOTES.md`
- Optional support: `https://buymeacoffee.com/statuscheck`

## Suggested Gallery Shots

- Dual bars normal green state
- Ring gauge warning state
- Warning and "Oh No" red state
- Property inspector settings

## First Release Notes

`Initial release with Codex 5-hour and weekly usage display, configurable visual modes, thresholds, reset countdowns, local Codex auth detection, optional Spark limit display, and adjustable mood indicators.`

## Review Risks

- Uses an internal Codex/ChatGPT usage endpoint rather than a documented public API.
- Reads local Codex auth, so the listing and property inspector must clearly disclose token handling.
- Needs beta testing on both Windows and macOS before Marketplace submission.
- Manual Stream Deck key placement and property-inspector interaction still need visual confirmation in the app.

## Submission Status

- GitHub repo published.
- v0.1.3 release created with the `.streamDeckPlugin` installer attached.
- Elgato `streamdeck validate` passes after public URL resolution.
- Remaining step is Maker Console upload and review submission.
