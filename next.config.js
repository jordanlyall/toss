/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Privy v3 lists these as optional peers but webpack resolves them at build time.
    // We don't use Farcaster, Solana programs, or Abstract, so alias them to false.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@farcaster/mini-app-solana": false,
      "@abstract-foundation/agw-client": false,
      "@solana-program/memo": false,
      "@solana-program/system": false,
      "@solana-program/token": false,
      "@solana/kit": false,
    };
    return config;
  },
};

module.exports = nextConfig;
