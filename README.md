# Codex Usage Monitor for Stream Deck

Unofficial local Stream Deck plugin for monitoring Codex usage windows.

The plugin displays Codex usage from the local Codex login:

- 5-hour usage window
- Weekly usage window
- Reset countdowns
- Optional extra model-specific limits such as Spark
- Configurable visual modes, thresholds, and mood indicators

## User Experience

Marketplace users should not need Node.js, npm, Stream Deck CLI, PowerShell, API Ninja, or a local bridge server.

Expected setup:

1. Install the plugin from Marketplace.
2. Drag `Codex Usage` onto a key.
3. Sign into Codex normally if needed.
4. The key displays current usage.

## Install For Testing

Download or build `com.statuscheck.codex-usage.streamDeckPlugin`, then double-click it to install into Stream Deck.

Current local package path during development:

`C:\Vibes\Projects\Personal\Codex-Usage-StreamDeck\com.statuscheck.codex-usage.streamDeckPlugin`

## Display Modes

- Dual bars
- Ring gauge
- Warning tile
- Split key

The Property Inspector also includes refresh interval, threshold, reset-label, Spark-limit, and mood-indicator controls.

## Security Model

This plugin reads the user's local Codex auth file:

- Windows: `%USERPROFILE%\.codex\auth.json`
- macOS: `~/.codex/auth.json`

It uses the stored Codex ChatGPT access token and account id to request:

`https://chatgpt.com/backend-api/wham/usage`

Tokens are not displayed, logged, or sent anywhere except OpenAI/ChatGPT.

The plugin does not use the refresh token. If the access token is stale, the key shows a login/auth state and the user should refresh their Codex login through Codex itself.

## Development

Check syntax:

```powershell
npm run check
```

Validate:

```powershell
npm run validate
```

Package:

```powershell
npm run pack
```

## Marketplace Notes

This is an unofficial plugin and should not imply affiliation with OpenAI.

The Marketplace listing and property inspector must disclose that the plugin reads local Codex auth and calls OpenAI/ChatGPT usage endpoints.

## Support

Use GitHub issues for support:

https://github.com/statuscheckgg/codex-usage-streamdeck/issues

This plugin is free. If it saves you time, optional support is welcome:

Don't pay me. This took me 2-3 hours because I was mad about paying 4+ bucks.

https://buymeacoffee.com/statuscheck
