# Agent Share

Share Paseo agent sessions as public GitHub Gists with full markdown rendering.

## Features

- **One-click sharing**: Export any agent session to a public GitHub Gist — Command Center, `/share` slash command, or the Share pill in the agent composer
- **Full markdown rendering**: Gists render beautifully on GitHub with syntax highlighting
- **GitHub Device Authorization**: OAuth device flow in a proper settings screen — no manual token entry required
- **Persistent auth**: The token is stored in host plugin settings and survives daemon restarts
- **Timeline feedback**: Share results (and failures) are posted back into the session timeline as cards; gist URLs are copied to the clipboard
- **Fallback support**: Manual token entry if device auth is unavailable

## Installation

Install via the Paseo plugin registry:

```bash
paseo plugin add agent-share
```

Or install from source:

```bash
paseo plugin install /path/to/agent-share
```

## Usage

### First-time setup

1. Open Paseo → Command Center (`⌘K`/`Ctrl+K`) → **"Setup GitHub Gist sharing"** (also under Settings → Agent Share)
2. Click **Start** — a device code appears in the app
3. Open GitHub's activation page, enter the code, authorize
4. The screen confirms when you're connected — no restarts, no re-auth

### Sharing a session

- Command Center → **"Share session as Markdown"**, or
- Type `/share` in the agent composer, or
- Click the **Share** pill in the composer

The public gist URL is copied to your clipboard and a card with the link is posted into the session timeline.

### Heads up

Gists are **public** — anyone with the link can read the export, which includes file contents and working-directory metadata shown in the session. Share accordingly.

## Development

```bash
npm install
npm run build
npm run typecheck
```

## License

MIT
