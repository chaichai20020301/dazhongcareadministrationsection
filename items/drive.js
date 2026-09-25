(function(){
// 透過 Google Apps Script 網頁應用程式存檔到雲端硬碟（免 Google Cloud 專案、免費）。
// 資料夾以「姓名」認人、名稱為「床號 姓名」；換房時後端會自動改名，舊檔跟著走。

// 手機網路不穩時 fetch 可能卡住不回來，所以加逾時；失敗自動重試兩次。
const once = async (endpoint, payload, ms) => {
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      // text/plain 可避開 CORS preflight，Apps Script 才收得到
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ac ? ac.signal : undefined
    });
    if (!r.ok) throw new Error('連線失敗 ' + r.status);
    const text = await r.text();
    let out;
    try { out = JSON.parse(text); }
    catch (e) { throw new Error('雲端回應異常（可能要重新授權 Apps Script）'); }
    if (out.error) throw new Error(out.error);
    return out;
  } finally { if (timer) clearTimeout(timer); }
};

const post = async (endpoint, payload) => {
  if (!endpoint) throw new Error('尚未設定 Apps Script 網址');
  const ms = payload && payload.data ? 120000 : 45000;
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await once(endpoint, payload, ms); }
    catch (e) {
      last = e;
      const msg = String(e && (e.message || e));
      // 內容錯誤不必重試，只重試連線類問題
      if (!/failed|network|abort|逾時|連線失敗 5|連線失敗 429/i.test(msg) && e.name !== 'AbortError') throw e;
      if (i < 2) await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw new Error(last && last.name === 'AbortError' ? '雲端沒有回應（逾時），請確認網路' : String(last.message || last));
};

const toBase64 = blob => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1]);
  fr.onerror = rej;
  fr.readAsDataURL(blob);
});

async function saveToDrive({ endpoint, rootFolderId, bed, name, blob, fileName, photos, record, photoMode, preferActive }) {
  return post(endpoint, {
    rootFolderId, bed, resident: name, fileName,
    data: await toBase64(blob),
    photos: photos || null,  // 有給才寫入雲端照片
    photoMode: photoMode || 'append',  // append=只加新照片；replace=整批覆蓋
    record: record || null,  // 同一次請求就寫進資料庫，避免只建資料夾沒建資料列
    preferActive: !!preferActive  // true=一般登記/再入住，找不到就開新資料夾，不沿用已退住的
  });
}

// 讀回該住民存在雲端的照片，回傳 [{url, tag}]
async function loadPhotos({ endpoint, rootFolderId, bed, name }) {
  const out = await post(endpoint, { action: 'photos', rootFolderId, bed, resident: name });
  return (out.photos || []).map(p => ({
    url: 'data:image/jpeg;base64,' + (p.data || p),
    tag: p.tag || '__all'
  }));
}

// 重新整理雲端照片編號（垃圾桶還原後用），並清掉重複檔
async function renumberPhotos({ endpoint, rootFolderId, bed, name }) {
  return post(endpoint, { action: 'renumber', rootFolderId, bed, resident: name });
}

// 讀另一套系統的住民名單（唯讀，只在新增清單時參考）
async function loadRoster({ endpoint, rosterSheetId, rosterSheetName }) {
  const out = await post(endpoint, { action: 'roster', rosterSheetId, rosterSheetName });
  return out.roster || [];
}

// ---- 消耗品及食品 ----
async function saveConsumable({ endpoint, rootFolderId, bed, name, en, date, itemText, expiry, remindDate, photos }) {
  return post(endpoint, { action: 'consumSave', rootFolderId, bed, resident: name, en, date,
    itemText, expiry, remindDate, photos: photos || [] });
}
async function loadConsumables({ endpoint, rootFolderId }) {
  const out = await post(endpoint, { action: 'consumLoad', rootFolderId });
  return out.rows || [];
}
// 讀回某一批登記的照片（縮圖 base64 + 雲端連結）
async function loadConsumPhotos({ endpoint, rootFolderId, bed, name, stamp }) {
  const out = await post(endpoint, { action: 'consumPhotos', rootFolderId, bed, resident: name, stamp });
  return (out.photos || []).map(p => ({
    name: p.name, url: p.url,
    src: p.data ? 'data:' + (p.mime || 'image/jpeg') + ';base64,' + p.data : ''
  }));
}
async function markConsumDone({ endpoint, rootFolderId, rowId }) {
  return post(endpoint, { action: 'consumDone', rootFolderId, rowId });
}
async function deleteConsumable({ endpoint, rootFolderId, rowId }) {
  return post(endpoint, { action: 'consumDelete', rootFolderId, rowId });
}

// 讀取雲端住民資料庫
async function loadResidents({ endpoint, rootFolderId }) {
  const out = await post(endpoint, { action: 'load', rootFolderId });
  return out.residents || [];
}

// 寫回一位住民（以姓名為鍵）
async function saveResident({ endpoint, rootFolderId, resident }) {
  return post(endpoint, { action: 'save', rootFolderId, resident });
}

// 退住：資料夾整個移進「已退住」，名稱加退住日期
async function archiveResident({ endpoint, rootFolderId, bed, name, leaveDate, complete }) {
  return post(endpoint, { action: 'archive', rootFolderId, bed, resident: name, leaveDate, complete: !!complete });
}

// 換房：只改資料夾名稱，不上傳檔案
async function renameFolder({ endpoint, rootFolderId, bed, name }) {
  return post(endpoint, { action: 'rename', rootFolderId, bed, resident: name });
}

window.DriveLib = { saveToDrive, loadPhotos, loadRoster,
  saveConsumable, loadConsumables, markConsumDone, deleteConsumable, loadConsumPhotos,
  renumberPhotos, loadResidents, saveResident, archiveResident, renameFolder };

})();
