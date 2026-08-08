# Contact Form Worker (Cloudflare Worker + GoDaddy SMTP)

Receives the contact form from the CIYENT TECHNOLOGIES website, validates it
server-side, and emails it to `support@ciyent.com` over SMTP.

- No secrets live in the frontend or this repo. Credentials are Cloudflare
  Worker secrets (encrypted at rest, injected at runtime).
- Uses GoDaddy SMTP (`smtpout.secureserver.net:465`, implicit TLS) with an
  in-repo SMTP client built on `cloudflare:sockets` — no third-party deps.
- Includes server-side validation, a honeypot, CORS allow-list, and per-minute
  rate limiting (when a KV namespace is configured).

## Environment variables

### Secrets — `wrangler secret put <NAME>`

| Variable       | Required | Description                                        |
| -------------- | -------- | -------------------------------------------------- |
| `SMTP_HOST`    | yes      | SMTP server, e.g. `smtpout.secureserver.net`       |
| `SMTP_PORT`    | yes      | Usually `465` (implicit TLS)                       |
| `SMTP_USER`    | yes      | Full email address, e.g. `support@ciyent.com`      |
| `SMTP_PASSWORD`| yes      | The email account's password / app password        |
| `FROM_EMAIL`   | no       | Sender address (defaults to `SMTP_USER`)           |
| `TO_EMAIL`     | no       | Recipient (defaults to `SMTP_USER`)                |

### Plain vars — `[vars]` in `wrangler.toml`

| Variable           | Default              | Description                                    |
| ------------------ | -------------------- | ---------------------------------------------- |
| `ALLOWED_ORIGIN`   | `https://ciyent.com` | Comma-separated origins allowed to call worker |

### Optional KV for rate limiting

Uncomment the `kv_namespaces` block in `wrangler.toml` and create a KV
namespace (`wrangler kv namespace create RATE_COUNTER`) to enable per-minute
throttling. Without KV, rate limiting is skipped (validation + honeypot still
apply).

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in real values, use localhost origin
npx wrangler dev
```

## Deploy

```bash
npx wrangler deploy
npx wrangler secret put SMTP_HOST
npx wrangler secret put SMTP_PORT
npx wrangler secret put SMTP_USER
npx wrangler secret put SMTP_PASSWORD
```

Set `ALLOWED_ORIGIN` in `wrangler.toml` to the production site
(`https://ciyent.com`). Then update `contactEndpoint` in `hugo.toml` to the
worker URL shown by `wrangler deploy` (e.g. `https://ciyent-contact.<your-subdomain>.workers.dev`).

## Request / response

`POST` with `Content-Type: application/json`:

```json
{
  "name": "Akshay",
  "company": "Acme",
  "email": "akshay@example.com",
  "phone": "+91 98765 43210",
  "service": "IT Support & AMC",
  "message": "Please help with our office network."
}
```

Returns `{ "ok": true }` on success, or `{ "ok": false, "error": "...", "errors": {...} }`
with a 4xx/5xx status. Email uses `Reply-To` set to the visitor's address.
