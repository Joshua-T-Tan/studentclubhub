/* ============================================================
   qr.js — tiny self-contained QR Code generator (offline).
   Byte mode, error-correction level L, versions 1–5, mask 0.
   Enough capacity (≤106 bytes) for a club share URL.
   Algorithm follows Nayuki's reference QR generator (public domain).
   Exposes: qrMatrix(text) -> {size, modules[][]} | null,  qrSvg(text, px).
   ============================================================ */
var QRCode = (function () {
  var TOTAL = [26, 44, 70, 100, 134];        // total codewords per version (1..5)
  var ECCW  = [7, 10, 15, 20, 26];           // EC codewords per version, level L (single block)

  function utf8(text) {
    var out = [], i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else if (c < 0xD800 || c >= 0xE000) { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
      else { i++; var c2 = 0x10000 + (((c & 0x3FF) << 10) | (text.charCodeAt(i) & 0x3FF));
        out.push(0xF0 | (c2 >> 18), 0x80 | ((c2 >> 12) & 0x3F), 0x80 | ((c2 >> 6) & 0x3F), 0x80 | (c2 & 0x3F)); }
    }
    return out;
  }
  function getBit(x, i) { return (x >>> i) & 1; }
  function rsMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    var result = []; for (var i = 0; i < degree - 1; i++) result.push(0); result.push(1);
    var root = 1;
    for (var i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) { result[j] = rsMul(result[j], root); if (j + 1 < result.length) result[j] ^= result[j + 1]; }
      root = rsMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    for (var k = 0; k < data.length; k++) {
      var factor = data[k] ^ result.shift(); result.push(0);
      for (var i = 0; i < result.length; i++) result[i] ^= rsMul(divisor[i], factor);
    }
    return result;
  }

  function build(text) {
    var bytes = utf8(text), version = 0, dataCW = 0;
    for (var v = 1; v <= 5; v++) { var d = TOTAL[v - 1] - ECCW[v - 1]; if (bytes.length <= d - 2) { version = v; dataCW = d; break; } }
    if (!version) return null;
    var ec = ECCW[version - 1], size = version * 4 + 17;

    // ---- bit stream: byte mode (0100) + 8-bit length + data ----
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4); push(bytes.length, 8);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    var cap = dataCW * 8;
    push(0, Math.min(4, cap - bits.length));         // terminator
    while (bits.length % 8 !== 0) bits.push(0);       // byte align
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    var pad = 0xEC; while (data.length < dataCW) { data.push(pad); pad = pad === 0xEC ? 0x11 : 0xEC; }
    var all = data.concat(rsRemainder(data, rsDivisor(ec)));   // single block

    // ---- matrix ----
    var m = [], fn = [];
    for (var r = 0; r < size; r++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, val) { m[y][x] = val; fn[y][x] = true; }

    // timing
    for (var i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    // finders (centers)
    function finder(x, y) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = x + dx, yy = y + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    // alignment (single, for v2..5)
    if (version >= 2) {
      var acen = [0, 0, 18, 22, 26, 30][version];
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        set(acen + dx, acen + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    // reserve format area (values overwritten later)
    drawFormat(0);

    // ---- data placement (zig-zag) ----
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var x = right - jj, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && idx < all.length * 8) { m[y][x] = getBit(all[idx >>> 3], 7 - (idx & 7)) === 1; idx++; }
        }
      }
    }
    // ---- mask 0: (row+col) even ----
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (!fn[r][c] && (r + c) % 2 === 0) m[r][c] = !m[r][c];
    // ---- final format bits (level L=1, mask 0) ----
    drawFormat(1);

    function drawFormat(eclFormatBits) {
      var d = (eclFormatBits << 3) | 0, rem = d;              // 5 data bits, mask=0
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((d << 10) | rem) ^ 0x5412;                    // 15-bit BCH
      for (var i = 0; i <= 5; i++) set(8, i, getBit(f, i) === 1);
      set(8, 7, getBit(f, 6) === 1); set(8, 8, getBit(f, 7) === 1); set(7, 8, getBit(f, 8) === 1);
      for (var i = 9; i < 15; i++) set(14 - i, 8, getBit(f, i) === 1);
      for (var i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(f, i) === 1);
      for (var i = 8; i < 15; i++) set(8, size - 15 + i, getBit(f, i) === 1);
      set(8, size - 8, true);                                // dark module
    }
    return { size: size, modules: m };
  }

  function matrix(text) { try { return build(text); } catch (e) { return null; } }
  function svg(text, px) {
    var q = matrix(text); if (!q) return '';
    var quiet = 4, dim = q.size + quiet * 2, cell = (px || 200) / dim;
    var rects = '';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.modules[r][c])
      rects += '<rect x="' + ((c + quiet) * cell).toFixed(2) + '" y="' + ((r + quiet) * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (px || 200) + '" height="' + (px || 200) + '" viewBox="0 0 ' + (px || 200) + ' ' + (px || 200) + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><g fill="#000">' + rects + '</g></svg>';
  }
  return { matrix: matrix, svg: svg };
})();
function qrMatrix(t) { return QRCode.matrix(t); }
function qrSvg(t, px) { return QRCode.svg(t, px); }
