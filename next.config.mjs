/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Oculta el badge "N" de dev mode de Next.js (para demos en vivo)
  devIndicators: false,
  // distDir configurable por env → permite correr 2 dev servers (data-scientist
  // en :3000 y data-engineer en :3001) desde el MISMO repo sin pisar el caché.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
