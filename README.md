# กองกลาง — Shared Grocery Fund

Web App สำหรับเพื่อนร่วมห้อง/หอพัก จดของที่ต้องซื้อร่วมกัน บันทึกว่าใครจ่ายไปเท่าไหร่ และคำนวณยอดกองกลางอัตโนมัติ

## โครงสร้างไฟล์
```
grocery-fund/
├── index.html          หน้าเว็บหลัก
├── style.css            ดีไซน์และธีม
├── app.js                ตรรกะทั้งหมด (เชื่อม Supabase + localStorage)
├── supabase-config.js    ใส่ค่า Project URL / anon key ของกลุ่มคุณตรงนี้
└── schema.sql            คำสั่งสร้างตารางฐานข้อมูล
```

## ขั้นตอนติดตั้ง (ทำครั้งเดียว)

### 1. สร้างโปรเจกต์ Supabase
1. ไปที่ https://supabase.com และสร้างบัญชี/โปรเจกต์ใหม่ (ฟรี)
2. รอสักครู่จนโปรเจกต์พร้อมใช้งาน

### 2. สร้างตารางฐานข้อมูล
1. ในเมนูซ้ายของ Supabase Dashboard เลือก **SQL Editor**
2. เปิดไฟล์ `schema.sql` ในโปรเจกต์นี้ คัดลอกทั้งหมด
3. วางใน SQL Editor แล้วกด **Run**

### 3. เชื่อมต่อเว็บกับ Supabase
1. ไปที่ **Project Settings > API**
2. คัดลอกค่า **Project URL** และ **anon public key**
3. เปิดไฟล์ `supabase-config.js` แล้วแทนที่:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```

### 4. ทดสอบในเครื่อง
เปิด `index.html` ด้วย Live Server (VS Code extension) หรือรัน local server ง่ายๆ:
```bash
npx serve .
```
> ห้ามเปิดไฟล์ index.html ตรงๆ แบบ double-click เพราะบาง browser จะบล็อก JavaScript module — ใช้ local server เสมอ

### 5. เผยแพร่เว็บ (Deploy)
แนะนำ **Netlify Drop** (ง่ายที่สุด ไม่ต้องสมัครก็ได้):
1. ไปที่ https://app.netlify.com/drop
2. ลากโฟลเดอร์ `grocery-fund` ทั้งโฟลเดอร์ไปวาง
3. จะได้ลิงก์เว็บทันที เช่น `https://random-name.netlify.app`

ทางเลือกอื่น: GitHub Pages, Vercel, Cloudflare Pages — ใช้วิธีคล้ายกัน

## จุดที่ใช้ Local Storage vs Cloud Database (สำหรับเขียนรายงาน)

| ข้อมูล | เก็บที่ | เหตุผล |
|---|---|---|
| ชื่อผู้ใช้ปัจจุบัน | Local Storage | เฉพาะอุปกรณ์ของแต่ละคน ไม่ต้องพิมพ์ใหม่ทุกครั้ง |
| ธีม (light/dark) | Local Storage | เป็นการตั้งค่าส่วนตัว ไม่เกี่ยวกับเพื่อนร่วมห้อง |
| ฟอร์มที่พิมพ์ค้างไว้ (draft) | Local Storage | ข้อมูลชั่วคราว ป้องกันข้อมูลหายถ้ารีเฟรชหน้าเว็บ |
| รายการของที่ต้องซื้อ | Cloud Database | ต้องให้เพื่อนร่วมห้องทุกคนเห็นข้อมูลเดียวกัน จากอุปกรณ์คนละเครื่อง |
| ประวัติการซื้อ/ยอดจ่าย | Cloud Database | ต้องคงอยู่ถาวรและเข้าถึงได้จากทุกอุปกรณ์เพื่อคำนวณยอดกองกลางร่วมกัน |

## หมายเหตุด้านความปลอดภัย
`schema.sql` ตั้งค่า Row Level Security แบบเปิดให้ทุกคนที่มีลิงก์อ่าน/เขียนข้อมูลได้ (ไม่มีระบบ login) ซึ่งเหมาะสำหรับ Mini Project ในชั้นเรียนเท่านั้น ควรอธิบายจุดนี้ไว้ใน Reflection ของรายงานว่าในโปรเจกต์จริงควรเพิ่มระบบ Authentication เพื่อจำกัดสิทธิ์การเข้าถึง
