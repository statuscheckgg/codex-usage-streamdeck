# Elgato Marketplace Submission

## Product

- Name: `Codex Usage Monitor`
- Type: Stream Deck plugin
- Version: `0.1.0.0`
- Price: Free
- Author: `Status Check`
- Plugin file: `com.statuscheck.codex-usage.streamDeckPlugin`

## Description

Codex Usage Monitor is an unofficial local Stream Deck plugin that shows Codex 5-hour and weekly usage windows using your existing Codex login. Choose from bar, ring, weekly tile, warning tile, split, and lowest-remaining visual modes. Configure thresholds, reset countdowns, and optional mood indicators that update more frequently as limits get low.

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
- Gallery: `marketplace-assets\gallery-oh-no-critical.png`
- Optional Gallery: `marketplace-assets\gallery-property-inspector.png`

## Links

- Product/support: `https://github.com/PokeyBrant/codex-usage-streamdeck`
- Issues: `https://github.com/PokeyBrant/codex-usage-streamdeck/issues`
- Privacy: `https://github.com/PokeyBrant/codex-usage-streamdeck/blob/main/PRIVACY.md`
- Release: `https://github.com/PokeyBrant/codex-usage-streamdeck/releases/tag/v0.1.0`

## Review Notes

- The plugin uses an internal Codex/ChatGPT usage endpoint, not a documented public OpenAI API.
- The Property Inspector and listing disclose that the plugin reads local Codex auth.
- The plugin does not refresh tokens directly; users refresh login through Codex.
