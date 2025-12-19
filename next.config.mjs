/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  output: "export",
  transpilePackages: ["tone"]
};

export default nextConfig;
