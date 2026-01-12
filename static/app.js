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
  const listEl = document.getElementById("clientList");
  const detail = document.getElementById("clientDetail");
  const noHint = document.getElementById("noSelectionHint");
  const testList = document.getElementById("testList");

  const btnNew = document.getElementById("btnNewClient");
  btnNew.addEventListener("click", () => openNewClientModal());

  await loadAndRenderClientList();

  // 이전 선택 복원
  const saved = getSelectedClientName();
  if (saved) await selectClient(saved);

  // --- New Client Modal ---
  const modal = document.getElementById("newClientModal");
  const backdrop = document.getElementById("newClientBackdrop");
  const btnClose = document.getElementById("btnCloseNewClient");
  const btnCancel = document.getElementById("btnCancelNewClient");
  const form = document.getElementById("newClientForm");

  function openNewClientModal(){
    form.reset();
  
    // 생일 달력 기본 연도를 1960로 “유도” (대부분의 브라우저에서 1960로 열림)
    const birth = document.getElementById("m_birth_date");
    if (birth && !birth.value) birth.value = "1960-01-01";
  
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => document.getElementById("m_name")?.focus(), 0);
  }
  

  function closeNewClientModal(){
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  backdrop.addEventListener("click", closeNewClientModal);
  btnClose.addEventListener("click", closeNewClientModal);
  btnCancel.addEventListener("click", closeNewClientModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeNewClientModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (document.getElementById("m_name").value || "").trim();
    if (!name) return;

    const payload = {
      name,
      birth_date: (document.getElementById("m_birth_date").value || "").trim(),
      sex: (document.getElementById("m_sex").value || "").trim(),
      height: (document.getElementById("m_height").value || "").trim(),
      weight: (document.getElementById("m_weight").value || "").trim(),
      surgery_history: (document.getElementById("m_surgery_history").value || "").trim(),
      medications: (document.getElementById("m_medications").value || "").trim(),
      tests: []
    };

    const r = await fetch("/api/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      alert("등록 실패: " + await r.text());
      return;
    }

    closeNewClientModal();

    // 목록 갱신 + 새 고객 자동 선택
    console.log("--- select", name)
    // selected 값을 저장 (리스트 active 표시가 맞게 나옴)
    setSelectedClientName(name);
    // 리스트 즉시 갱신 (새 고객이 바로 나타남)
    await loadAndRenderClientList();
    // 방금 등록한 고객을 실제로 선택 + 오른쪽 상세 표시
    await renderClientDetail(name);
    detail.classList.remove("hidden");

    // 선택된 항목이 화면에 보이도록 스크롤
    const activeEl = listEl.querySelector(`.client-item[data-name="${CSS.escape(name)}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  });
  
  async function loadAndRenderClientList() {
    const data = await apiGet("/api/clients"); // { names, clients }
    const clients = data.clients || (data.names || []).map(n => ({ name: n, birth_date: "", sex: "" }));

    listEl.innerHTML = "";
    clients.forEach(c => {
      const row = document.createElement("div");
      row.className = "client-item";
      row.dataset.name = c.name;

      // const left = document.createElement("div");
      // left.className = "client-leftinfo";

      const main = document.createElement("div");
      main.className = "client-main";

      const nm = document.createElement("div");
      nm.className = "client-name";
      nm.textContent = c.name || "";

      const meta = document.createElement("div");
      meta.className = "client-meta";

      const bd = (c.birth_date || "").trim();
      const sx = (c.sex || "").trim();
      meta.textContent = [bd, sx].filter(Boolean).join(" / "); // ✅ 이름 오른쪽에 생일/성별

      main.appendChild(nm);
      main.appendChild(meta);

      const del = document.createElement("button");
      del.className = "client-del";
      del.type = "button";
      del.textContent = "×"; // ✅ X 표시
      del.title = "삭제";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`정말로 '${c.name}' 고객을 삭제할까요?`)) return;

        const r = await fetch(`/api/client/${encodeURIComponent(c.name)}`, { method: "DELETE" });
        if (!r.ok) {
          alert("삭제 실패: " + await r.text());
          return;
        }

        if (getSelectedClientName() === c.name) {
          setSelectedClientName("");
          detail.classList.add("hidden");
          noHint.classList.remove("hidden");
        }
        await loadAndRenderClientList();
      });

      row.appendChild(main);
      row.appendChild(del);

      row.addEventListener("click", async () => {
        await selectClient(c.name);
      });

      listEl.appendChild(row);
    });

    updateActiveRow(getSelectedClientName());
    
    const activeEl = listEl.querySelector(`.client-item[data-name="${CSS.escape(name)}"]`);
    activeEl?.scrollIntoView({ block: "start" });

    // if (activeEl) {
    //   // 1) 가장 간단: 중앙 정렬 스크롤
    //   activeEl.scrollIntoView({ block: "center" });

    //   // 2) 혹시 block:"center"가 환경에서 애매하면(대체용):
    //   // const target = activeEl.offsetTop - (listEl.clientHeight / 2) + (activeEl.clientHeight / 2);
    //   // listEl.scrollTop = Math.max(0, target);
    // }
  }

  async function selectClient(name) {
    if (!name) return;
    setSelectedClientName(name);
    await renderClientDetail(name);

    // (4) 상세를 오른쪽 패널에 표시
    noHint.classList.add("hidden");
    detail.classList.remove("hidden");

    updateActiveRow(name);

    const activeEl = listEl.querySelector(`.client-item[data-name="${CSS.escape(name)}"]`);
    activeEl?.scrollIntoView({ block: "start" });

    // if (activeEl) {
    //   // 1) 가장 간단: 중앙 정렬 스크롤
    //   activeEl.scrollIntoView({ block: "center" });

    //   // 2) 혹시 block:"center"가 환경에서 애매하면(대체용):
    //   // const target = activeEl.offsetTop - (listEl.clientHeight / 2) + (activeEl.clientHeight / 2);
    //   // listEl.scrollTop = Math.max(0, target);
    // }
  }

  function updateActiveRow(activeName) {
    [...listEl.querySelectorAll(".client-item")].forEach(el => {
      el.classList.toggle("active", el.dataset.name === activeName);
    });
  }

  async function renderClientDetail(name) {
    const c = await apiGet(`/api/client/${encodeURIComponent(name)}`);

    document.getElementById("c_name").textContent = c.name || "";
    document.getElementById("c_birth").textContent = c.birth_date || "";
    document.getElementById("c_sex").textContent = c.sex || "";
    document.getElementById("c_weight").textContent = c.weight || "";
    document.getElementById("c_height").textContent = c.height || "";

    testList.innerHTML = "";
    (c.tests || []).forEach(t => {
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