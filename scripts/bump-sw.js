/**
 * Vercel 빌드 전 자동 실행되는 스크립트
 * sw.js 의 APP_VERSION 을 배포마다 고유한 값으로 교체합니다.
 *
 * 우선순위:
 *  1. VERCEL_GIT_COMMIT_SHA  (Vercel 자동 주입 — 배포마다 다름)
 *  2. 로컬 git commit SHA    (로컬 빌드 시 fallback)
 *  3. 밀리초 타임스탬프      (git 없는 환경 최후 fallback)
 */

const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function getVersion() {
  // 1) Vercel 환경
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8)
  }
  // 2) 로컬 git
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {}
  // 3) 타임스탬프
  return Date.now().toString(36)
}

const version = getVersion()
const swPath  = path.join(__dirname, '..', 'public', 'sw.js')

let content = fs.readFileSync(swPath, 'utf8')

// APP_VERSION = 'anything' → APP_VERSION = '<new version>'
const updated = content.replace(
  /const APP_VERSION\s*=\s*'[^']*'/,
  `const APP_VERSION  = '${version}'`
)

if (updated === content) {
  console.warn('[bump-sw] ⚠️  APP_VERSION 패턴을 찾지 못했습니다. sw.js 를 확인하세요.')
} else {
  fs.writeFileSync(swPath, updated, 'utf8')
  console.log(`[bump-sw] ✓ APP_VERSION → '${version}'`)
}
