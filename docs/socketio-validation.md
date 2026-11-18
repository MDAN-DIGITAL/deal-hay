# Socket.IO frontend integration

Browser code gets its public Socket.IO origin from the Laravel API and requests a short-lived ticket at `POST /api/private/realtime/socket-session` with the app session cookie and CSRF header. The WSS handshake receives the scoped ticket from memory. Reloading the page requires a fresh ticket from Laravel.

The adapter renews tickets, retries failed authentication with backoff, restores authorized subscriptions after reconnection, handles presence, and measures acknowledgement latency. Reverb/Pusher dependencies and frontend proxy endpoints have been removed.

Run `npm run test:socketio` and `npm run test:realtime`. Tests cover ticket isolation, private channels, presence, reconnects after authentication outages, direct API calls, multipart uploads, and idempotency headers. A deployed browser/API/WSS check is still required to verify DNS, TLS and allowed origins in the target environment.
