export const consentNetworkOnly = {
  handler: "NetworkOnly",
  method: "GET",
  urlPattern: /\/(?:api\/public\/consents|consents)\/[^/?#]+(?:\/sign)?$/i,
};
