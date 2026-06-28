import type { NextConfig } from "next";

// 빌드 타임에 클라이언트 번들로 인라인되는 버전 — 폰이 "실제로 돌리는 코드" 의 버전.
// /api/version (서버 현재 버전) 과 비교해서 다르면 폰이 stale 코드라는 결정적 증거.
const BUILD_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  String(Date.now())

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
  // ⭐ 클라이언트 번들에 빌드버전 박제 — BuildStamp 가 서버 버전과 비교해 stale 감지
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
  // PWA/모바일 최적화
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
