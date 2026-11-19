# Private school email review (preview)

This feature is restricted to /preview. Sample mode is fictional and local. Live mode is opt-in and requires a separate high-entropy access key (not the household PIN).

## Setup

1. In Microsoft Entra App registrations, register a Web application supporting personal Microsoft accounts. Add this exact redirect URI:
   https://feta.topcat57691.workers.dev/api/preview/email-review/callback
2. Add Microsoft Graph delegated Mail.Read permission and allow offline_access. No Mail.ReadWrite, Send or calendar write scope. Create a client secret.
3. With Wrangler authenticated to the existing FETA account, run:
   ```sh
   npx wrangler secret put MICROSOFT_CLIENT_ID
   npx wrangler secret put MICROSOFT_CLIENT_SECRET
   npx wrangler secret put MICROSOFT_TOKEN_ENCRYPTION_KEY
   npx wrangler secret put EMAIL_REVIEW_ACCESS_KEY
   npx wrangler secret put MICROSOFT_SCHOOL_FOLDER_ID
   ```
   Generate each of the access key and encryption key independently with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   Save them securely; never paste them into GitHub or chat. The folder ID is optional but required to include the existing Abbey Farm folder; obtain it from Microsoft Graph's GET /me/mailFolders endpoint under the same signed-in account. Inbox and Junk work without it.
4. Deploy after CI passes. The AI binding is in wrangler.jsonc; no separate AI API key is needed. Stay on Workers Free (check actual account plan and shared AI usage in Cloudflare). Do not enable paid usage to make this feature work.
5. Visit /preview, select real data, enter the access key, choose Connect Outlook and consent. Enter the access key again after returning. Sample data is accessible without secrets.

## Behaviour and limitations

- Existing 15-minute cron rotates Inbox, Junk and optional school folder (each folder roughly every 45 minutes with all three configured). Initial sync is limited to the last 30 days. Graph delta pagination advances one page per invocation. Immutable IDs deduplicate moves. Only allowlisted sender metadata is used to decide which message bodies to fetch.
- Email review uses a single Workers AI JSON-mode call for summary and suggestions; validation rejects malformed output. No attachments or linked newsletters are downloaded. URLs are stripped before inference and the prompt requests omission of sensitive personal details; filtering cannot guarantee anonymisation. Do not treat model output as authoritative. Open the source in Outlook to verify any action.
- A daily application cap of 20 AI attempts bounds usage. This does not measure account-wide neuron consumption; free-plan limits are still the hard guard. A provider failure leaves the cursor unchanged for retry. Malformed model output creates a review item linking to the original rather than inventing dates or actions. No raw message bodies are persisted. Auth messages are excluded.
- The review data is not included in shared household state or wall display. The access key is held in memory only. Tokens are encrypted in D1; the app never marks, moves or sends mail. Disconnect deletes imported data and credentials (revoke Microsoft consent separately to invalidate tokens).
- Approval saves preview-only task/event suggestions. It does not create Google Calendar events or modify live household views. Review date/time before approval. Existing calendar permission is read-only.
- Existing FETA is publicly reachable. Treat the access key as a password and do not share it with children or on wall tablets. A production-grade identity/session mechanism is recommended before expanding private data features. Do not use real data until the security and provider integration have been validated.
- Test with sample data, then verify the configured school folder, Junk, delta cursor, credential refresh, quota exhaustion and failure handling before relying on automation. No private email contents are committed as sample data.
