import { CreateWebWorkerMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

const state = {
  engine: null,
  history: [],
  qLimit: 6,
  confidenceStop: 0.85,
  temperature: 0.2,
};

const els = {
  model: document.getElementById("modelSelect"),
  qLimit: document.getElementById("qLimit"),
  temperature: document.getElementById("temperature"),
  start: document.getElementById("startBtn"),
  qaCard: document.getElementById("qaCard"),
  questionText: document.getElementById("questionText"),
  optionsWrap: document.getElementById("optionsWrap"),
  nextBtn: document.getElementById("nextBtn"),
  progressCard: document.getElementById("progressCard"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  resultCard: document.getElementById("resultCard"),
  summary: document.getElementById("summary"),
  profiles: document.getElementById("profiles"),
  extras: document.getElementById("extras"),
  downloadBtn: document.getElementById("downloadBtn"),
  msg: document.getElementById("msg"),
  installPill: document.getElementById("installPill"),
};

function info(t) { if (els.msg) els.msg.textContent = t; }
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

function setProgress(n, total) {
  const pct = Math.min(100, Math.round((n / total) * 100));
  els.progressBar.style.width = pct + "%";
  els.progressText.textContent = `Progresso: ${n}/${total}`;
}

function bar(score) {
  const filled = Math.round(score * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function cleanNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function ensureEngine() {
  if (state.engine) return state.engine;
  const modelId = els.model.value;
  info('Baixando/Inicializando modelo… (pode levar alguns minutos na primeira vez)');
  const urls = [
    '/webllm.worker.js',
    'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/dist/webllm.worker.js',
    'https://unpkg.com/@mlc-ai/web-llm@0.2.79/dist/webllm.worker.js'
  ];
  let src = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        src = await res.text();
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!src) throw new Error('webllm.worker.js não encontrado');
  const worker = new Worker(
    URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
    { type: 'module' }
  );
  const engine = await CreateWebWorkerMLCEngine(worker);
  await engine.reload({ model: modelId });
  info('Modelo pronto');
  state.engine = engine;
  return engine;
}

function systemPrompt() {
  return `Você é o VAE - Vocational Assessment Engine, um sistema de teste vocacional adaptativo generalista (STEM, saúde, artes, negócios, comunicação, direito, educação, serviço social, setor público, acadêmico, empreendedorismo, ofícios técnicos).
Regras:
- Faça UMA pergunta por vez.
- Adapte as próximas com base no histórico e no objetivo q_limit.
- Foque em interesses, valores, ambiente, estilo cognitivo, motivadores.
- Seja culturalmente neutro.
- Finalize quando confiança >= ${state.confidenceStop} ou chegar em q_limit.
- Saída sempre em JSON válido, sem texto fora do JSON.
Formato durante o teste:
{"type":"question","question":"texto","options":["A","B","C","D"],"rationale":"1-2 linhas","should_stop":false,"confidence":0.00}
Formato ao final:
{"type":"result","confidence":0.00,"summary":"...","profiles":[{"name":"...","compatibility":0.00,"why":"...","suggested_paths":["..."],"typical_environments":["..."]}],"transferable_strengths":["..."],"growth_tips":["..."]}`;
}

async function llm(messages) {
  const engine = await ensureEngine();
  let out;
  try {
    out = await engine.chat.completions.create({
    messages,
    temperature: Number(state.temperature),
    stream: false
  });
  } catch (err) {
    info('Erro ao gerar: ' + (err?.message || err));
    console.error(err);
    throw err;
  }
  return out.choices[0].message.content;
}

function tryParseJSON(txt) {
  try { return JSON.parse(txt); } catch { /* try edges */ }
  const s = txt, i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) {
    try { return JSON.parse(s.slice(i, j + 1)); } catch {}
  }
  throw new Error("Modelo retornou algo que não é JSON válido.");
}

async function nextStep(payloadFromAnswer) {
  const msgs = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: JSON.stringify({
        action: state.history.length === 0 ? "start" : (payloadFromAnswer ? "answer" : "next"),
        q_limit: state.qLimit,
        history: state.history,
        ...(payloadFromAnswer ? payloadFromAnswer : {}),
      })
    }
  ];
  const txt = await llm(msgs);
  const payload = tryParseJSON(txt);
  return payload;
}

function renderQuestion(q) {
  els.qaCard.style.display = "";
  cleanNode(els.optionsWrap);
  els.questionText.textContent = q.question || "Pergunta";
  let selected = null;
  (q.options || []).forEach((opt, i) => {
    const div = document.createElement("div");
    div.className = "opt";
    div.textContent = opt;
    div.onclick = () => {
      selected = i;
      [...els.optionsWrap.children].forEach(c => c.classList.remove("selected"));
      div.classList.add("selected");
      els.nextBtn.disabled = false;
    };
    els.optionsWrap.appendChild(div);
  });
  els.nextBtn.onclick = async () => {
    if (selected === null) return;
    state.history.push({
      q: q.question,
      options: q.options,
      answer_idx: selected,
      answer_text: q.options[selected],
    });
    els.nextBtn.disabled = true;
    const payload = await nextStep({
      answer_idx: selected,
      answer_text: q.options[selected],
    });
    handlePayload(payload);
  };
}

function renderResult(res) {
  els.resultCard.classList.remove("hidden");
  els.summary.textContent = res.summary || "—";
  cleanNode(els.profiles);
  (res.profiles || []).slice(0,6).forEach(p => {
    const row = document.createElement("div");
    row.style.margin = "8px 0";
    row.innerHTML = `<b>${p.name || "—"}</b> — ${Math.round((p.compatibility||0)*100)}% <span class="bar">${bar(p.compatibility||0)}</span><br/>
      <small style="color:#9ca3af">${p.why || ""}</small>`;
    els.profiles.appendChild(row);
  });
  cleanNode(els.extras);
  if (res.transferable_strengths?.length) {
    const h = document.createElement("h4"); h.textContent = "💪 Forças transferíveis"; els.extras.appendChild(h);
    const ul = document.createElement("ul"); res.transferable_strengths.forEach(s => { const li = document.createElement("li"); li.textContent = s; ul.appendChild(li); }); els.extras.appendChild(ul);
  }
  if (res.growth_tips?.length) {
    const h = document.createElement("h4"); h.textContent = "📈 Dicas de crescimento"; els.extras.appendChild(h);
    const ul = document.createElement("ul"); res.growth_tips.forEach(s => { const li = document.createElement("li"); li.textContent = s; ul.appendChild(li); }); els.extras.appendChild(ul);
  }
  els.downloadBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "relatorio_vocacional.json";
    a.click();
  };
}

function handlePayload(payload) {
  if (payload.type === "question") {
    els.resultCard.classList.add("hidden");
    renderQuestion(payload);
    setProgress(Math.min(state.history.length, state.qLimit), state.qLimit);
  } else if (payload.type === "result") {
    renderResult(payload);
    setProgress(state.qLimit, state.qLimit);
  } else {
    throw new Error("Payload inesperado");
  }
}

async function start() {
  state.qLimit = Math.max(4, Math.min(16, Number(els.qLimit.value || 6)));
  state.temperature = Number(els.temperature.value || 0.2);
  state.history = [];
  els.resultCard.classList.add("hidden");
  els.qaCard.style.display = "none";
  els.nextBtn.disabled = true;
  els.progressCard.style.display = "";
  setProgress(0, state.qLimit);
  const payload = await nextStep(null);
  handlePayload(payload);
}

els.start.onclick = () => start();

// WebGPU check
window.addEventListener('load', () => {
  if (!('gpu' in navigator)) {
    info('Seu navegador não tem WebGPU habilitado. Use Chrome/Edge recentes no Android/desktop. No iOS, iOS 17+ é necessário e pode ser limitado.');
    if (els.start) els.start.disabled = true;
  }
});

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installPill.classList.remove('hidden');
  els.installPill.onclick = async () => {
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') els.installPill.textContent = 'Instalado ✔';
    } catch (err) {
      console.error(err);
    } finally {
      deferredPrompt = null;
    }
  };
});

// iOS installation hint
window.addEventListener('load', () => {
  if (isIOS()) {
    els.installPill.classList.remove('hidden');
    els.installPill.textContent = 'Como instalar no iOS';
    els.installPill.onclick = () => {
      alert("No iOS, toque no botão Compartilhar do Safari e escolha 'Adicionar à Tela de Início'.");
    };
  }
});

// Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .catch(err => console.error('SW failed:', err));
  });
}
