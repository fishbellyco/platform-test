/** @type {import('next').NextConfig} */
const nextConfig = {
  // The workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@fishbelly/core", "@fishbelly/pipeline"],
};

export default nextConfig;
