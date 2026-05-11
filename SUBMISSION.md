# Elgato Marketplace Submission

## Product

- Name: `Codex Usage Monitor`
- Type: Stream Deck plugin
- Version: `0.1.6.0`
- Price: Free
- Author: `Status Check`
- Plugin file: `com.statuscheck.codex-usage.streamDeckPlugin`

## Description

Codex Usage Monitor is an unofficial local Stream Deck plugin that shows current Codex usage directly on a Stream Deck key. It uses the existing local Codex login to request usage data from ChatGPT, then displays remaining or used percentage for the 5-hour and weekly Codex usage windows.

The key refreshes automatically at a configurable interval and can also be refreshed manually by pressing the key. Display modes include dual bars for both quota windows, a ring gauge, a warning tile, and a split-key view. Single-window modes can show the lowest remaining window automatically or be locked to the 5-hour or weekly window.

Users can configure visual mode, remaining/used percentage basis, refresh timing, threshold colors, reset countdown labels, optional Spark/model-specific limit display, and optional mood indicators. Mood indicators and pulse behavior can be turned off, or left enabled so the key changes status more frequently as remaining usage gets low.

The plugin includes clear status screens for first-run and error states, including Login Codex, Auth Expired, Network Retry, and API Changed.

This plugin is unofficial and is not affiliated with OpenAI. It reads the local Codex auth file and sends authenticated usage requests only to OpenAI/ChatGPT. Tokens are not displayed, logged, stored by the plugin, or sent to the plugin author.

## Short Description

Track Codex 5-hour and weekly usage windows directly on your Stream Deck.

## Release Notes

Initial release with Codex 5-hour and weekly usage display, configurable visual modes, thresholds, reset countdowns, local Codex auth detection, optional Spark limit display, and adjustable mood indicators.

## Required Upload Files

- Product file: `com.statuscheck.codex-usage.streamDeckPlugin`
- Thumbnail: `marketplace-assets\thumbnail-1920x960.png`
- Gallery: `marketplace-assets\gallery-dual-bars-green.png`
- Gallery: `marketplace-assets\gallery-ring-warning.png`
- Gallery: `marketplace-assets\gallery-property-inspector.png`
- Gallery: `marketplace-assets\gallery-oh-no-critical.png`
- Demo video for Elgato review email: `marketplace-assets\codex-usage-monitor-demo.mp4`

## Links

- Product/support: `https://github.com/statuscheckgg/codex-usage-streamdeck`
- Issues: `https://github.com/statuscheckgg/codex-usage-streamdeck/issues`
- Privacy: `https://github.com/statuscheckgg/codex-usage-streamdeck/blob/main/PRIVACY.md`
- Release: `https://github.com/statuscheckgg/codex-usage-streamdeck/releases/tag/v0.1.6`
- Optional support: `https://buymeacoffee.com/statuscheck`

## Review Notes

- The plugin uses an internal Codex/ChatGPT usage endpoint, not a documented public OpenAI API.
- The Property Inspector and listing disclose that the plugin reads local Codex auth.
- The plugin does not refresh tokens directly; users refresh login through Codex.
- The plugin is free; the Buy Me a Coffee link is optional support only.
