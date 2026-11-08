# Privacy Policy

Codex Usage Monitor is a local Stream Deck plugin.

## Data Accessed

The plugin reads the local Codex authentication file on the user's computer:

- Windows: `%USERPROFILE%\.codex\auth.json`
- macOS: `~/.codex/auth.json`

An explicit **Auth path** takes precedence; otherwise `CODEX_HOME/auth.json` is used when that environment variable is visible to Stream Deck. The plugin also reads the root credential-storage setting in `config.toml` next to the default auth file. Restart Stream Deck after changing its environment.

File storage is supported. Keyring, automatic, and ephemeral modes are reported explicitly as unsupported: the plugin does not silently fall back to an old file when Codex may use another store. An explicit Auth path deliberately selects a known file. No browser cookies or unrelated application tokens are scanned.

The plugin uses the Codex access token and ChatGPT account id from that file to request Codex usage and banked-reset details from OpenAI/ChatGPT.

## Data Sent

The plugin sends authenticated requests only to:

- `https://chatgpt.com/backend-api/wham/usage`
- `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`

The plugin does not send user data, tokens, usage data, analytics, or telemetry to the plugin author or any third party.

Both requests are read-only. The plugin does not call a reset-consumption endpoint and cannot apply or spend a reset.

## Data Stored

The plugin stores only Stream Deck action settings, such as display mode, refresh interval, thresholds, reset visibility, flicker intervals, and 12 or 24-hour clock preference.

The plugin does not persist a copy of the Codex token. Usage readings and retry state are cached only in process memory; credentials are read for requests and are not stored in Stream Deck settings.

## Token Handling

Tokens are not displayed in the UI, not logged, and not included in generated key images.

The plugin does not use the Codex refresh token. If authentication expires, the user must refresh their Codex login through Codex.
