# weflow-podcast-n8n

> n8n workflow library for the WeFlow-X AI Podcast Production Stack — ElevenLabs · HeyGen · Kling AI

**Part of [WeFlow-X](https://weflowx.com) — AI Business Operating System**

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![Verified](https://img.shields.io/badge/Pricing%20Verified-April%202026-blue)](docs/cost-tracker.md)
[![Dashboard](https://img.shields.io/badge/Interactive%20Dashboard-Live-cyan)](https://www.perplexity.ai/computer/a/ai-podcast-stack-2026-mqQDzPn9TfWwsEAuPfTtPg)

---

## What's in this repo

Importable n8n workflow JSONs, setup guides, and cost data for a fully automated podcast production pipeline. All workflows follow WeFlow-X architecture principles: **n8n is async orchestration only**, never on the hot path.

---

## Stack Overview

| Tool | Role | Podcast Fit | Baseline Plan |
|------|------|-------------|---------------|
| [ElevenLabs](https://elevenlabs.io) | Voice Cloning & TTS | ⭐ 9.4/10 | Creator $22/mo |
| [HeyGen](https://heygen.com) | AI Avatar Video | ⭐ 8.8/10 | Creator $29/mo (optional) |
| [Kling AI](https://klingai.com) | Cinematic B-Roll | ⭐ 7.5/10 | Pro $37/mo |

**Baseline cost (ElevenLabs + Kling)**: **$59/mo**  
**Full stack (add HeyGen)**: **$88/mo**  
**Estimated cost per 60-second episode**: **~$2.13**

---

## Workflows

```
workflows/
├── master-podcast-pipeline.json          ← Full end-to-end orchestrator
├── elevenlabs-podcast-voice-generator.json  ← Schedule → Script → TTS → Drive → Telegram
├── elevenlabs-voice-agent-webhook.json   ← ElevenLabs Voice Agent callback handler
├── heygen-podcast-clip-creator.json     ← Telegram → Script → HeyGen avatar → poll
└── kling-broll-auto-generator.json      ← Script → Kling b-roll → callback → download
```

### Master Pipeline

`master-podcast-pipeline.json` — the full orchestrator.

**Flow**:
```
POST /start-podcast (topic + IDs)
  ↓
GPT-4o writes script (narration + intro_sentence + segments)
  ↓
[PARALLEL]
  A. ElevenLabs TTS → MP3 voice track (sync, returns binary)
  B. HeyGen Avatar Intro → async (returns video_id)
  C. Kling AI B-Roll per segment → async (returns task_id + webhook)
  ↓
Merge Results
  ↓
Telegram: pipeline status + all job IDs
```

### ElevenLabs Workflows

1. **`elevenlabs-podcast-voice-generator.json`** — Daily schedule trigger → GPT-4o script → ElevenLabs TTS (eleven_turbo_v2_5) → Google Drive upload → Telegram notification.

2. **`elevenlabs-voice-agent-webhook.json`** — Webhook receiver for ElevenLabs Voice Agent conversation callbacks. Extracts transcript, conversation ID, and latest message for downstream processing.

### HeyGen Workflow

**`heygen-podcast-clip-creator.json`** — Telegram-triggered. Receives topic, writes 60-second script via GPT-4o, submits to HeyGen for avatar video, waits 5 minutes, polls for completion.

> ⚠️ Creator plan = 200 Premium Credits = only **10 min Avatar IV/month**. For production automation, you need Scale API ($330/mo).

### Kling AI Workflow

**`kling-broll-auto-generator.json`** — Webhook-triggered. Splits script into segments, submits each to Kling 3.0 (kling-v3) for b-roll generation, receives async webhook callbacks, and downloads video binaries immediately.

> ⚠️ Generated video URLs are **time-limited**. The workflow downloads the binary on callback — do not store CDN URLs alone.

---

## Quick Start

### 1. Import a workflow

In your n8n instance:
1. Go to **Workflows → Import**
2. Paste or upload the JSON file
3. Configure credentials (see setup guides below)
4. Replace placeholder values (`YOUR_VOICE_CLONE_ID`, `YOUR_AVATAR_ID`, etc.)
5. Activate

### 2. Set up credentials

| Credential name in n8n | Tool | Where to get it |
|------------------------|------|-----------------|
| `ElevenLabs account` | ElevenLabs | [elevenlabs.io → Developers](https://elevenlabs.io/app/speech-synthesis) |
| `HeyGen API Key` | HeyGen | [app.heygen.com → Settings → API](https://app.heygen.com/settings?nav=API) |
| `Kling AI API Key` | Kling AI | [klingai.com → Developer](https://klingai.com/global/developer) |
| `Google Drive account` | Google Drive | n8n OAuth2 flow |
| `Telegram account` | Telegram | n8n bot token setup |

### 3. Replace placeholder values

Search each workflow JSON for these and replace with your real values:

| Placeholder | Where to find your value |
|-------------|--------------------------|
| `YOUR_VOICE_CLONE_ID` | ElevenLabs dashboard → Voices |
| `YOUR_AVATAR_ID` | HeyGen dashboard → Avatars |
| `YOUR_VOICE_ID` | HeyGen dashboard → Voices |
| `YOUR_GOOGLE_DRIVE_FOLDER_ID` | Drive URL: `...folders/{ID}` |
| `YOUR_TELEGRAM_CHAT_ID` | Send a message to @userinfobot |
| `YOUR-N8N-INSTANCE.com` | Your n8n public URL (for webhooks) |

---

## Setup Guides

- [ElevenLabs Setup](docs/elevenlabs-setup.md) — plans, node install, voice IDs, API reference
- [HeyGen Setup](docs/heygen-setup.md) — plans, credit economics, async pattern, API reference
- [Kling AI Setup](docs/kling-setup.md) — plans, Kling 3.0 capabilities, multi-shot sequences, callback pattern
- [Cost Tracker](docs/cost-tracker.md) — monthly estimates, per-episode costs, upgrade triggers

---

## Architecture Principles (WeFlow-X)

1. **n8n is async orchestration only** — never on the hot path, never blocking UI
2. **Every long-running job submits and returns a job ID** — completion via webhook/callback
3. **Download binaries immediately** — never store time-limited CDN URLs (Kling)
4. **Parallel generation** — ElevenLabs, HeyGen, and Kling run concurrently in the master pipeline
5. **Result Panel** — every job should surface steps, artifacts, and timestamps to the UI

---

## Resources

| Resource | Link |
|----------|------|
| Interactive Dashboard (pricing, radar charts, upgrade engine) | [AI Podcast Stack 2026](https://www.perplexity.ai/computer/a/ai-podcast-stack-2026-mqQDzPn9TfWwsEAuPfTtPg) |
| Living Notion Reference Doc | [Notion](https://app.notion.com/p/34145a8c529f8165b6b7e011bdcd1827) |
| Monthly Cost Tracker | [Notion Database](https://app.notion.com/p/424bad7b27504087828a29c3097cec76) |
| ElevenLabs Pricing | https://elevenlabs.io/pricing |
| HeyGen Credit Docs | https://help.heygen.com/en/articles/9204682 |
| Kling AI Pricing | https://klingai.com/pricing |

---

## License

MIT — see [LICENSE](LICENSE)

---

*Pricing verified April 14, 2026. All workflow JSONs are import-ready into n8n Cloud or self-hosted n8n.*
