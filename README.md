# MailSentry — mail-to-wx Worker

An AI email secretary running on Cloudflare Workers: every incoming email is
parsed, distilled into a 3-line digest by an open-weight LLM
(`@cf/meta/llama-3.2-3b-instruct` via Workers AI), and pushed to your phone
through a WeCom webhook. The original email is forwarded to your real inbox
untouched.

**Important emails never get missed. Noise never interrupts you.**

## How it works

```
Email Routing ──► Worker (email handler)
                      ├─► postal-mime: parse MIME, strip HTML, truncate to 2k chars
                      ├─► Workers AI: 3-section digest (summary / key facts / action items)
                      ├─► WeCom webhook: push digest as plain-text message
                      └─► message.forward(): original → your real inbox
```

## Deploy

```bash
npm install
npx wrangler login
npx wrangler secret put WECOM_WEBHOOK_URL   # paste your WeCom bot webhook
# edit wrangler.jsonc → vars.FORWARD_TO_EMAIL
npx wrangler deploy
```

Then in the Cloudflare dashboard: **Email → Email Routing → Routes** → add a
custom address → action **Send to a Worker** → select `mail-to-wx`.

## Why open weights

- **Cost:** a 3B open model on Workers AI costs ~nothing per email, which is
  what makes a ¥29/mo price point viable. Per-token closed-API pricing would
  eat the margin.
- **Privacy:** email is the most sensitive data you own. The model is a
  replaceable one-line string — the same prompt runs on a self-hosted Ollama
  instance with zero code changes.
- **No lock-in:** swap to any newer open model with a one-line diff.

## Self-hosted alternative

See the companion n8n workflow: polls mailboxes over IMAP and pushes via the
WeCom app API — same product, zero Cloudflare dependency.

## License

MIT
