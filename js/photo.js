// Shrinks a picked photo to a ≤500 KB JPEG plus a tiny square thumbnail (data URL) for the tiles.

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  return img;
}

function draw(img, maxSide, square) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d");
  if (square) {
    const m = Math.min(w, h);
    cv.width = cv.height = maxSide;
    ctx.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, maxSide, maxSide);
  } else {
    const s = Math.min(1, maxSide / Math.max(w, h));
    cv.width = Math.round(w * s); cv.height = Math.round(h * s);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
  }
  return cv;
}

const toBlob = (cv, q) => new Promise((res) => cv.toBlob(res, "image/jpeg", q));

export async function processPhoto(file) {
  const img = await loadImage(file);
  const big = draw(img, 1080, false);
  let q = .82, blob = await toBlob(big, q);
  while (blob && blob.size > 450000 && q > .45) { q -= .1; blob = await toBlob(big, q); }
  if (!blob || blob.size > 500000) throw new Error("too big");
  const thumb = draw(img, 72, true).toDataURL("image/jpeg", .72);
  return { blob, thumb };
}
