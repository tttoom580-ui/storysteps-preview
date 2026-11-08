# StorySteps reading study

Opt-in event collection for the GitHub Pages site. The study uses a random browser ID; counts are browsers, not people. Consent is off until chosen. Events are not backfilled. Feedback is sent only when a reader submits its form. No names, lookup text, story prose, IP address, or user-agent fields are stored in D1 by this application. The hosting provider still processes connection metadata.

Public endpoint: `https://storysteps-reading-study.tttoom580-storysteps.workers.dev`

- `GET /health`: service status.
- `POST /events`: UUID deduplication, known event/book/chapter IDs, 8KB body limit, 200 events/browser/day.
- `POST /feedback`: at most 1000 characters, 10 reports/browser/day; private storage only.
- `GET /stats`: 30-day aggregate counts, no browser IDs or feedback text.
- Daily retention job removes records older than 90 days. No API secrets are shipped to the frontend.

CORS allows the GitHub Pages origin. It is not authentication or bot prevention. Browser IDs can be reset and automation can distort counts; do not treat them as independently verified people or ad billing records.

Owner can review private reports in Cloudflare D1 `storysteps-reading-study`, using its authenticated dashboard console:

```sql
SELECT book,chapter,paragraph,kind,message,datetime(created/1000,'unixepoch','+8 hours') AS taiwan_time
FROM feedback ORDER BY created DESC LIMIT 100;
```

Deployment via Wrangler bundles the JSON import. For direct multipart API upload, replace the JSON import with the `allowed.json` literal before uploading the ESM file (Cloudflare's raw multipart upload does not accept JSON modules).
