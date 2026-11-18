-- ────────────────────────────────────────────────────────────────────────────
-- finance_transactions: expense subcategory + item details
--
-- Purpose: 지출(expense)을 경조사/상품/기타 등으로 세분화하고,
--          상품·화환 등 물품의 경우 물품명·수량을 별도로 기록한다.
--
-- expense_category 값:
--   condolence  — 경조사 (조의금/축의금)
--   gift        — 상품·화환·선물
--   event       — 모임 운영비 (식대, 그린피, 차량 등)
--   admin       — 사무비
--   other       — 기타
--
-- item_name: 화환/상품 등의 구체적 물품명 (예: "근조화환", "골프공 1박스")
-- ────────────────────────────────────────────────────────────────────────────

alter table finance_transactions
  add column if not exists expense_category text
    check (expense_category in ('condolence', 'gift', 'event', 'admin', 'other'));

alter table finance_transactions
  add column if not exists item_name text;

create index if not exists finance_transactions_expense_category_idx
  on finance_transactions(club_id, expense_category)
  where expense_category is not null;
