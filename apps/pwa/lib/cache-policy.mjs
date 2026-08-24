export const consentNetworkOnly = {
  handler: "NetworkOnly",
  method: "GET",
  urlPattern: /\/(?:api\/public\/consents|consents)\/[^/?#]+(?:\/sign)?$/i,
};

export const consentRouteHeaders = [{
  headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  source: "/consents/:token",
}];
