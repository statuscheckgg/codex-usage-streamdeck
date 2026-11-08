# Codex Usage Monitor Support

## First Checks

If the key shows `LOGIN CODEX`, open Codex or run `codex login`, then press the Stream Deck key to refresh.

If the key shows `AUTH SIGN IN`, refresh the normal Codex login. The plugin does not refresh tokens directly.

If the key shows `NETWORK RETRY`, confirm the machine can reach `https://chatgpt.com`.

If the key shows `API CHANGED`, the internal Codex usage endpoint or response shape may have changed.

## Plugin Behavior

- The plugin reads the explicit Auth path, otherwise `CODEX_HOME/auth.json`, otherwise `~/.codex/auth.json`.
- It sends read-only requests only to `https://chatgpt.com/backend-api/wham/usage` and `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`.
- It cannot apply or spend a reset. Pressing the key only refreshes displayed data.
- It does not display, log, store, or transmit tokens to the plugin author.
- End users do not need npm, PowerShell, API Ninja, or a local server.

## Useful Debug Info

- Plugin UUID: `com.statuscheck.codex-usage`
- Action UUID: `com.statuscheck.codex-usage.usage`
- Current version: `0.1.13.0`
- Local Stream Deck plugin folder on Windows: `%APPDATA%\Elgato\StreamDeck\Plugins\com.statuscheck.codex-usage.sdPlugin`

## Optional Support

Codex Usage Monitor is free, with no paywall. If it saves you time, optional support is welcome:

https://buymeacoffee.com/statuscheck

## Recovery diagnostics

- AUTH SIGN IN: the service rejected the login (401); run `codex login` with ChatGPT.
- ACCESS DENIED: the service returned 403; check the account/workspace access rather than assuming expiration.
- AUTH FILE UNREADABLE / INVALID: check file permissions or finish the normal Codex login flow.
- AUTH STORE CHECK: keyring, auto or ephemeral storage cannot be read by this build. Do not downgrade secure storage just for the plugin; select a known file only if you already use file-based Codex credentials.
- API KEY UNSUPPORTED: subscription usage requires ChatGPT sign-in.
- STALE: the displayed reading is historical, with age on the key. Network/timeouts/429/5xx retry automatically. Repeated presses respect the retry deadline.

The plugin checks auth/config changes every two seconds. CODEX_HOME must be visible in the Stream Deck process environment; an explicit Auth path overrides it. Never include auth.json, tokens, or raw account responses in a support report.
