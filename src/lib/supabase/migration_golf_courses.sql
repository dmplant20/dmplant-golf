-- Migration: Golf courses database (Ho Chi Minh City & surrounding areas)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS golf_courses (
  id                     uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name                   text NOT NULL,
  name_vn                text,
  province               text NOT NULL,
  district               text,
  address                text,
  holes                  int  DEFAULT 18,
  par                    int  DEFAULT 72,
  designer               text,
  green_fee_weekday_vnd  bigint,
  green_fee_weekend_vnd  bigint,
  phone                  text,
  website                text,
  description            text,
  distance_km            int,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz DEFAULT now()
);

-- 전체 공개 읽기 (골프장 정보는 공개 데이터)
ALTER TABLE golf_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "golf_courses_select" ON golf_courses FOR SELECT USING (true);

-- ── 시드 데이터 (호치민 및 인근 16개 골프장) ─────────────────────────────

INSERT INTO golf_courses (name, name_vn, province, district, address, holes, par, designer,
  green_fee_weekday_vnd, green_fee_weekend_vnd, phone, website, description, distance_km)
VALUES

-- ── 호치민시 내 ────────────────────────────────────────────────────────
(
  'Tan Son Nhat Golf Course',
  'Sân Golf Tân Sơn Nhất',
  'Ho Chi Minh City', 'Go Vap District',
  '6 Tan Son Street, Ward 12, Go Vap District, HCMC',
  36, 72, 'Nelson & Haworth Golf Course Architects',
  2500000, 2700000, '+84 28 3987 6666', 'https://www.tansonnhatgolf.vn',
  '공항 바로 옆 36홀(A·B·C·D 9홀 4코스). 야간 골프 가능. 시내 중심에서 6km.',
  6
),
(
  'Saigon South Golf Club',
  'Sân Golf Nam Sài Gòn',
  'Ho Chi Minh City', 'District 7',
  'Dai Lo Nam Saigon, Tan Phu Ward, District 7, HCMC',
  9, 27, NULL,
  400000, 500000, NULL, 'https://www.saigonsouth.com',
  '푸미흥 신도시 내 9홀 퍼3 코스. 입문자·주말 라운드 적합. 시내에서 8km.',
  8
),
(
  'Vietnam Golf & Country Club',
  'Sân Golf & Country Club Việt Nam',
  'Ho Chi Minh City', 'Thu Duc City (former District 9)',
  'Long Thanh My Ward, Thu Duc City, HCMC',
  36, 72, 'West: Chen King Shih (1994) / East: Lee Trevino (1997)',
  2400000, 3300000, '+84 938 568 899', 'https://www.vietnamgolfcc.com',
  '베트남 최초 36홀 골프 클럽. 아시안투어 베트남 마스터스 개최지. 시내 20km.',
  20
),
(
  'Vinpearl Golf Léman Cu Chi',
  'Sân Golf Vinpearl Golf Léman Củ Chi',
  'Ho Chi Minh City', 'Cu Chi District',
  'K5 Tien 2, Tan Thong Hoi Commune, Cu Chi District, HCMC',
  36, 72, 'Golfplan Design',
  2350000, 2550000, NULL, 'https://vinpearl.com/en/vinpearl-golf-leman',
  '2025년 10월 오픈 최신 36홀. 노스코스 7,250야드 / 사우스코스 6,935야드. 21타석 드라이빙레인지.',
  35
),

-- ── 빈증성 ────────────────────────────────────────────────────────────
(
  'Song Be Golf Resort',
  'Sân Golf Song Bé',
  'Binh Duong', 'Thuan An City',
  '77 Binh Duong Boulevard, Thuan An, Binh Duong',
  27, 72, 'Barry Humphrey, International Golf Construction Co.',
  2310000, 3100000, '+84 274 375 6660', 'https://www.songbegolf.com.vn',
  '베트남 최초 국제규격 골프장(1994). 로터스·팜·데저트 9홀 3코스. 시내 15km.',
  15
),
(
  'Twin Doves Golf Club',
  'Sân Golf Twin Doves',
  'Binh Duong', 'Thu Dau Mot City',
  '368 Tran Ngoc Len Street, Dinh Hoa Ward, Thu Dau Mot City, Binh Duong',
  27, 108, 'P+Z Development Pte Ltd',
  2600000, 3400000, '+84 274 386 0123', 'https://www.twindovesgolf.vn',
  '남베트남 최초 프라이빗 멤버십 클럽. 루나·마레·솔레 9홀 3코스. 전장 7,500야드.',
  35
),
(
  'Harmonie Golf Park',
  'Sân Golf Harmonie',
  'Binh Duong', 'Thu Dau Mot City',
  '469 Tran Ngoc Len, Dinh Hoa, Thu Dau Mot City, Binh Duong',
  18, 72, 'Jim Engh (USA)',
  2340000, 3040000, '+84 274 379 7999', 'https://www.harmoniegolfpark.com',
  '2018년 오픈. 독특한 우주선 클럽하우스. 전장 7,348야드. 시그니처 볼 모양 파3 16번홀.',
  35
),

-- ── 동나이성 ──────────────────────────────────────────────────────────
(
  'Long Thanh Golf Club',
  'Sân Golf Long Thành',
  'Dong Nai', 'Long Thanh District',
  'Phuoc Tan Village, Long Thanh District, Dong Nai',
  36, 72, 'Ron Fream & David Dale, Golfplan',
  2100000, 3330000, '+84 251 629 3333', 'https://www.longthanhgolfresort.com.vn',
  '남베트남 최고 코스로 꼽히는 36홀. 힐 코스 + 레이크 코스. 파스팔럼 잔디. 350헥타르.',
  36
),
(
  'Dong Nai Golf Resort (Bo Chang)',
  'Sân Golf Đồng Nai (Bò Chang)',
  'Dong Nai', 'Trang Bom District',
  'National Highway 1A, Trang Bom District, Dong Nai',
  27, 72, 'Ward W. Northrup',
  1780000, 2750000, '+84 251 386 6288', 'https://www.dongnaigolf.com.vn',
  'Song May 호수 300헥타르 리조트. 1997년 오픈. A·B·C 9홀 3코스. 호텔·스파·승마 포함.',
  50
),
(
  'Emerald Country Club',
  'Sân Golf Emerald Country Club',
  'Dong Nai', 'Nhon Trach District',
  'Dai Phuoc Commune, Nhon Trach District, Dong Nai',
  18, 72, 'Ronald W. Fream, Golfplan',
  2150000, 2950000, NULL, NULL,
  '사이공강 섬에 위치한 프라이빗 18홀. 7,395야드. 스코틀랜드풍 벙커. 스피드보트 25분.',
  40
),

-- ── 롱안성 ────────────────────────────────────────────────────────────
(
  'Royal Long An Golf & Country Club',
  'Sân Golf Royal Long An',
  'Long An', 'Duc Hue District',
  'Highway N2, Binh Hoa Nam Commune, Duc Hue District, Long An',
  27, 72, 'Sir Nick Faldo, Faldo Design',
  2000000, 2800000, '+84 272 777 2779', 'https://www.royallongangolfandcountryclub.com',
  '2023년 오픈. 닉 팔도 설계 27홀. 200헥타르. 리조트 빌라·호텔 포함. 시내 50km 남서쪽.',
  50
),
(
  'West Lakes Golf & Villas',
  'Sân Golf West Lakes',
  'Long An', 'Duc Hoa District',
  'No. 145, Highway 822, Chanh Hamlet, Tan My Commune, Duc Hoa District, Long An',
  18, 72, 'Thomson Perrett (Peter Thomson)',
  1900000, 2600000, '+84 287 302 9990', 'https://www.westlakesgolf.com',
  '2018년 오픈. 7,147야드. 거의 모든 홀에 호수. 링크스 스타일. 피터 톰슨(브리티시오픈 5회 우승) 설계.',
  52
),

-- ── 바리아붕따우성 ────────────────────────────────────────────────────
(
  'Vung Tau Paradise Golf Resort',
  'Sân Golf Vũng Tàu Paradise',
  'Ba Ria-Vung Tau', 'Vung Tau City',
  '01 Thuy Van Street, Nguyen An Ninh Ward, Vung Tau City',
  27, 108, 'Taiwan Golf Corp (1992)',
  2200000, 2800000, '+84 254 358 6586', 'http://www.golfparadise.com.vn',
  '베트남 최초 해변 골프장(1992). 27홀 3코스. 붕따우 해변 인근. 시내 125km.',
  125
),
(
  'Sonadezi Chau Duc Golf Course',
  'Sân Golf Sonadezi Châu Đức',
  'Ba Ria-Vung Tau', 'Chau Duc District',
  'Suoi Nghe Commune, Chau Duc District, Ba Ria-Vung Tau',
  36, 72, 'Greg Norman',
  1650000, 2550000, NULL, NULL,
  '2022년 오픈. 그렉 노먼 설계 36홀. 152헥타르. 토너먼트 코스 + 리조트 코스.',
  90
),
(
  'The Bluffs Grand Ho Tram Strip',
  'Sân Golf The Bluffs Hồ Tràm',
  'Ba Ria-Vung Tau', 'Xuyen Moc District',
  'Phuoc Thuan Commune, Xuyen Moc District, Ba Ria-Vung Tau',
  18, 71, 'Greg Norman',
  3200000, 4300000, NULL, 'https://www.thebluffshotram.com',
  '아시아 탑10 코스. 거대한 해안 모래언덕 위 진정한 링크스 코스. 남중국해 파노라마 뷰. 7,007야드.',
  130
),

-- ── 빈투언성 (판티엣) ─────────────────────────────────────────────────
(
  'PGA NovaWorld Phan Thiet',
  'Sân Golf PGA NovaWorld Phan Thiết',
  'Binh Thuan', 'Phan Thiet City',
  'Tien Hoa Hamlet, Tien Thanh Commune, Phan Thiet City, Binh Thuan',
  36, 72, 'Greg Norman',
  1800000, 2700000, NULL, 'https://www.pganovaworld.com',
  '베트남 최초 PGA 라이선스 클럽. 오션코스 7,400야드. 내추럴 모래언덕. "샤크 루프" 13~15번홀 유명.',
  200
);
