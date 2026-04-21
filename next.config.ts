import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ndalczzqwdaszxokuxvh.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // PWA/모바일 최적화
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
