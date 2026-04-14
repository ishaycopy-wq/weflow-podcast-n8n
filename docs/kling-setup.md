# Kling AI — Setup Guide

**Tool**: Cinematic B-Roll Video Generation  
**Podcast Fit**: 7.5/10  
**Verified**: April 14, 2026  
**Pricing source**: https://klingai.com/pricing

---

## Recommended Plan

| Plan | Price | Credits/mo | API | Use case |
|------|-------|------------|-----|----------|
| Free | $0 | 66/day (1,980/mo) | No | UI testing |
| Standard | $10 | 660 | No | Manual UI use |
| **Pro** | **$37** | **3,000** | **Yes** | **Recommended baseline** |
| Premier | $92 | 8,000 | Yes | High volume |
| Ultra | $180 | 26,000 | Yes | Agency |

### Credit Packs (add-on)
| Pack | Price | Credits |
|------|-------|---------|
| Starter | $5 | 330 |
| Medium | $25 | 1,800 |
| Large | $90 | 7,200 |
| XL | $300 | 26,000 |

---

## Kling 3.0 API Pricing

| Generation | Standard | Professional |
|------------|----------|--------------|
| Text-to-Video 5s | $0.14 | $0.28 |
| Text-to-Video 10s | $0.28 | $0.56 |
| Lip Sync | $0.21 | $0.42 |
| Per-second | ~$0.075/s | ~$0.112/s |

---

## Kling 3.0 Capabilities

| Feature | Value |
|---------|-------|
| Max single generation | 15 seconds |
| Multi-shot sequences | Up to 6 shots per generation |
| Native audio | Yes — audio-visual synchronized |
| Lip sync | Yes |
| Resolution | Up to 2K (1080p standard) |
| Async pattern | POST task → poll task_id OR webhook callback |

---

## n8n Setup

No official or community n8n node exists for Kling AI — use the **HTTP Request** node.

1. Go to [klingai.com → Developer → API Keys](https://klingai.com/global/developer)
2. Generate an API key
3. In n8n: **HTTP Request** node → Authentication → **Generic Credential** → **Header Auth**
4. Header: `Authorization`, value: `Bearer YOUR_API_KEY`

### Async workflow pattern

```
POST /v1/videos/text2video  →  task_id
     ↓
Option A: Poll GET /v1/videos/text2video/{task_id} every 30s
Option B: Set callback_url in the POST body → Kling POSTs to your webhook when done (recommended)
```

> ⚠️ **Critical**: Generated video download URLs are **time-limited**. Your n8n workflow MUST download the video binary immediately when the task completes. Never store the CDN URL alone.

---

## Multi-Shot Sequence (Kling 3.0)

Kling 3.0 supports up to 6 shots in a single generation via the `guidances` array:

```json
{
  "model_name": "kling-v3",
  "prompt": "Podcast host discussing AI tools",
  "duration": "15",
  "guidances": [
    { "timestamp": "0s-3s",   "shot": "Wide establishing shot of podcast studio" },
    { "timestamp": "3s-7s",   "shot": "Close-up on host speaking with hand gestures" },
    { "timestamp": "7s-12s",  "shot": "Cut to screen showing data visualization" },
    { "timestamp": "12s-15s", "shot": "Pull back to wide shot, host smiling" }
  ],
  "motion_has_audio": true,
  "callback_url": "https://your-n8n.com/webhook/kling-done"
}
```

---

## Workflows in this repo

| File | Description |
|------|-------------|
| `kling-broll-auto-generator.json` | Webhook trigger → split script → Kling API → callback → download |

---

## Key API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/videos/text2video` | POST | Text-to-video |
| `/v1/videos/text2video/{task_id}` | GET | Poll task status |
| `/v1/videos/image2video` | POST | Image-to-video |
| `/v1/videos/lipsync` | POST | Lip sync |
| `/v3/video/text-to-video` | POST | Kling 3.0 endpoint (newer) |
| `/v3/task/{task_id}` | GET | Poll 3.0 task |

**Base URL**: `https://api.klingai.com`  
**Auth header**: `Authorization: Bearer YOUR_API_KEY`
