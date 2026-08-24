export const consentNetworkOnly = {
  handler: "NetworkOnly",
  method: "GET",
  urlPattern: /\/(?:api\/public\/consents|consents)\/[^/?#]+(?:\/sign)?$/i,
};

export const consentRouteHeaders = [{
  headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  source: "/consents/:token",
}];

export const reviewNetworkOnly = {
  handler: "NetworkOnly",
  method: "GET",
  urlPattern: /\/(?:api\/public\/reviews\/token|review)\/[^/?#]+$/i,
};

export const reviewRouteHeaders = [{
  headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  source: "/review/:token",
}];

export const publicTokenRouteHeaders = [
  ...consentRouteHeaders,
  ...reviewRouteHeaders,
];
