// Admin: password sheet + full-screen editable table of everyone on the wall.
import { $, el, replayClass } from "./dom.js";
import { state } from "./state.js";
import { haptic, tgBack } from "./telegram.js";
import { fmtAdded, initials } from "./utils.js";
import { toast } from "./toast.js";
import { processPhoto } from "./photo.js";
import { demo, load, adminCheck, adminSetPhoto, adminUpdate, adminDelete } from "./data.js";

let adminPw = null;        // set once the password is accepted
let adminPending = false;  // a refresh arrived while someone was typing in the table
const adminLogin = $("adminLogin"), adminPanel = $("adminPanel"), apBody = $("apBody");
const rowStatus = new Map(); // id -> { cls, text, at }

/* ---------- Open / close ---------- */
// After a sheet closes: go back to the admin table if it's open underneath, otherwise to the page.
export function afterOverlayClose() {
  document.body.style.overflow = state.adminOpen ? "hidden" : "";
  tgBack(state.adminOpen ? closeAdmin : null);
}

function openAdminLogin() {
  $("alErr").hidden = true;
  $("alDemo").hidden = !demo;
  $("alPw").value = "";
  adminLogin.hidden = false;
  document.body.style.overflow = "hidden";
  tgBack(closeAdminLogin);
  setTimeout(() => { try { $("alPw").focus(); } catch (_) {} }, 80);
}
export function closeAdminLogin() {
  adminLogin.hidden = true;
  afterOverlayClose();
}
export const isAdminLoginOpen = () => !adminLogin.hidden;

function openAdmin() {
  state.adminOpen = true;
  adminPanel.hidden = false;
  document.body.style.overflow = "hidden";
  renderAdmin();
  tgBack(closeAdmin);
}
export function closeAdmin() {
  state.adminOpen = false;
  adminPanel.hidden = true;
  document.body.style.overflow = "";
  tgBack(null);
}

$("adminBtn").addEventListener("click", () => { haptic.tap(); adminPw !== null ? openAdmin() : openAdminLogin(); });
$("alClose").addEventListener("click", closeAdminLogin);
adminLogin.addEventListener("click", (e) => { if (e.target === adminLogin) closeAdminLogin(); });
$("apClose").addEventListener("click", closeAdmin);
$("apSearch").addEventListener("input", renderAdmin);

/* ---------- Login ---------- */
const missingSetup = (err) => /admin_|function|PGRST202/i.test(((err && err.message) || "") + ((err && err.code) || ""));

$("alForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pwv = $("alPw").value;
  const err = $("alErr");
  if (!pwv) { $("alPw").focus(); return; }
  const btn = $("alBtn");
  btn.disabled = true; btn.textContent = "Checking…"; err.hidden = true;
  let ok;
  try {
    ok = await adminCheck(pwv);
  } catch (error) {
    err.textContent = missingSetup(error)
      ? "Admin tools aren't set up yet. Run the latest setup.sql in Supabase, then try again."
      : "Couldn't check the password. Check your connection and try again.";
    err.hidden = false; haptic.bad();
    return;
  } finally {
    btn.disabled = false; btn.textContent = "Open admin table";
  }
  if (!ok) { err.textContent = "That's not the admin password."; err.hidden = false; haptic.bad(); $("alPw").select(); return; }
  adminPw = pwv;
  haptic.ok();
  closeAdminLogin();
  openAdmin();
});

/* ---------- Table ---------- */
function setStatus(tr, cls, text) {
  rowStatus.set(tr.dataset.id, { cls, text, at: Date.now() });
  const cell = tr.querySelector(".row-status");
  cell.className = "row-status" + (cls ? " " + cls : "");
  cell.textContent = text;
}

const MAX_LEN = { name: 60, svc: 40, shared: 400, added_by: 60 };
const LABELS = { name: "Name", date: "Date", svc: "Service", shared: "What they shared", added_by: "Added by" };
function inputCell(field, value, cls, type) {
  const td = el("td");
  const inp = type === "textarea" ? el("textarea", "cell-input " + cls) : el("input", "cell-input " + cls);
  if (type !== "textarea") inp.type = type || "text";
  inp.value = value || "";
  inp.dataset.field = field;
  if (MAX_LEN[field]) inp.maxLength = MAX_LEN[field];
  if (type === "textarea") inp.rows = 2;
  inp.setAttribute("aria-label", LABELS[field]);
  td.appendChild(inp);
  return td;
}

const deleteButton = () => { const b = el("button", "del-btn", "Delete"); b.type = "button"; b.dataset.act = "delete"; return b; };

function renderAdmin() {
  if (!state.adminOpen) return;
  const { records } = state;
  const q = $("apSearch").value.trim().toLowerCase();
  const all = records.map((r, i) => ({ r, n: i + 1 })).reverse();
  const rows = q ? all.filter(({ r }) => [r.name, r.broughtBy, r.svc, r.shared, r.addedBy].join(" ").toLowerCase().includes(q)) : all;
  $("apCount").textContent = `${records.length} ${records.length === 1 ? "person" : "people"}` + (q ? ` · ${rows.length} shown` : "");
  $("apEmpty").hidden = rows.length > 0;
  $("apEmpty").textContent = records.length ? "No one matches that search." : "No one on the wall yet.";
  apBody.textContent = "";
  for (const { r, n } of rows) {
    const tr = el("tr");
    tr.dataset.id = r.id;
    tr.appendChild(el("td", "num", `No. ${n}`));

    const hasPhoto = !!(r.thumb || r.photo);
    const phTd = el("td", "ph-td");
    const ph = el("div", "ph-cell");
    const mini = el("div", "ph-mini");
    if (hasPhoto) { const im = el("img"); im.alt = ""; im.src = r.thumb || r.photo; mini.appendChild(im); }
    else mini.textContent = initials(r.name);
    const acts = el("div", "ph-actions");
    const change = el("label", "link-btn", hasPhoto ? "Change" : "Add");
    const fi = el("input"); fi.type = "file"; fi.accept = "image/*"; fi.dataset.act = "photo"; fi.setAttribute("aria-label", `Photo for ${r.name}`);
    change.appendChild(fi);
    acts.appendChild(change);
    if (hasPhoto) { const rm = el("button", "link-btn", "Remove"); rm.type = "button"; rm.dataset.act = "rmphoto"; acts.appendChild(rm); }
    ph.append(mini, acts);
    phTd.appendChild(ph);
    tr.appendChild(phTd);

    tr.appendChild(inputCell("name", r.name, "c-name"));
    tr.appendChild(inputCell("date", r.date, "c-date", "date"));
    tr.appendChild(inputCell("svc", r.svc, "c-svc"));
    tr.appendChild(inputCell("shared", r.shared, "c-shared", "textarea"));
    tr.appendChild(el("td", "c-brought", r.broughtBy || "—"));
    tr.appendChild(inputCell("added_by", r.addedBy, "c-by"));
    tr.appendChild(el("td", "added", fmtAdded(r.createdAt)));

    const st = rowStatus.get(r.id);
    const stTd = el("td", "row-status");
    if (st && Date.now() - st.at < 4000) { if (st.cls) stTd.classList.add(st.cls); stTd.textContent = st.text; }
    tr.appendChild(stTd);

    const delTd = el("td", "del-cell");
    delTd.appendChild(deleteButton());
    tr.appendChild(delTd);
    apBody.appendChild(tr);
  }
}

// Re-render on new data, but not while someone is typing in the table: wait until they leave it.
export function refreshAdmin() {
  if (!state.adminOpen) return;
  if (apBody.contains(document.activeElement)) { adminPending = true; return; }
  renderAdmin();
}
apBody.addEventListener("focusout", () => {
  setTimeout(() => {
    if (adminPending && !apBody.contains(document.activeElement)) { adminPending = false; renderAdmin(); }
  }, 120);
});
apBody.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("input.cell-input")) { e.preventDefault(); e.target.blur(); }
});

/* ---------- Edits ---------- */
function adminFail(tr, error) {
  console.error(error);
  haptic.bad();
  const msg = (error && error.message) || "";
  if (/not allowed/i.test(msg)) {
    adminPw = null; closeAdmin();
    toast("The admin password has changed. Enter it again.");
    return;
  }
  setStatus(tr, "err", (error && error.code) === "23514" ? "Too long, or a required box is empty" : "Didn't save. Try again.");
}

// Photo picked, or a text box left after editing.
apBody.addEventListener("change", async (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const id = tr.dataset.id;

  if (e.target.dataset.act === "photo") {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus(tr, "", "Uploading…");
    try {
      await adminSetPhoto(adminPw, id, await processPhoto(file));
    } catch (ex) { return adminFail(tr, ex); }
    setStatus(tr, "ok", "Photo saved");
    haptic.ok();
    load();
    return;
  }

  if (!e.target.dataset.field) return;
  const get = (f) => tr.querySelector(`[data-field="${f}"]`).value.trim();
  const v = { name: get("name"), date: get("date"), svc: get("svc"), shared: get("shared"), added_by: get("added_by") };
  if (!v.name || !v.date || !v.svc) { setStatus(tr, "err", "Name, date and service can't be empty"); haptic.bad(); return; }
  setStatus(tr, "", "Saving…");
  try {
    await adminUpdate(adminPw, id, v);
  } catch (ex) { return adminFail(tr, ex); }
  setStatus(tr, "ok", "Saved ✓");
  replayClass(tr, "saved");
  haptic.tick();
  load();
});

// Remove photo, and the two-step delete.
apBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.dataset.id;
  const rec = state.records.find((r) => r.id === id);
  const name = rec ? rec.name : "this person";

  switch (btn.dataset.act) {
    case "rmphoto": {
      setStatus(tr, "", "Removing photo…");
      try {
        await adminSetPhoto(adminPw, id, null);
      } catch (ex) { return adminFail(tr, ex); }
      setStatus(tr, "ok", "Photo removed");
      load();
      return;
    }
    case "delete": {
      const box = el("div", "del-confirm");
      const yes = el("button", "yes", "Delete"); yes.type = "button"; yes.dataset.act = "confirmdelete";
      const no = el("button", "", "Keep"); no.type = "button"; no.dataset.act = "keep";
      box.append(el("span", "", `Delete ${name}?`), yes, no);
      btn.parentElement.replaceChildren(box);
      haptic.tap();
      return;
    }
    case "keep":
      btn.closest("td").replaceChildren(deleteButton());
      return;
    case "confirmdelete": {
      btn.disabled = true;
      try {
        await adminDelete(adminPw, id);
      } catch (ex) { btn.disabled = false; return adminFail(tr, ex); }
      haptic.ok();
      tr.classList.add("removing");
      toast(`${name} was removed from the wall`);
      setTimeout(load, 300);
    }
  }
});
