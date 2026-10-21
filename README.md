# Agent Share

Export Paseo agent sessions as public GitHub Gists with full markdown rendering.

## Features

- **One-click sharing**: Export any agent session to a public GitHub Gist
- **Full markdown rendering**: Gists render beautifully on GitHub with syntax highlighting
- **GitHub Device Authorization**: Secure OAuth flow - no manual token entry required
- **Clipboard integration**: Code and gist URLs automatically copied to clipboard
- **Fallback support**: Manual token entry if device auth fails

## Installation

Install via Paseo plugin registry:

```bash
paseo plugin add agent-share
```

Or install from source:

```bash
paseo plugin install /path/to/agent-share
```

## Usage

### First-time setup

1. Open Paseo
2. Press `⌘K` (macOS) or `Ctrl+K` (Windows/Linux)
3. Select "Setup GitHub Gist sharing"
4. The authorization code is copied to your clipboard
5. GitHub's device activation page opens automatically
6. Paste the code and authorize the app
7. Wait for authorization to complete

### Sharing a session

1. Open any agent in Paseo
2. Press `⌘K` or `Ctrl+K`
3. Select "Share session as Markdown"
4. The public gist URL is copied to your clipboard

## Development

```bash
npm install
npm run build
npm run typecheck
```

## License

MIT
