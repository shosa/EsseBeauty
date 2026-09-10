// Native (non-Docker) dev-time equivalent of gateway/nginx.conf: listens on
// the port every frontend's NEXT_PUBLIC_API_URL already points at and
// forwards to apps/api, apps/communications, or apps/loyalty-marketing by
// path, so a local `pnpm run dev` doesn't need Docker to see the three
// backends as one origin.
import { createServer, request as httpRequest } from "node:http";

const PORT = Number(process.env.GATEWAY_PORT ?? 3001);
const API_TARGET = process.env.API_INTERNAL_PORT ?? 3011;
const COMMUNICATIONS_TARGET = process.env.COMMUNICATIONS_PORT ?? 3013;
const LOYALTY_MARKETING_TARGET = process.env.LOYALTY_MARKETING_PORT ?? 3006;

const COMMUNICATIONS_PATTERNS = [
  /^\/api\/salons\/[^/]+\/(communications|reminders|reviews|review-invitations)(\/|$)/,
  /^\/api\/public\/reviews\//,
  /^\/api\/webhooks\/whatsapp\//,
];

const LOYALTY_MARKETING_PATTERNS = [
  /^\/api\/salons\/[^/]+\/(loyalty|campaigns|campaign-templates)(\/|$)/,
  /^\/api\/public\/[^/]+\/loyalty(\/|$)/,
];

function targetPortFor(url) {
  if (COMMUNICATIONS_PATTERNS.some((pattern) => pattern.test(url))) return COMMUNICATIONS_TARGET;
  if (LOYALTY_MARKETING_PATTERNS.some((pattern) => pattern.test(url))) return LOYALTY_MARKETING_TARGET;
  return API_TARGET;
}

const server = createServer((clientRequest, clientResponse) => {
  const port = targetPortFor(clientRequest.url ?? "/");
  const proxied = httpRequest(
    {
      headers: clientRequest.headers,
      host: "127.0.0.1",
      method: clientRequest.method,
      path: clientRequest.url,
      port,
    },
    (upstreamResponse) => {
      clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(clientResponse);
    },
  );
  proxied.on("error", () => {
    if (!clientResponse.headersSent) clientResponse.writeHead(502);
    clientResponse.end();
  });
  clientRequest.pipe(proxied);
});

server.listen(PORT, () => {
  console.log(`[dev-gateway] listening on :${PORT} -> api::${API_TARGET}, communications::${COMMUNICATIONS_TARGET}, loyalty-marketing::${LOYALTY_MARKETING_TARGET}`);
});
