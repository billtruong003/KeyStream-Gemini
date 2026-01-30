# KeyStream-Gemini

KeyStream-Gemini is a high-performance reverse proxy designed to optimize Google Gemini API usage through intelligent key rotation and real-time monitoring. It ensures high availability and bypasses rate limits by dynamically managing a pool of API keys.

## Core Features

- **Dynamic Key Rotation**: Automatically cycles through API keys to maintain continuous service availability.
- **Real-time Observability**: Web-based dashboard featuring traffic metrics, key health status, and backend logs.
- **Model Synchronization**: Automated discovery and update of available Gemini models via Google API.
- **Native Streaming Support**: Optimized handling of Server-Sent Events (SSE) for fluid AI interactions.
- **OpenAI Compatibility**: Standardized interface for seamless integration with tools like Continue.dev.

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or Yarn
- Google Gemini API Keys

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/billtruong003/KeyStream-Gemini.git
   cd KeyStream-Gemini
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the key store**
   Create a `keys.json` file in the root directory:
   - macOS/Linux: `echo "[]" > keys.json`
   - Windows: `Set-Content -Path ".\keys.json" -Value "[]"`

4. **Start the server**
   ```bash
   npm start
   ```
   The gateway will be accessible at `http://localhost:13337`.

## Integration

KeyStream-Gemini provides an OpenAI-compatible endpoint. To integrate with your AI tools, use the following configuration:

- **Base URL**: `http://localhost:13337/v1`
- **API Key**: `sk-keystream` (The proxy handles actual authentication)

### Example Configuration (Continue.dev)

```yaml
models:
  - name: "⚡ gemini-3-pro-preview"
    model: "gemini-3-pro-preview"
    provider: openai
    apiBase: "http://localhost:13337/v1"
    apiKey: "sk-local-proxy"
    contextLength: 128000
```

## Development

To run the server in development mode with auto-reload:

```bash
npm install -g nodemon
nodemon server.js
```

## License

Distributed under the MIT License.