(function(){
// 產生「住民用品清單」Word 檔：橫式 A4、一頁六格、左上為打字清單、其餘格放物品照。
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const F = '<w:rFonts w:ascii="新細明體" w:eastAsia="新細明體" w:hAnsi="新細明體"/>';

const p = (txt, o = {}) => {
  const sz = o.sz || 20, ln = o.line || 260;
  return '<w:p><w:pPr>' + (o.jc ? '<w:jc w:val="' + o.jc + '"/>' : '') +
    '<w:spacing w:before="0" w:after="0" w:line="' + ln + '" w:lineRule="exact"/>' +
    '<w:rPr>' + F + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:pPr>' +
    (txt !== '' ? '<w:r><w:rPr>' + F + (o.b ? '<w:b/>' : '') + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr><w:t xml:space="preserve">' + esc(txt) + '</w:t></w:r>' : '') +
    '</w:p>';
};
const BORD = '<w:tcBorders><w:top w:val="single" w:sz="6" w:color="000000"/><w:left w:val="single" w:sz="6" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:color="000000"/><w:right w:val="single" w:sz="6" w:color="000000"/></w:tcBorders>';
const tc = (w, c, span) => '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (span ? '<w:gridSpan w:val="' + span + '"/>' : '') + BORD + '<w:vAlign w:val="center"/></w:tcPr>' + c + '</w:tc>';
const tr = (h, c) => '<w:tr><w:trPr><w:trHeight w:val="' + h + '" w:hRule="atLeast"/></w:trPr>' + c + '</w:tr>';

const padDate = s => {
  const a = String(s).split('.');
  if (a.length < 3) return String(s).replace(/\./g, '');
  return a[0] + ('0' + a[1]).slice(-2) + ('0' + a[2]).slice(-2);
};

// 第 1 頁：左上清單 + 5 張照片；第 2 頁起每頁 6 張
const pageCount = n => (n <= 5 ? 1 : 1 + Math.ceil((n - 5) / 6));

const autoFileName = (d, pages) =>
  d.name + '(' + d.en + ')  製表-' + padDate(d.makeDate || d.date) + ' ' + d.maker +
  '(共 ' + (pages || 1) + ' 頁)';

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zip(entries) {
  const enc = new TextEncoder(), chunks = [], central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nb = enc.encode(name), crc = crc32(data);
    const lh = new Uint8Array(30 + nb.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true); lv.setUint16(26, nb.length, true); lh.set(nb, 30);
    chunks.push(lh, data);
    const ch = new Uint8Array(46 + nb.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nb.length, true); cv.setUint32(42, offset, true); ch.set(nb, 46);
    central.push(ch); offset += lh.length + data.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const eo = new Uint8Array(22), ev = new DataView(eo.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return new Blob(chunks.concat(central, [eo]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// 把 objectURL/dataURL 縮成 1200px 寬 JPEG，並回傳位元組與長寬
async function shrink(url, maxW = 1200) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const w = Math.min(maxW, bmp.width), h = Math.round(bmp.height * w / bmp.width);
  const cv = new OffscreenCanvas(w, h);
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
}

// 把照片縮圖後轉成 base64（存雲端用）。輸入可為 url 字串或 {url, tag}
async function shrinkAll(list) {
  const out = [];
  for (const p of (list || [])) {
    const url = typeof p === 'string' ? p : p.url;
    const tag = typeof p === 'string' ? '__all' : (p.tag || '__all');
    try {
      const im = await shrink(url);
      let s = '';
      for (let i = 0; i < im.bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, im.bytes.subarray(i, i + 0x8000));
      out.push({ data: btoa(s), tag: tag });
    } catch (e) { /* 略過壞掉的圖 */ }
  }
  return out;
}

async function buildDocx(d, photoUrls) {
  const imgs = [];
  for (const u of (photoUrls || [])) {
    try { imgs.push(await shrink(u)); } catch (e) { /* 略過壞掉的圖 */ }
  }
  const pages = pageCount(imgs.length);

  const CW = 4750, C1 = 3050, C2 = 1700;
  const chk = n => ((d.receivers || []).indexOf(n) >= 0 ? '☑' : '□') + n;
  let rows = '';
  rows += tr(300, tc(CW, p('住民姓名（中英文）：' + d.name + ' ' + d.en), 2));
  rows += tr(300, tc(CW, p('住民床號：' + d.bed + '　　日期：' + d.date), 2));
  rows += tr(300, tc(CW, p('點收人員： ' + chk('前櫃檯') + ' / ' + chk('護理人員') + ' / ' + chk('照服人員')), 2));
  rows += tr(380, tc(CW, p('簽章：' + (d.receiverName || '')), 2));
  rows += tr(300, tc(C1, p('分類', { jc: 'center' })) + tc(C2, p('數量', { jc: 'center' })));
  // 讓表格永遠塞得進半頁：欄位列多的時候自動壓縮列高
  const nRows = Math.max((d.items || []).length, 10);
  const rowH = Math.max(200, Math.min(300, Math.floor((4600 - 1580) / (nRows + 1))));
  (d.items || []).forEach(it => {
    rows += tr(rowH, tc(C1, p('　' + it.name)) + tc(C2, p(it.qty + ' ' + (it.unit || ''), { jc: 'center' })));
  });
  for (let i = (d.items || []).length; i < 10; i++) rows += tr(rowH, tc(C1, p('')) + tc(C2, p('')));

  const listTable = '<w:tbl><w:tblPr><w:tblW w:w="' + CW + '" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="' + C1 + '"/><w:gridCol w:w="' + C2 + '"/></w:tblGrid>' + rows + '</w:tbl>';

  const picP = (im, i) => {
    // 寬度上限 4600 twips、高度上限 4600 twips（半頁高），直式照片自動縮小以免撐破格子
    const maxW = 4600, maxH = 4600;
    let tw = maxW, th = tw * im.h / im.w;
    if (th > maxH) { th = maxH; tw = th * im.w / im.h; }
    const cx = Math.round(tw / 1440 * 914400), cy = Math.round(th / 1440 * 914400);
    const id = i + 1;
    return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="photo' + id + '"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="photo' + id + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="rId' + (100 + i) + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  };

  const CELLW = 5150, CELLH = 5000;
  const gridOf = cells => '<w:tbl><w:tblPr><w:tblW w:w="15450" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="5150"/><w:gridCol w:w="5150"/><w:gridCol w:w="5150"/></w:tblGrid>' +
    tr(CELLH, tc(CELLW, cells[0]) + tc(CELLW, cells[1]) + tc(CELLW, cells[2])) +
    tr(CELLH, tc(CELLW, cells[3]) + tc(CELLW, cells[4]) + tc(CELLW, cells[5])) + '</w:tbl>';

  const title = d.fileName || autoFileName(d, pages);
  const pageBreak = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="60" w:lineRule="exact"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';

  let body = '';
  for (let pg = 0; pg < pages; pg++) {
    const cells = [];
    if (pg === 0) {
      cells.push(listTable);
      for (let i = 0; i < 5; i++) cells.push(imgs[i] ? picP(imgs[i], i) : p(''));
    } else {
      const start = 5 + (pg - 1) * 6;
      for (let i = 0; i < 6; i++) cells.push(imgs[start + i] ? picP(imgs[start + i], start + i) : p(''));
    }
    if (pg > 0) body += pageBreak;
    body += p(pg === 0 ? title : title + '　— 第 ' + (pg + 1) + ' 頁', { sz: 20, b: true, line: 320 });
    body += gridOf(cells);
  }

  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>' +
    body +
    '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="851" w:footer="992" w:gutter="0"/><w:cols w:space="425"/><w:docGrid w:type="lines" w:linePitch="360"/></w:sectPr></w:body></w:document>';

  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const drels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    imgs.map((_, i) => '<Relationship Id="rId' + (100 + i) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/photo' + i + '.jpeg"/>').join('') +
    '</Relationships>';

  const enc = new TextEncoder();
  const entries = [
    ['[Content_Types].xml', enc.encode(ct)],
    ['_rels/.rels', enc.encode(rels)],
    ['word/document.xml', enc.encode(documentXml)],
    ['word/_rels/document.xml.rels', enc.encode(drels)]
  ];
  imgs.forEach((im, i) => entries.push(['word/media/photo' + i + '.jpeg', im.bytes]));
  return { blob: zip(entries), fileName: title + '.docx', pages: pages };
}

async function downloadDocx(d, photoUrls) {
  const { blob, fileName, pages } = await buildDocx(d, photoUrls);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { fileName: fileName, pages: pages };
}

window.DocxLib = { autoFileName, pageCount, buildDocx, downloadDocx, shrinkAll };

})();
