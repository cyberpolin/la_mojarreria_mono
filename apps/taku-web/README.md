# TAKU Web

## WhatsApp console

The internal WhatsApp console lives at `/whatsapp`.

It talks to `taku-api-service` with the existing TAKU session headers. TAKU API
then proxies to `wa-service`, so the browser never receives the `wa-service`
API key.

Required production env values:

```env
NEXT_PUBLIC_TAKU_API_BASE_URL=https://api.taku.lat
NEXT_PUBLIC_TAKU_API_KEY=...
```

Current sync behavior:

- Initial state is loaded from `GET /v1/wa-chat/conversations`.
- The active chat history is loaded from
  `GET /v1/wa-chat/conversations/:phone/messages`.
- Messages are sent through
  `POST /v1/wa-chat/conversations/:phone/messages`.
- The UI polls every few seconds and upserts by stable message ID to avoid
  duplicates after refreshes or backend restarts.

TODO:

- Replace polling with websocket events when `wa-service` exposes chat events.
- Add media download once `wa-service` stores and exposes message media.
- Add deep search across the full persisted message store.
- Add per-user permissions for inbox access.
- Add group metadata and contact names when the backend exposes them.
