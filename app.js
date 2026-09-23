// ==========================================================
// กองกลาง — Shared Grocery Fund
// app.js — all client-side logic
// ==========================================================

const TABLE = "grocery_items";

/* ---------- Local Storage (device-only preferences) ---------- */
const LS_KEYS = {
  userName: "gf_user_name",
  theme: "gf_theme",
  draftName: "gf_draft_item_name",
  draftPrice: "gf_draft_item_price",
  roomCode: "gf_room_code",
};

function lsGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage unavailable — fail silently, app still works */
  }
}

/* ---------- State ---------- */
let items = []; // cached copy of cloud data
let currentTab = "pending";
let pendingBoughtItemId = null; // item awaiting "mark as bought" confirmation
let roomCode = null; // which room's data this device is viewing
let realtimeChannel = null;

/* ---------- Toast notifications ---------- */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `<span class="toast-icon">${type === "error" ? "!" : "✓"}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

/* ---------- DOM refs ---------- */
const el = (id) => document.getElementById(id);
const userNameInput = el("userName");
const themeToggle = el("themeToggle");
const statusDot = el("statusDot");
const statusText = el("statusText");
const addItemForm = el("addItemForm");
const itemNameInput = el("itemName");
const itemPriceInput = el("itemPrice");
const itemNoteInput = el("itemNote");
const pendingList = el("pendingList");
const boughtList = el("boughtList");
const countPending = el("countPending");
const countBought = el("countBought");
const grandTotalEl = el("grandTotal");
const balanceList = el("balanceList");
const modalBackdrop = el("modalBackdrop");
const modalItemName = el("modalItemName");
const boughtForm = el("boughtForm");
const actualPriceInput = el("actualPrice");
const paidByInput = el("paidBy");
const cancelBoughtBtn = el("cancelBought");
const roomChip = el("roomChip");
const roomChipCode = el("roomChipCode");
const roomModalBackdrop = el("roomModalBackdrop");
const roomForm = el("roomForm");
const roomCodeInput = el("roomCodeInput");

/* ==========================================================
   Init
   ========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  restorePreferences();
  bindEvents();

  const savedRoom = lsGet(LS_KEYS.roomCode);
  if (savedRoom) {
    enterRoom(savedRoom);
  } else {
    openRoomModal();
  }
});

/* ==========================================================
   Room code — lightweight data separation, not real auth.
   See schema.sql for the security caveat.
   ========================================================== */
function openRoomModal() {
  roomCodeInput.value = roomCode || "";
  roomModalBackdrop.classList.add("open");
}

function closeRoomModal() {
  roomModalBackdrop.classList.remove("open");
}

function normalizeRoomCode(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function enterRoom(code) {
  roomCode = normalizeRoomCode(code);
  lsSet(LS_KEYS.roomCode, roomCode);
  roomChipCode.textContent = roomCode;
  closeRoomModal();

  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }
  showToast(`เข้าห้อง "${roomCode}" แล้ว`);
  loadItems();
  subscribeRealtime();
}

function restorePreferences() {
  userNameInput.value = lsGet(LS_KEYS.userName);
  paidByInput.value = lsGet(LS_KEYS.userName);

  const theme = lsGet(LS_KEYS.theme, "dark");
  applyTheme(theme);

  // restore an in-progress draft so a page refresh doesn't lose it
  const draftName = lsGet(LS_KEYS.draftName);
  const draftPrice = lsGet(LS_KEYS.draftPrice);
  if (draftName) itemNameInput.value = draftName;
  if (draftPrice) itemPriceInput.value = draftPrice;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  themeToggle.textContent = theme === "light" ? "☀️" : "🌙";
  lsSet(LS_KEYS.theme, theme);
}

/* ==========================================================
   Event bindings
   ========================================================== */
function bindEvents() {
  userNameInput.addEventListener("input", () => {
    lsSet(LS_KEYS.userName, userNameInput.value.trim());
  });

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "light" ? "dark" : "light");
  });

  // Save drafts as the user types so nothing is lost on refresh
  itemNameInput.addEventListener("input", () => lsSet(LS_KEYS.draftName, itemNameInput.value));
  itemPriceInput.addEventListener("input", () => lsSet(LS_KEYS.draftPrice, itemPriceInput.value));

  addItemForm.addEventListener("submit", handleAddItem);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  cancelBoughtBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  boughtForm.addEventListener("submit", handleConfirmBought);

  roomChip.addEventListener("click", openRoomModal);
  roomForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = roomCodeInput.value.trim();
    if (!code) return;
    enterRoom(code);
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === tabName;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  el(`panel-${tabName}`).classList.add("active");
}

/* ==========================================================
   Cloud data — Supabase
   ========================================================== */
async function loadItems() {
  if (!roomCode) return;
  setStatus("loading", "กำลังโหลดข้อมูล...");
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select("*")
    .eq("room_code", roomCode)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    setStatus("offline", "เชื่อมต่อ Cloud ไม่ได้ — ตรวจสอบ supabase-config.js");
    return;
  }
  items = data || [];
  setStatus("online", `ซิงก์ห้อง "${roomCode}" แล้ว`);
  renderAll();
}

function subscribeRealtime() {
  if (!roomCode) return;
  realtimeChannel = supabaseClient
    .channel(`grocery_items_${roomCode}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `room_code=eq.${roomCode}` },
      () => loadItems()
    )
    .subscribe();
}

function setStatus(state, text) {
  statusDot.className = "status-dot " + (state === "online" ? "online" : state === "offline" ? "offline" : "");
  statusText.textContent = text;
}

async function handleAddItem(e) {
  e.preventDefault();
  const name = itemNameInput.value.trim();
  if (!name) return;

  const requestedBy = userNameInput.value.trim() || "ไม่ระบุ";
  const estimatedPrice = itemPriceInput.value ? Number(itemPriceInput.value) : null;
  const note = itemNoteInput.value.trim() || null;

  const { error } = await supabaseClient.from(TABLE).insert({
    room_code: roomCode,
    name,
    estimated_price: estimatedPrice,
    note,
    requested_by: requestedBy,
    status: "pending",
  });

  if (error) {
    console.error(error);
    showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    return;
  }

  // clear form + drafts
  itemNameInput.value = "";
  itemPriceInput.value = "";
  itemNoteInput.value = "";
  lsSet(LS_KEYS.draftName, "");
  lsSet(LS_KEYS.draftPrice, "");

  showToast(`เพิ่ม "${name}" ลงลิสต์แล้ว`);
  loadItems();
}

function openModal(itemId) {
  const item = items.find((i) => i.id === itemId);
  if (!item) return;
  pendingBoughtItemId = itemId;
  modalItemName.textContent = item.name;
  actualPriceInput.value = item.estimated_price ?? "";
  paidByInput.value = lsGet(LS_KEYS.userName) || "";
  modalBackdrop.classList.add("open");
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  pendingBoughtItemId = null;
}

async function handleConfirmBought(e) {
  e.preventDefault();
  if (!pendingBoughtItemId) return;

  const actualPrice = Number(actualPriceInput.value);
  const paidBy = paidByInput.value.trim() || "ไม่ระบุ";

  const { error } = await supabaseClient
    .from(TABLE)
    .update({
      status: "bought",
      actual_price: actualPrice,
      paid_by: paidBy,
      bought_at: new Date().toISOString(),
    })
    .eq("id", pendingBoughtItemId)
    .eq("room_code", roomCode);

  if (error) {
    console.error(error);
    showToast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    return;
  }

  closeModal();
  showToast("บันทึกการซื้อเรียบร้อย 🎉");
  loadItems();
}

async function deleteItem(itemId) {
  if (!confirm("ลบรายการนี้?")) return;
  const { error } = await supabaseClient.from(TABLE).delete().eq("id", itemId).eq("room_code", roomCode);
  if (error) {
    console.error(error);
    showToast("ลบไม่สำเร็จ", "error");
    return;
  }
  showToast("ลบรายการแล้ว");
  loadItems();
}

/* ==========================================================
   Rendering
   ========================================================== */
function renderAll() {
  const pending = items.filter((i) => i.status === "pending");
  const bought = items.filter((i) => i.status === "bought");

  countPending.textContent = pending.length;
  countBought.textContent = bought.length;

  renderPending(pending);
  renderBought(bought);
  renderSummary(bought);
}

function renderPending(pending) {
  if (pending.length === 0) {
    pendingList.innerHTML = `<li class="empty-state">ยังไม่มีของในลิสต์ — เพิ่มรายการแรกด้านบนเลย</li>`;
    return;
  }
  pendingList.innerHTML = pending
    .map(
      (item) => `
    <li class="item-row">
      <div class="item-info">
        <p class="item-name">${escapeHtml(item.name)}</p>
        <div class="item-meta">
          <span>ขอโดย ${escapeHtml(item.requested_by || "-")}</span>
          ${item.estimated_price != null ? `<span>· ประมาณ ฿${item.estimated_price}</span>` : ""}
        </div>
        ${item.note ? `<p class="item-note">${escapeHtml(item.note)}</p>` : ""}
      </div>
      <div class="item-actions">
        <button class="icon-btn buy" title="ทำเครื่องหมายว่าซื้อแล้ว" onclick="openModal('${item.id}')">✓</button>
        <button class="icon-btn delete" title="ลบ" onclick="deleteItem('${item.id}')">✕</button>
      </div>
    </li>`
    )
    .join("");
}

function renderBought(bought) {
  if (bought.length === 0) {
    boughtList.innerHTML = `<li class="empty-state">ยังไม่มีประวัติการซื้อ</li>`;
    return;
  }
  const sorted = [...bought].sort((a, b) => new Date(b.bought_at) - new Date(a.bought_at));
  boughtList.innerHTML = sorted
    .map(
      (item) => `
    <li class="item-row">
      <div class="item-info">
        <p class="item-name">${escapeHtml(item.name)}</p>
        <div class="item-meta">
          <span>จ่ายโดย ${escapeHtml(item.paid_by || "-")}</span>
          <span>· ${formatDate(item.bought_at)}</span>
        </div>
      </div>
      <span class="item-price">฿${item.actual_price}</span>
      <div class="item-actions">
        <button class="icon-btn delete" title="ลบ" onclick="deleteItem('${item.id}')">✕</button>
      </div>
    </li>`
    )
    .join("");
}

function renderSummary(bought) {
  const grandTotal = bought.reduce((sum, i) => sum + (Number(i.actual_price) || 0), 0);
  const prevTotalText = grandTotalEl.textContent;
  grandTotalEl.textContent = `฿${grandTotal.toLocaleString()}`;
  if (prevTotalText !== grandTotalEl.textContent) {
    grandTotalEl.classList.remove("pulse-once");
    void grandTotalEl.offsetWidth; // restart animation
    grandTotalEl.classList.add("pulse-once");
  }

  // union of everyone who has requested or paid for something
  const members = new Set();
  items.forEach((i) => {
    if (i.requested_by) members.add(i.requested_by);
    if (i.paid_by) members.add(i.paid_by);
  });
  const currentUser = userNameInput.value.trim();
  if (currentUser) members.add(currentUser);

  if (members.size === 0 || grandTotal === 0) {
    balanceList.innerHTML = `<li class="empty-state">ยังไม่มีข้อมูลพอคำนวณ</li>`;
    return;
  }

  const paidByMember = {};
  members.forEach((m) => (paidByMember[m] = 0));
  bought.forEach((i) => {
    if (i.paid_by) {
      paidByMember[i.paid_by] = (paidByMember[i.paid_by] || 0) + (Number(i.actual_price) || 0);
    }
  });

  const fairShare = grandTotal / members.size;

  balanceList.innerHTML = [...members]
    .sort()
    .map((name) => {
      const balance = (paidByMember[name] || 0) - fairShare;
      let cls = "even";
      let label = "พอดีแล้ว";
      let amountText = "฿0";
      if (balance > 1) {
        cls = "owed";
        label = "ได้คืน";
        amountText = `+฿${balance.toFixed(0)}`;
      } else if (balance < -1) {
        cls = "owes";
        label = "ต้องจ่ายเพิ่ม";
        amountText = `-฿${Math.abs(balance).toFixed(0)}`;
      }
      return `
      <li class="balance-row">
        <span class="balance-name">${escapeHtml(name)}</span>
        <span>
          <span class="badge">${label}</span>
          <span class="balance-amount ${cls}">${amountText}</span>
        </span>
      </li>`;
    })
    .join("");
}

/* ==========================================================
   Helpers
   ========================================================== */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
