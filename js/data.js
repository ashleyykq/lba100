// Data layer: Supabase when configured, otherwise an in-memory demo.
// Every read and write goes through here, so the rest of the app never branches on demo mode.
import { CFG } from "./state.js";
import { str, uuid } from "./utils.js";
import { tgName } from "./telegram.js";

const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(CFG.SUPABASE_URL || "") && CFG.SUPABASE_KEY && !/YOUR-/.test(CFG.SUPABASE_KEY);
const sb = configured && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL.replace(/\/$/, ""), CFG.SUPABASE_KEY) : null;
export const demo = !sb;

const demoRows = [];     // demo mode only; gone when the page closes
let hasAddedBy = true;   // false if the database doesn't have the sign-off column yet
let hasBroughtBy = true; // false if the database doesn't have the brought_by column yet

/* ---------- Rows → records ---------- */
const safeThumb = (s) => typeof s === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s) ? s : null;

function photoUrl(path) {
  if (!path || !/^[0-9a-f-]{36}\.jpg$/.test(path)) return null;
  if (demo) return (demoRows.find((r) => r.photo_path === path) || {})._blobUrl || null;
  return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

function clean(d) {
  return {
    id: String(d.id),
    name: str(d.name, 60) || "Someone",
    date: str(d.date, 10),
    svc: str(d.svc, 40),
    shared: str(d.shared, 400),
    thumb: safeThumb(d.thumb),
    photo: photoUrl(d.photo_path),
    createdAt: Date.parse(d.created_at) || 0,
    addedBy: str(d.added_by, 60).trim(),
    broughtBy: str(d.brought_by, 60).trim(),
    photoPath: typeof d.photo_path === "string" ? d.photo_path : null,
  };
}

/* ---------- Loading + live updates ---------- */
let handlers = { records() {}, failed() {} };
// records(list) gets every person, oldest first; failed() runs when the wall can't be reached.
export function onLoad(records, failed) { handlers = { records, failed }; }

export async function load() {
  if (demo) { handlers.records(demoRows.map(clean)); return; }
  const fetchRows = (cols) => sb.from("entries").select(cols).order("created_at", { ascending: true }).limit(1000);
  const BASE = "id,created_at,name,date,svc,shared,thumb,photo_path";
  const cols = () => BASE + (hasAddedBy ? ",added_by" : "") + (hasBroughtBy ? ",brought_by" : "");
  let { data, error } = await fetchRows(cols());
  // Drop optional columns the database doesn't have yet, one at a time.
  while (error && (hasAddedBy && /added_by/.test(error.message || "") || hasBroughtBy && /brought_by/.test(error.message || ""))) {
    if (hasAddedBy && /added_by/.test(error.message)) hasAddedBy = false; else hasBroughtBy = false;
    ({ data, error } = await fetchRows(cols()));
  }
  if (error) { handlers.failed(); return; }
  handlers.records((data || []).map(clean));
}

let refetchT;
const refetchSoon = () => { clearTimeout(refetchT); refetchT = setTimeout(load, 250); };

export function watchForChanges() {
  if (demo) return;
  sb.channel("lba-wall")
    .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, refetchSoon)
    .subscribe();
  // Telegram pauses the page in the background; catch up when it comes back.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refetchSoon(); });
  setInterval(() => { if (!document.hidden) load(); }, 60000);
}

/* ---------- Writes ---------- */
const uploadPhoto = (path, blob) =>
  sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });

// Add a person. `photo` is { blob, thumb } or null. Throws { stage: "photo" | "row", error }.
export async function addEntry(id, fields, photo) {
  const photo_path = photo ? id + ".jpg" : null;
  if (photo && !demo) {
    const up = await uploadPhoto(photo_path, photo.blob);
    if (up.error) throw { stage: "photo", error: up.error };
  }
  const row = { id, ...fields, thumb: photo ? photo.thumb : null, photo_path };
  if (tgName && hasAddedBy) row.added_by = tgName;
  if (!hasBroughtBy) delete row.brought_by;
  if (demo) {
    demoRows.push({ ...row, created_at: new Date().toISOString(), _blobUrl: photo ? URL.createObjectURL(photo.blob) : null });
    return;
  }
  let ins = await sb.from("entries").insert(row);
  // Drop optional columns the database doesn't have yet, one at a time.
  const missingCol = () => ["added_by", "brought_by"].find((c) => c in row && (ins.error.message || "").includes(c));
  for (let c; ins.error && (c = missingCol());) {
    if (c === "added_by") hasAddedBy = false; else hasBroughtBy = false;
    delete row[c];
    ins = await sb.from("entries").insert(row);
  }
  if (ins.error) throw { stage: "row", error: ins.error };
}

/* ---------- Admin writes ---------- */
// These go through Supabase functions that check the admin password on the server. They throw on failure.
const demoRow = (id) => demoRows.find((x) => x.id === id);
async function rpc(fn, password, args) {
  const { data, error } = await sb.rpc(fn, { p_password: password, ...args });
  if (error) throw error;
  return data;
}

export async function adminCheck(password) {
  if (demo) return true;
  return (await rpc("admin_check", password)) === true;
}

// Replace a person's photo with `photo` ({ blob, thumb }), or remove it with null.
export async function adminSetPhoto(password, id, photo) {
  const path = photo ? uuid() + ".jpg" : null;
  const thumb = photo ? photo.thumb : null;
  if (demo) {
    const d = demoRow(id);
    if (d) Object.assign(d, { thumb, photo_path: path, _blobUrl: photo ? URL.createObjectURL(photo.blob) : null });
    return;
  }
  if (photo) {
    const up = await uploadPhoto(path, photo.blob);
    if (up.error) throw up.error;
  }
  await rpc("admin_set_photo", password, { p_id: id, p_thumb: thumb, p_photo_path: path });
}

// v = { name, date, svc, shared, added_by }
export async function adminUpdate(password, id, v) {
  if (demo) {
    const d = demoRow(id);
    if (d) Object.assign(d, v, { added_by: v.added_by || null });
    return;
  }
  await rpc("admin_update_entry", password, {
    p_id: id, p_name: v.name, p_date: v.date, p_svc: v.svc, p_shared: v.shared, p_added_by: v.added_by || null,
  });
}

export async function adminDelete(password, id) {
  if (demo) {
    const i = demoRows.findIndex((x) => x.id === id);
    if (i >= 0) demoRows.splice(i, 1);
    return;
  }
  await rpc("admin_delete_entry", password, { p_id: id });
}
