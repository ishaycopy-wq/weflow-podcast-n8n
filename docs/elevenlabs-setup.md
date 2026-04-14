# ElevenLabs — Setup Guide

**Tool**: Voice Cloning & TTS  
**Podcast Fit**: 9.4/10  
**Verified**: April 14, 2026  
**Pricing source**: https://elevenlabs.io/pricing

---

## Recommended Plan

| Plan | Price | Chars/mo | API | Use case |
|------|-------|----------|-----|----------|
| Free | $0 | 10K | Limited | Testing only |
| Starter | $5 | 30K | Yes | Dev / light usage |
| **Creator** | **$22** | **100K** | **Yes (192kbps)** | **Solo podcaster — recommended** |
| Pro | $99 | 500K | Full + 44.1kHz PCM | High volume |
| Scale | $330 | 2M | Full + Priority | Agency |
| Business | $1,320 | 11M | Low-latency | Enterprise |

**Overage**: ~$0.30/min (Creator) → ~$0.24/min (Pro)

---

## n8n Setup

### Install the node
1. In n8n, click **+** → search `ElevenLabs`
2. Click **Install node** (official verified node)

### Create API key
1. Go to [elevenlabs.io → Developers → Create API key](https://elevenlabs.io/app/speech-synthesis)
2. Grant: **Text to Speech**, **Voice Cloning**
3. Copy the key

### Add credential in n8n
1. Go to **Credentials → New → ElevenLabs**
2. Paste API key → **Save & Test**

### Get your Voice ID
- Dashboard → **Voices** → click your cloned voice → copy the **Voice ID** from the URL or details panel

---

## Recommended Models

| Model ID | Use case | Latency |
|----------|----------|---------|
| `eleven_turbo_v2_5` | n8n pipelines, real-time | ~300ms |
| `eleven_multilingual_v2` | Podcast narration, 32 languages | ~800ms |
| `eleven_flash_v2_5` | High-volume batch | ~200ms |

---

## Workflows in this repo

| File | Description |
|------|-------------|
| `elevenlabs-podcast-voice-generator.json` | Daily schedule → GPT script → TTS → Drive → Telegram |
| `elevenlabs-voice-agent-webhook.json` | Receives callbacks from ElevenLabs Voice Agent conversations |

---

## Key API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/text-to-speech/{voice_id}` | POST | Generate audio (binary) |
| `/v1/text-to-speech/{voice_id}/stream` | POST | Stream via WebSocket |
| `/v1/voices` | GET | List all voices |
| `/v1/voices/add` | POST | Add instant voice clone |
| `/v1/dubbing` | POST | Dubbing Studio |

**Base URL**: `https://api.elevenlabs.io`  
**Auth header**: `xi-api-key: YOUR_API_KEY`
