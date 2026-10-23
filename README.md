# Contest website — Netlify persistent entries

## Publish
1. Upload this folder to your existing GitHub repository (including `netlify/functions`, `package.json`, `netlify.toml`). Deploy via the linked Netlify project. **Do not use only drag-and-drop static deployment:** Functions require a build/deploy with function support.
2. In Netlify > Project configuration > Environment variables, add `CONTEST_ADMIN_KEY` with a long random password; apply it to Functions and redeploy. Keep it private.
3. Verify the project uses Node 20 or newer and installs dependencies during deployment.
4. Make a test entry with a small attachment. A confirmation page at `result.html` should open only after Netlify confirms storage.

## Where entries go
- Netlify Blobs site-wide store: `contest-private`
- Individual entry records: `entries/<uuid>.json`
- CSV snapshot: `exports/entries.csv`
- Files by contestant name: `uploads/<Contestant_Name>/<uuid>/<original_filename>` (virtual folders; name collisions remain separated by UUID).

## Export CSV privately
Use this in a terminal (replace domain and secret):
`curl -H "x-contest-key: YOUR_SECRET" https://YOUR_SITE.netlify.app/.netlify/functions/export -o contest_entries.csv`
The export reconstructs the complete CSV from all entries, so overlapping entries are not lost even if the convenient CSV snapshot update races.

## Download an attached file privately
Find `file_key` in the CSV and run:
`curl -G -H "x-contest-key: YOUR_SECRET" --data-urlencode "file=uploads/NAME/UUID/FILE.pdf" https://YOUR_SITE.netlify.app/.netlify/functions/export -o attachment.pdf`

**Limits:** single file maximum 3 MB; allowed PDF, Word, PowerPoint, Excel, images and ZIP. Netlify Functions impose a request limit, so do not increase this without checking plan limits. Netlify Blobs persist across deploys, but are a key-value store rather than a transactional database; keep periodic private CSV backups. Access to downloads and CSV exports requires the secret. Browser entries use HTTPS.

## Version 8 phone field
- Email was replaced by a free-entry phone field, with no format or country-code checks.
- CSV column is `phone` rather than `email`. Existing V7 records may retain email in historic entries; the new export does not expose the historic email field.
- Consent, entry size limits, and file-type limits are retained for security and dependable storage.

## Version 10
- Course dropdown and Other field removed.
- CSV no longer includes a course column. Previous entries remain saved, but course is not part of the new export.

## Safer publish layout
The deploy-ready edition puts public pages in `public/`, while `netlify/functions` and `package.json` remain outside the published folder. Use Netlify publish directory `public` and functions directory `netlify/functions` (configured in netlify.toml). Do not publish the repository root as a static website.
