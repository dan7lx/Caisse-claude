// Caméra simulée pour les tests : une vidéo .y4m qui filme un QR code (lu par Chromium avec
// --use-file-for-fake-video-capture). Le QR est dessiné avec qrcode-generator, déjà utilisé par l'app.
const { Buffer } = require('buffer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const qrcode = require('qrcode-generator');

const W = 640;
const H = 480;

/** Écrit une vidéo de QR code et retourne son chemin. */
function qrVideo(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount() + 8; // 4 modules de marge blanche de chaque côté
  const scale = Math.floor(Math.min(W, H) / modules);
  const size = modules * scale;
  const x0 = Math.floor((W - size) / 2);
  const y0 = Math.floor((H - size) / 2);
  const y = Buffer.alloc(W * H, 235); // fond clair
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const inside = r >= 4 && c >= 4 && r < modules - 4 && c < modules - 4;
      const dark = inside && qr.isDark(r - 4, c - 4);
      for (let dy = 0; dy < scale; dy++) {
        const row = (y0 + r * scale + dy) * W + x0 + c * scale;
        y.fill(dark ? 16 : 235, row, row + scale);
      }
    }
  }
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, uv, uv]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'caisse-qr-')), 'qr.y4m');
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  fs.writeFileSync(file, Buffer.concat([header, ...Array(10).fill(frame)]));
  return file;
}

module.exports = { qrVideo };
