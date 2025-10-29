/*** DOM ヘルパー ***/
const $ = (s) => document.querySelector(s);
const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*** LocalStorage Keys ***/
const LS_MASTER = "masker_master_table_v1";
const LS_OPTION = "masker_option_v1";

/*** 要素 ***/
const els = {
    input: $("#input"),
    output: $("#output"),
    stats: $("#stats"),
    preserveLength: $("#preserveLength"),
    wordBoundary: $("#wordBoundary"),
    fillChar: $("#fillChar"),
    btnMask: $("#btnMask"),
    btnCopy: $("#btnCopy"),
    btnDownloadOut: $("#btnDownloadOut"),

    masterStatus: $("#masterStatus"),
    masterTable: $("#masterTable"),
    masterTbody: $("#masterTbody"),
    masterJson: $("#masterJson"),

    btnAddRow: $("#btnAddRow"),              // ← 位置をフッターへ移設
    btnDeleteSelected: $("#btnDeleteSelected"),
    btnImport: $("#btnImport"),
    btnExport: $("#btnExport"),
    btnSave: $("#btnSave"),
    btnReset: $("#btnReset"),
    fileInput: $("#fileInput"),
    checkAll: $("#checkAll"),
};

/*** サンプルデータ ***/
const SAMPLE_MASTER = {
    meta: { version: 1, note: "表＝大分類(category), 置換前(from), 置換後(to)" },
    persons: [
        { from: ["山田太郎", "山田太郎さん"], to: "A会社のYさん" },
        { from: ["Jane Doe", "J. Doe"], to: "Jさん" }
    ],
    companies: [
        { from: ["株式会社テスト", "テスト社"], to: "△△社" },
        { from: ["Rutile Tools 株式会社"], to: "某ツール社" }
    ],
    emails: [
        { from: ["taro.yamada@example.com"], to: "***@example.com" }
    ],
    others: [
        { from: ["大阪城"], to: "某所" }
    ]
};

/*** テーブル行モデル変換 ***/
// rows = [{category: 'persons'|'companies'|'emails'|'others', from: '文字列', to:'文字列'}, ...]
function flattenMaster(obj) {
    const rows = [];
    const buckets = ["persons", "companies", "emails", "others"];
    for (const b of buckets) {
        const arr = Array.isArray(obj[b]) ? obj[b] : [];
        for (const rule of arr) {
            const froms = Array.isArray(rule.from) ? rule.from : [rule.from];
            for (const f of froms) {
                if (f && rule.to != null) rows.push({ category: b, from: String(f), to: String(rule.to) });
            }
        }
    }
    rows.sort((a, b) => b.from.length - a.from.length);
    return rows;
}

function packRowsToMaster(rows) {
    const obj = { meta: { version: 1 }, persons: [], companies: [], emails: [], others: [] };
    const map = { persons: new Map(), companies: new Map(), emails: new Map(), others: new Map() };
    for (const r of rows) {
        const bucket = r.category;
        if (!map[bucket]) continue;
        const key = r.to;
        if (!map[bucket].has(key)) map[bucket].set(key, new Set());
        map[bucket].get(key).add(r.from);
    }
    for (const bucket of Object.keys(map)) {
        for (const [to, set] of map[bucket].entries()) {
            obj[bucket].push({ from: Array.from(set), to });
        }
    }
    return obj;
}

/*** テーブル描画・操作 ***/
function renderTable(rows) {
    els.masterTbody.innerHTML = "";
    for (const r of rows) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td><input type="checkbox" class="row-check"></td>
      <td>
        <select class="form-select form-select-sm category">
          <option value="persons">人名</option>
          <option value="companies">社名</option>
          <option value="emails">メール</option>
          <option value="others">その他</option>
        </select>
      </td>
      <td><input type="text" class="form-control form-control-sm from" placeholder="置換前"></td>
      <td><input type="text" class="form-control form-control-sm to" placeholder="置換後"></td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-secondary btn-dup">複製</button>
        <button class="btn btn-sm btn-outline-danger btn-del">削除</button>
      </td>
    `;
        tr.querySelector(".category").value = r.category || "persons";
        tr.querySelector(".from").value = r.from || "";
        tr.querySelector(".to").value = r.to || "";
        els.masterTbody.appendChild(tr);
    }
    updateMasterJsonFromTable();
}

function collectRowsFromTable() {
    const rows = [];
    els.masterTbody.querySelectorAll("tr").forEach(tr => {
        const category = tr.querySelector(".category").value;
        const from = tr.querySelector(".from").value.trim();
        const to = tr.querySelector(".to").value;
        if (from) rows.push({ category, from, to });
    });
    rows.sort((a, b) => b.from.length - a.from.length);
    return rows;
}

function updateMasterJsonFromTable() {
    const rows = collectRowsFromTable();
    const master = packRowsToMaster(rows);
    els.masterJson.value = JSON.stringify(master, null, 2);
    els.masterStatus.textContent = "未保存（編集中）";
}

function addRow(row = { category: "persons", from: "", to: "" }) {
    const rows = collectRowsFromTable();
    rows.push(row);
    renderTable(rows);
}

function deleteSelectedRows() {
    const rows = [];
    els.masterTbody.querySelectorAll("tr").forEach(tr => {
        const checked = tr.querySelector(".row-check").checked;
        if (checked) return;
        rows.push({
            category: tr.querySelector(".category").value,
            from: tr.querySelector(".from").value,
            to: tr.querySelector(".to").value,
        });
    });
    renderTable(rows);
}

function bindTableEvents() {
    els.masterTbody.addEventListener("input", (e) => {
        if (e.target.matches(".category,.from,.to")) updateMasterJsonFromTable();
    });
    els.masterTbody.addEventListener("click", (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        if (e.target.classList.contains("btn-del")) {
            tr.remove();
            updateMasterJsonFromTable();
        }
        if (e.target.classList.contains("btn-dup")) {
            const row = {
                category: tr.querySelector(".category").value,
                from: tr.querySelector(".from").value,
                to: tr.querySelector(".to").value,
            };
            addRow(row);
        }
    });
    els.checkAll.addEventListener("change", () => {
        const v = els.checkAll.checked;
        els.masterTbody.querySelectorAll(".row-check").forEach(cb => cb.checked = v);
    });
}

/*** 保存・読込・I/O ***/
function saveTableToLS() {
    localStorage.setItem(LS_MASTER, els.masterJson.value);
    els.masterStatus.textContent = "保存済み";
}

function loadTableFromLS() {
    const raw = localStorage.getItem(LS_MASTER);
    let obj;
    if (raw) {
        try { obj = JSON.parse(raw); } catch { obj = SAMPLE_MASTER; }
        els.masterStatus.textContent = "読込（ブラウザ）";
    } else {
        obj = SAMPLE_MASTER;
        els.masterStatus.textContent = "サンプル";
    }
    renderTable(flattenMaster(obj));
}

function importJson(text) {
    try {
        const obj = JSON.parse(text);
        renderTable(flattenMaster(obj));
        els.masterStatus.textContent = "読込（ファイル）";
    } catch {
        alert("JSONの形式が正しくありません。");
    }
}

function exportJson() {
    const blob = new Blob([els.masterJson.value], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "replace-master.json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
}

/*** 置換エンジン ***/
function buildPattern(s, wordBoundary) {
    const isAsciiWord = /^[\w.@+-]+$/.test(s);
    const wb = wordBoundary && isAsciiWord ? "\\b" : "";
    return new RegExp(wb + escapeReg(s) + wb, "g");
}
function maskWithSameLength(src, fillChar) {
    const len = [...src].length;
    return (fillChar || "○").repeat(Math.max(1, len));
}
function applyMaster(text, rows, option) {
    let replaced = text;
    let count = 0;
    const sorted = [...rows].sort((a, b) => b.from.length - a.from.length);
    for (const r of sorted) {
        const rx = buildPattern(r.from, option.wordBoundary);
        replaced = replaced.replace(rx, (m) => {
            count++;
            return option.preserveLength ? maskWithSameLength(m, option.fillChar) : r.to;
        });
    }
    return { text: replaced, count };
}

/*** 実行 ***/
function runMask() {
    const rows = collectRowsFromTable();
    const option = {
        preserveLength: els.preserveLength.checked,
        wordBoundary: els.wordBoundary.checked,
        fillChar: els.fillChar.value || "○",
    };
    const res = applyMaster(els.input.value || "", rows, option);
    els.output.value = res.text;
    els.stats.textContent = `置換 ${res.count} 件 / ルール ${rows.length} 件`;
    localStorage.setItem(LS_OPTION, JSON.stringify(option));
}

/*** 出力ユーティリティ ***/
function copyOut() {
    navigator.clipboard.writeText(els.output.value || "").then(() => {
        els.btnCopy.textContent = "コピーしました";
        setTimeout(() => (els.btnCopy.textContent = "出力をコピー"), 1200);
    });
}
function downloadOut() {
    const blob = new Blob([els.output.value || ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "masked.txt";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
}

/*** 起動処理 ***/
window.addEventListener("DOMContentLoaded", () => {
    loadTableFromLS();
    bindTableEvents();

    try {
        const raw = localStorage.getItem(LS_OPTION);
        if (raw) {
            const o = JSON.parse(raw);
            els.preserveLength.checked = !!o.preserveLength;
            els.wordBoundary.checked = !!o.wordBoundary;
            els.fillChar.value = o.fillChar || "○";
        }
    } catch { }

    els.btnMask.addEventListener("click", runMask);
    els.btnCopy.addEventListener("click", copyOut);
    els.btnDownloadOut.addEventListener("click", downloadOut);

    els.btnAddRow.addEventListener("click", () => addRow());           // ← 新しい配置で動作
    els.btnDeleteSelected.addEventListener("click", deleteSelectedRows);
    els.btnSave.addEventListener("click", saveTableToLS);
    els.btnReset.addEventListener("click", () => renderTable(flattenMaster(SAMPLE_MASTER)));

    els.btnImport.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const text = await f.text();
        importJson(text);
        e.target.value = "";
    });
    els.btnExport.addEventListener("click", exportJson);
});
