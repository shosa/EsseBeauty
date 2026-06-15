/** @type {import("next").NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  transpilePackages: [
    "@esse-beauty/feature-flags",
    "@esse-beauty/shared",
    "@esse-beauty/ui",
  ],
};

export default nextConfig;
