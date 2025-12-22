const LS_KEY = "selected_client_name";

async function apiGet(url) {
  const r = await fetch(url, { headers: { "Accept": "application/json" }});
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
}

function setSelectedClientName(name) {
  localStorage.setItem(LS_KEY, name);
}

function getSelectedClientName() {
  return localStorage.getItem(LS_KEY) || "";
}

// --- Client page ---
async function initClientPage() {
  const select = document.getElementById("clientSelect");
  const detail = document.getElementById("clientDetail");
  const testList = document.getElementById("testList");

  const btnNew = document.getElementById("btnNewClient");
  btnNew.addEventListener("click", async () => {
    // 간단 데모: prompt로 받기 (원하면 모달/폼으로 교체)
    const name = (prompt("새 client 이름을 입력하세요") || "").trim();
    if (!name) return;

    const birth_date = (prompt("birth_date (YYYY-MM-DD) 예: 2010-01-01") || "").trim();
    const sex = (prompt("sex 예: female") || "").trim();
    const weight = (prompt("weight 예: 57kg") || "").trim();
    const height = (prompt("height 예: 167cm") || "").trim();

    const payload = { name, birth_date, sex, weight, height, tests: [] };
    const r = await fetch("/api/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      alert("등록 실패: " + await r.text());
      return;
    }
    await loadClientNames(select);
  });

  await loadClientNames(select);

  // 이전 선택 복원
  const saved = getSelectedClientName();
  if (saved) {
    for (const opt of select.options) {
      if (opt.value === saved) {
        opt.selected = true;
        await renderClientDetail(saved);
        detail.classList.remove("hidden");
        break;
      }
    }
  }

  select.addEventListener("change", async () => {
    const name = select.value;
    if (!name) return;

    setSelectedClientName(name);
    await renderClientDetail(name);
    detail.classList.remove("hidden");
  });

  async function loadClientNames(selectEl) {
    const data = await apiGet("/api/clients");
    selectEl.innerHTML = "";
    (data.names || []).forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      selectEl.appendChild(opt);
    });
  }

  async function renderClientDetail(name) {
    const c = await apiGet(`/api/client/${encodeURIComponent(name)}`);

    document.getElementById("c_name").textContent = c.name || "";
    document.getElementById("c_birth").textContent = c.birth_date || "";
    document.getElementById("c_sex").textContent = c.sex || "";
    document.getElementById("c_weight").textContent = c.weight || "";
    document.getElementById("c_height").textContent = c.height || "";

    // tests 렌더 + 클릭 이벤트
    testList.innerHTML = "";
    const tests = c.tests || [];
    tests.forEach(t => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.textContent = t;
      btn.addEventListener("click", () => openResultWindow(c.name, t));
      li.appendChild(btn);
      testList.appendChild(li);
    });
  }
}

async function openResultWindow(name, test) {
  // backend 요청
  const data = await apiGet(`/api/result?name=${encodeURIComponent(name)}&test=${encodeURIComponent(test)}`);

  // 새 창 열고 렌더
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) {
    alert("팝업 차단이 되어 새 창을 열 수 없습니다.");
    return;
  }

  const html = `
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>진단 결과 - ${escapeHtml(data.name)} - ${escapeHtml(data.test)}</title>
  <style>
    body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:16px; background:#f7f7fb;}
    .card{background:#fff; border-radius:14px; padding:14px; box-shadow:0 6px 20px rgba(0,0,0,0.06); margin:12px 0;}
    .k{display:inline-block; width:90px; font-weight:700; color:#374151;}
    .v{color:#111827;}
    .muted{color:#6b7280;}
    table{border-collapse:collapse; width:100%;}
    td,th{border-bottom:1px solid #e5e7eb; padding:8px;}
  </style>
</head>
<body>
  <h2>진단 결과</h2>

  <div class="card">
    <div><span class="k">이름</span><span class="v">${escapeHtml(data.name)}</span></div>
    <div><span class="k">생년월일</span><span class="v">${escapeHtml(data.birth_date || "")}</span></div>
    <div><span class="k">성별</span><span class="v">${escapeHtml(data.sex || "")}</span></div>
    <div><span class="k">체중</span><span class="v">${escapeHtml(data.weight || "")}</span></div>
    <div><span class="k">키</span><span class="v">${escapeHtml(data.height || "")}</span></div>
  </div>

  <div class="card">
    <div class="muted">Test: ${escapeHtml(data.test)}</div>
    <h3 style="margin:8px 0 0 0;">${escapeHtml(data.summary || "")}</h3>
    <div style="margin-top:6px;">Score: <b>${escapeHtml(String(data.score ?? ""))}</b></div>

    <div style="margin-top:12px;">
      <div class="muted">Details</div>
      <table>
        <thead><tr><th>Item</th><th>Value</th></tr></thead>
        <tbody>
          ${(data.details || []).map(d => `<tr><td>${escapeHtml(d.item)}</td><td>${escapeHtml(d.value)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Diagnosis page ---
async function initDiagnosisPage() {
  const box = document.getElementById("diagClientInfo");
  const name = getSelectedClientName();
  if (!name) return;

  const c = await apiGet(`/api/client/${encodeURIComponent(name)}`);
  box.innerHTML = `
    <div><b>${escapeHtml(c.name)}</b></div>
    <div class="muted">${escapeHtml(c.birth_date || "")} / ${escapeHtml(c.sex || "")} / ${escapeHtml(c.weight || "")} / ${escapeHtml(c.height || "")}</div>
  `;
}

// --- Results page ---
async function initResultsPage() {
  const clientBox = document.getElementById("resClientInfo");
  const latestBox = document.getElementById("latestResult");

  const name = getSelectedClientName();
  if (!name) return;

  const c = await apiGet(`/api/client/${encodeURIComponent(name)}`);
  clientBox.innerHTML = `
    <div><b>${escapeHtml(c.name)}</b></div>
    <div class="muted">${escapeHtml(c.birth_date || "")} / ${escapeHtml(c.sex || "")} / ${escapeHtml(c.weight || "")} / ${escapeHtml(c.height || "")}</div>
  `;

  const data = await apiGet(`/api/latest_result?name=${encodeURIComponent(name)}`);
  if (!data.latest) {
    latestBox.textContent = "진단 기록이 없습니다.";
    return;
  }

  const r = data.result;
  latestBox.innerHTML = `
    <div class="muted">Latest: ${escapeHtml(data.latest)}</div>
    <div style="margin-top:6px;"><b>${escapeHtml(r.summary || "")}</b></div>
    <div style="margin-top:6px;">Score: <b>${escapeHtml(String(r.score ?? ""))}</b></div>
    <div style="margin-top:10px;">
      <button id="openLatestBtn" style="border:none;padding:10px 12px;border-radius:10px;cursor:pointer;">
        새 창으로 자세히 보기
      </button>
    </div>
  `;

  document.getElementById("openLatestBtn").addEventListener("click", () => {
    openResultWindow(name, data.latest);
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.PAGE === "client") await initClientPage();
    if (window.PAGE === "diagnosis") await initDiagnosisPage();
    if (window.PAGE === "results") await initResultsPage();
  } catch (e) {
    console.error(e);
    alert("오류: " + e.message);
  }
});