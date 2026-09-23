-- ==========================================================
-- กองกลาง — Shared Grocery Fund
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor > New Query
-- ==========================================================

create extension if not exists "pgcrypto";

create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  estimated_price numeric,
  note text,
  requested_by text,
  status text not null default 'pending' check (status in ('pending', 'bought')),
  actual_price numeric,
  paid_by text,
  created_at timestamptz not null default now(),
  bought_at timestamptz
);

-- เปิด Row Level Security ตามข้อกำหนดของ Supabase
alter table grocery_items enable row level security;

-- นโยบายแบบเปิดกว้าง เหมาะสำหรับโปรเจกต์ในชั้นเรียน (ไม่มีระบบ login)
-- หมายเหตุ: การตั้งค่านี้อนุญาตให้ทุกคนที่มีลิงก์เว็บอ่าน/เขียนข้อมูลได้
-- ถ้าต้องการความปลอดภัยมากขึ้นในโปรเจกต์จริง ควรเพิ่มระบบ Authentication
create policy "Allow public read" on grocery_items
  for select using (true);

create policy "Allow public insert" on grocery_items
  for insert with check (true);

create policy "Allow public update" on grocery_items
  for update using (true);

create policy "Allow public delete" on grocery_items
  for delete using (true);

-- เปิด Realtime สำหรับตารางนี้ (ให้เพื่อนร่วมห้องเห็นการอัปเดตทันที)
alter publication supabase_realtime add table grocery_items;
