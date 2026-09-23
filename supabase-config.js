// ==========================================================
// ตั้งค่า Supabase ของกลุ่มคุณตรงนี้
// วิธีหา: Supabase Dashboard > Project Settings > API
//   - Project URL      -> ใส่ใน SUPABASE_URL
//   - anon public key  -> ใส่ใน SUPABASE_ANON_KEY
// ==========================================================
const SUPABASE_URL = "https://xkyixbnussdhjuwjhwfu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IYeteh8iPFvOoN4kzlF9YQ_ICxcMRhp";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
