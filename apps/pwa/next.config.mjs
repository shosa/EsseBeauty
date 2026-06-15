import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  transpilePackages: ["@esse-beauty/feature-flags", "@esse-beauty/ui"],
};

export default withPWA(nextConfig);
