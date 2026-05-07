# Release Notes

## 0.1.1.0

- Bundles the official Stream Deck SDK runtime for Marketplace compatibility.
- Colors 5-hour and weekly quota indicators independently in dual-bar and split views.

## 0.1.0.0

Initial release.

- Display Codex 5-hour and weekly usage windows on a Stream Deck key.
- Show remaining or used percentage.
- Include visual modes: dual bars, ring gauge, weekly tile, warning tile, split key, and lowest remaining.
- Add configurable thresholds, reset countdowns, and optional mood/status indicators.
- Add login, auth-expired, network, and endpoint-changed error states.
- Read the existing local Codex login from `~/.codex/auth.json`.
- Send authenticated usage requests only to OpenAI/ChatGPT.
- No API Ninja, PowerShell, npm, or local server required for end users.
