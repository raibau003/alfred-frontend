/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: ".",
  },
};

export default nextConfig;
