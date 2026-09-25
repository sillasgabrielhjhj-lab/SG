'use strict';

const qrcode = require('./vendor/qrcode.js');

// QR como SVG em data URI, pronto para <img src>. Não precisa de script no navegador.
function qrDataUri(text, cellSize = 6) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag({ cellSize, margin: cellSize * 2, scalable: true });
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function qrSvg(text, cellSize = 10) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: cellSize * 2, scalable: true });
}

module.exports = { qrDataUri, qrSvg };
