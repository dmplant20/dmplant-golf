# Inter Stellar GOLF — 네이티브 앱 배포 셋업 가이드

Capacitor 셸(remote-URL)로 기존 웹앱을 그대로 로드하는 네이티브 앱.
코드/프로젝트 스캐폴드는 완료됐고, **아래는 사람이 직접 준비해야 하는 항목**이다.
모든 웹 코드 변경은 `isNativeApp()` 가드로 브라우저에선 무동작 → 기존 웹앱은 그대로 동작한다.

앱 정보: **appId `com.interstellargolf.app`**, 이름 "Inter Stellar GOLF",
로드 URL `https://dmplant-golf.vercel.app`.

---

## 0. 코드에서 이미 완료된 것
- WebView 리다이렉트 우회 가드(`src/lib/native.ts`, `middleware.ts`, `layout.tsx`)
- Google/Apple 네이티브 로그인(`src/lib/auth/nativeOAuth.ts`, `native-client.ts`, 로그인 페이지 버튼)
- 네이티브 푸시 클라/서버(`push-native.ts`, `push-native-server.ts`, `/api/push/register-device`)
- Capacitor 설정 + android/ ios/ 프로젝트 + 새 아이콘/스플래시
- Next 프로덕션 빌드 통과, 타입체크 통과

---

## 1. Supabase 대시보드 (로그인)
> ★ Google/Apple provider 를 켜기 **전에** SQL 먼저 실행.

1. SQL Editor 에서 실행:
   - `src/lib/supabase/migration_native_auth.sql` (기존 회원 email 확인 백필 → 계정 링크 보장)
   - `src/lib/supabase/migration_device_push_tokens.sql` (푸시 토큰 테이블)
2. Authentication → URL Configuration → Redirect URLs 에 추가:
   ```
   com.interstellargolf.app://auth/callback
   https://dmplant-golf.vercel.app/**
   ```
3. Authentication → Providers → **Google** 활성화:
   - Google Cloud Console → OAuth 동의화면 게시 → "웹 애플리케이션" OAuth 클라이언트 생성
   - 승인된 리디렉션 URI: `https://ndalczzqwdaszxokuxvh.supabase.co/auth/v1/callback`
   - Client ID / Secret 을 Supabase 에 입력
4. Authentication → Providers → **Apple** 활성화(iOS 제출 시 필수):
   - Apple Developer → Services ID, Team ID, Key ID, Sign in with Apple 키(.p8)

---

## 2. Firebase (안드로이드 푸시 — 필수)
1. Firebase 콘솔에서 프로젝트 생성 → Android 앱 추가, 패키지명 `com.interstellargolf.app`
2. `google-services.json` 다운로드 → `android/app/google-services.json` 에 저장
   (gitignore 됨. gradle 이 존재 시 자동으로 google-services 플러그인 적용)
3. 서버 발송용 서비스 계정: 프로젝트 설정 → 서비스 계정 → 새 비공개 키(JSON) 생성
4. Vercel 환경변수 추가:
   - `FCM_PROJECT_ID` = Firebase 프로젝트 ID
   - `FCM_SERVICE_ACCOUNT` = 서비스계정 JSON 전체(한 줄)

## 2b. APNs (iOS 푸시 — iOS 진행 시)
Apple Developer → Keys → APNs Auth Key(.p8) 생성. Vercel 환경변수:
- `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`=com.interstellargolf.app,
  `APNS_PRIVATE_KEY`(.p8 내용), `APNS_PRODUCTION`(TestFlight=`false`, 스토어=`true`)

---

## 3. 안드로이드 빌드 → Google Play (Windows 가능)
전제: Android Studio + JDK 17, `ANDROID_HOME` 설정, 위 `google-services.json` 배치.

1. 업로드 키스토어 생성(한 번만, 안전 백업 필수):
   ```
   keytool -genkey -v -keystore upload-keystore.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. `android/key.properties` (gitignore 됨) 작성:
   ```
   storeFile=../../upload-keystore.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   그리고 `android/app/build.gradle` 의 `signingConfigs`/`buildTypes.release` 에 연결
   (표준 Capacitor 서명 설정. 필요 시 요청하면 배선해 드림).
3. 빌드:
   ```
   cd android && ./gradlew bundleRelease
   ```
   산출물: `android/app/build/outputs/bundle/release/app-release.aab`
4. Play Console → 앱 만들기 → 내부 테스트 트랙에 AAB 업로드 → Play App Signing 활성화 →
   테스터 등록 → 개인정보처리방침 URL, 데이터 안전(푸시 토큰 수집 선언), 콘텐츠 등급 작성.

버전 올릴 때마다 `android/app/build.gradle` 의 `versionCode` 증가.

---

## 4. iOS (Mac 필요 — 이후)
1. Mac 에서 저장소 클론 → `npm install` → `npx cap sync ios` → `cd ios/App && pod install`
2. Xcode 로 `ios/App/App.xcworkspace` 열기:
   - Signing & Capabilities → 팀 선택, **Push Notifications** + **Background Modes(Remote notifications)** 추가
   - `Info.plist` 에 카메라/사진 사용 설명(NSCameraUsageDescription 등) 추가
   - URL Types 에 `com.interstellargolf.app` 스킴 추가(OAuth 딥링크)
3. Archive → TestFlight → App Store. (Apple 로그인 필수 구현: `@capacitor-community/apple-sign-in` 도입 검토)

---

## 5. 코드 변경 후 재동기화
플러그인 추가/설정 변경 시:
```
npx cap sync
```
> remote-URL 방식이라 웹 코드 변경은 **Vercel 배포만** 하면 앱에 즉시 반영된다(앱 재빌드 불필요).
> 단, Capacitor 플러그인/네이티브 설정 변경 시에는 앱 재빌드·재배포 필요.

---

## 6. 검증 체크리스트 (실기기)
- [ ] 앱 실행 시 외부 브라우저로 튕기지 않고 로드
- [ ] Google/Apple 로그인 → 기존 이메일 회원이 같은 계정으로 진입(데이터 유지)
- [ ] 재무/채팅 등 서버 API 정상(쿠키 세션 브릿지 확인)
- [ ] 푸시 수신 + 탭 시 해당 화면 이동 + 뱃지
- [ ] 카메라(영수증/앨범), 계좌 복사 동작
