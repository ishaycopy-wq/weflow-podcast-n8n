# HeyGen — Setup Guide

**Tool**: AI Avatar Video Generation  
**Podcast Fit**: 8.8/10  
**Verified**: April 14, 2026  
**Pricing source**: https://help.heygen.com/en/articles/9204682

---

## Recommended Plan

| Plan | Price | Premium Credits | API | Use case |
|------|-------|-----------------|-----|----------|
| Free | $0 | None | No | Testing UI only |
| **Creator** | **$29** | **200/mo** | **Yes** | **Solo podcaster — limited API** |
| Pro | $99 | More | Yes | Growing production |
| Business | $149 + $20/seat | More | Yes | Team |
| Scale API | $330 | Custom | Yes | Production automation |

### ⚠️ Credit Economics

- **Avatar IV** (most realistic): **20 credits/minute**
- Creator 200 credits = **only 10 minutes of Avatar IV per month**
- Scale API: $0.50/credit → 1,000 min = $10,000/month
- For n8n automation at scale, **Scale API ($330/mo)** is required

---

## n8n Setup (Community Node)

1. Go to **Settings → Community Nodes** in n8n
2. Install: `n8n-nodes-heygen`
3. Get API key from [HeyGen Developer Portal](https://app.heygen.com/settings?nav=API)
4. Add credential in n8n → paste API key → Save
5. Insert HeyGen node → choose **Generate Video**
6. Set `avatar_id` and `voice_id` (see below)
7. **Add a Wait node (5 min)** before status polling

> **Alternative**: Use the HTTP Request node directly (more control, no community node required). All workflows in this repo use the HTTP Request approach for portability.

### Get your IDs
- **Avatar IDs**: HeyGen dashboard → **Avatars** → click avatar → copy ID from URL
- **Voice IDs**: HeyGen dashboard → **Voices** → copy ID

---

## Async Pattern

HeyGen video generation is always async. The pattern:

1. POST `/v2/video/generate` → returns `video_id`
2. Wait 2–10 minutes (depends on length)
3. GET `/v1/video_status.get?video_id={id}` → poll until `status === "completed"`
4. Response includes `video_url`

---

## Workflows in this repo

| File | Description |
|------|-------------|
| `heygen-podcast-clip-creator.json` | Telegram trigger → GPT script → HeyGen avatar → wait → poll status |

---

## Key API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/video/generate` | POST | Create avatar video (async) |
| `/v1/video_status.get` | GET | Poll by video_id |
| `/v2/avatars` | GET | List avatars |
| `/v2/voices` | GET | List voices |
| `/v1/video.translate` | POST | Translate existing video |
| `/v2/lipsync` | POST | Lip sync audio to video |

**Base URL**: `https://api.heygen.com`  
**Auth header**: `X-Api-Key: YOUR_API_KEY`
