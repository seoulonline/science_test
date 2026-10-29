import { solve, loopChanges } from './physics.js';
import { initializeSidebar } from './sidebar.js';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const defaults = { voltage: 12, r1: 4, r2: 6, r3: 6, closed: true };
let circuit = { ...defaults }, step = 0, view = 'lesson', law = 'current', branch = 'r2', reverse = false;
let dimension = '2d', scene3D = null, scenePromise = null;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let notes = [], drafts = {}, storageOK = true, pendingRecord = null, transferCase = 0;
try { const saved = JSON.parse(localStorage.getItem('saien-lab-v1') || '{}'); notes = Array.isArray(saved.notes) ? saved.notes : []; drafts = saved.drafts || {}; } catch { storageOK = false; }
const fmt = (n, digits = 2) => (Math.abs(n) < 0.0000001 ? 0 : n).toFixed(digits);
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist() { try { localStorage.setItem('saien-lab-v1', JSON.stringify({ notes, drafts })); return true; } catch { storageOK = false; toast('기기 저장 공간을 사용할 수 없어요. 노트를 내려받아 보관해 주세요.'); return false; } }
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3300); }
function field(id, label, placeholder, rows = 3) {
  return `<div class="journal-field"><label for="${id}">${label}</label><textarea id="${id}" data-draft="${id}" rows="${rows}" placeholder="${placeholder}">${escapeHTML(drafts[id] || '')}</textarea></div>`;
}
function bindDrafts(root = document) { root.querySelectorAll('[data-draft]').forEach(el => el.addEventListener('input', () => { drafts[el.dataset.draft] = el.value; persist(); })); }
function setView(next) {
  view = next;
  ['lesson','notebook','guide'].forEach(name => $(`#${name}-view`).hidden = name !== view);
  $$('.side-link').forEach(el => { const active = el.dataset.view === view; el.classList.toggle('selected', active); if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  if (view === 'notebook') renderNotebook();
  if (view === 'guide') renderGuide();
  syncSceneActivity();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const stageInfo = [
  ['개념 만나기', '전구를 지난 전류는 줄어들까요?', '먼저 구분해요: 전류는 전하량/시간, 전압은 에너지/전하량입니다. 저항에서는 에너지가 전환됩니다.', '생각 열기', '예측하고 탐구하기'],
  ['탐구하기', '저항 하나를 바꾸면, 다른 가지의 전류도 달라질까요?', '예측을 먼저 쓰고 한 변인만 바꿔 보세요. 서로 다른 결과 3개를 비교해 관계를 찾아보세요.', '예측 → 관찰 → 설명', '새로운 상황에 적용하기'],
  ['전이하기', '회로가 달라져도, 보존이라는 생각은 통할까요?', '익숙한 회로에서 찾은 관계를 생활 속 문제와 낯선 시스템에 적용해 보세요.', '일반화 검토하기', '나의 생각 돌아보기'],
  ['성찰하기', '내 생각을 바꾼 것은 무엇이었나요?', '처음의 예측과 지금의 설명을 비교하고, 설명이 성립하는 조건까지 돌아보세요.', '모든 단계의 성찰', '탐구 노트 모아 보기']
];
function setStep(next, scroll = true) {
  step = next; if (view !== 'lesson') setView('lesson');
  $$('.steps button').forEach(el => { const active = Number(el.dataset.step) === step; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
  const info = stageInfo[step];
  $('#stage-intro').innerHTML = `<span class="question-mark">?</span><div><h2>${info[1]}</h2><p>${info[2]}</p>${step === 0 ? `<details class="first-thought"><summary>내 첫 생각 기록하기 ＋</summary>${field('reflection-before','저항을 지난 뒤 전류는 줄어들까요? 그렇게 생각한 이유는?','전하와 에너지에 대해 지금 내가 생각하는 것은…',2)}</details>` : ''}</div><span class="tag">${info[3]}</span>`;
  bindDrafts($('#stage-intro'));
  renderPhilosophy();
  $('#lab-content').hidden = step > 1;
  $('#concept-cards').hidden = step !== 0;
  $('#inquiry-work').hidden = step !== 1;
  $('#transfer-work').hidden = step !== 2;
  $('#reflection-work').hidden = step !== 3;
  if (step !== 1) $('#inquiry-work').innerHTML = '';
  if (step !== 2) $('#transfer-work').innerHTML = '';
  if (step !== 3) $('#reflection-work').innerHTML = '';
  $('#stage-caption').textContent = `0${step + 1} / 04 · ${info[0]}`;
  $('#next-stage').innerHTML = `${info[4]} <span>→</span>`;
  if (step === 1) renderInquiry();
  if (step === 2) renderTransfer();
  if (step === 3) renderReflection();
  syncSceneActivity();
  if (scroll) $('#stage-intro').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const philosophyLabels = {
  'philosophy-basis': '처음 생각의 근거',
  'philosophy-claim': '검토할 주장과 경쟁 설명',
  'philosophy-test': '두 설명을 구분할 관찰',
  'philosophy-assumptions': '새 상황의 가정과 불일치 원인',
  'philosophy-independent': '독립적인 검증과 수정 기준',
  'philosophy-revision': '증거에 따른 생각의 수정',
  'philosophy-certainty': '아직 확신할 수 없는 점'
};
function renderPhilosophy() {
  const stages = [
    {title:'관찰한 것과, 내가 해석한 것을 구분해요',
     intro:'과학에서는 관찰 자료와 그 자료에 붙인 설명을 구분합니다. 설명에는 개념과 가정이 들어가므로, 같은 자료가 다른 설명과도 맞는지 따져 봐야 합니다.',
     fields:field('philosophy-basis','내 첫 생각은 무엇에 근거하나요?','직접 본 일, 배운 모형, 비유, 직관 중 무엇인가요? 그 근거가 충분한가요?',2),
     source:'오카샤의 과학적 추론과 플랑크의 물리적 세계상을 바탕으로 만든 활동입니다. 관찰과 해석의 구분이 관찰에 이론이 전혀 개입하지 않는다는 뜻은 아닙니다.'},
    {title:'내 주장이 틀렸다면, 무엇이 달라져야 할까요?',
     intro:'예측과 결과가 맞았다는 사실만으로 설명이 유일하게 옳아지는 것은 아닙니다. 경쟁하는 설명을 떠올리고, 두 설명이 서로 다른 결과를 예측하는 조건을 찾아보세요.',
     fields:field('philosophy-claim','나의 주장과 경쟁하는 설명','예: “병렬 가지는 서로 독립적이다”와 “공통 저항 때문에 영향을 준다”는 설명은 어떤 조건에서 달라질까?',3)+field('philosophy-test','어떤 관찰이 두 설명을 구분할까요?','바꿀 변인, 그대로 둘 조건, 각 설명의 예측을 쓰세요. 내 주장을 수정할 결과도 미리 정하세요.',3),
     source:'오카샤가 다룬 시험 가능한 예측과 설명의 검토를 회로 탐구에 적용했습니다. 단순한 결과 일치와 이론의 최종 증명을 구분합니다.'},
    {title:'불일치가 생기면, 무엇부터 검토할까요?',
     intro:'관찰이 예상과 다를 때에는 설명뿐 아니라 계측기, 보이지 않는 경로, 정상 상태라는 가정도 검토합니다. 그렇다고 어떤 결과든 변명으로 넘겨서는 안 됩니다. 반복 검증에서도 차이가 남는다면 모형을 수정할 기준이 필요합니다.',
     fields:field('philosophy-assumptions','이 문제에서 유지하거나 바꿔야 할 가정은?','시스템 경계와 축적, 공통 저항, 측정 오차 중 어떤 조건이 중요한가요? 가능한 원인을 두 가지 비교해 보세요.',3)+field('philosophy-independent','어떻게 다시 확인하고, 언제 설명을 고칠까요?','다른 계측기나 독립적인 측정으로 무엇을 확인할까? 같은 차이가 반복되면 어떤 가정을 수정할까?',3),
     source:'오카샤의 이론·보조 가정 검토와 플랑크의 사실 존중을 수업 활동으로 재구성했습니다. 원래 설명을 무조건 지키거나 첫 불일치에 곧바로 폐기하지 않도록 합니다.'},
    {title:'확신의 크기보다, 믿는 이유를 점검해요',
     intro:'좋은 과학적 설명은 어떤 증거가 뒷받침하고 무엇이 아직 검토되지 않았는지 밝힙니다. 시뮬레이션은 넣어 둔 법칙으로 계산하므로 실제 자연에서의 독립적인 검증을 대신할 수 없습니다.',
     fields:field('philosophy-revision','어떤 증거 때문에 생각을 유지하거나 수정했나요?','처음의 주장 → 관찰 기록 → 지금의 설명 순서로 쓰세요. 다른 설명보다 더 타당하다고 생각한 이유도 적어 보세요.',3)+field('philosophy-certainty','아직 확신할 수 없는 점과 다음 검증은?','모형의 계산으로 확인한 것과 실제 측정이 필요한 것을 구분하세요. 생각을 다시 바꾸게 할 증거는 무엇인가요?',3),
     source:'플랑크의 신념과 사실 존중, 오카샤의 과학적 추론을 개념 기반 탐구의 성찰과 연결한 적용안입니다. 책의 직접 인용이나 자동 채점 기준이 아닙니다.'}
  ];
  const item=stages[step];
  $('#philosophy-work').innerHTML=`<article class="philosophy-panel"><span class="section-kicker">과학철학으로 생각하기 · 0${step+1}</span><h2>${item.title}</h2><p>${item.intro}</p>${step===0?`<form id="thought-check" class="thought-check"><fieldset><legend>다음 예시에서 화면을 관찰한 기록에 가장 가까운 문장은?</legend><div class="choice-list"><label><input type="radio" name="thought-kind" value="observation" required>화면의 I₂ 표시값이 0.86 A이다.</label><label><input type="radio" name="thought-kind" value="explanation">전하가 소모되지 않기 때문에 전류 관계가 유지된다.</label><label><input type="radio" name="thought-kind" value="proof">이 시뮬레이션 하나로 모든 실제 회로에서도 법칙이 참임을 증명했다.</label></div></fieldset><button class="secondary" type="submit">관찰과 해석 비교하기 →</button><div id="thought-feedback" aria-live="polite"></div></form>`:''}<div class="philosophy-fields">${item.fields}</div><p class="philosophy-source">${item.source}</p><p class="save-hint">생각의 기록은 기기에 저장되며 탐구 노트와 내려받기에 함께 담깁니다.</p></article>`;
  bindDrafts($('#philosophy-work'));
  $('#thought-check')?.addEventListener('submit', e=>{
    e.preventDefault();const choice=new FormData(e.target).get('thought-kind');
    $('#thought-feedback').className='feedback';
    $('#thought-feedback').innerHTML=`<strong>${choice==='observation'?'표시값을 읽은 기록을 골랐어요.':'관찰 자료와 그 자료에 대한 설명을 나눠 볼까요?'}</strong><p>첫 문장은 화면에 표시된 값을 읽은 기록입니다. 두 번째는 보존 개념을 사용한 설명입니다. 세 번째는 한 모형의 계산에서 모든 실제 회로로 결론을 넓힌 주장으로, 이 기록만으로 뒷받침할 수 없습니다. 화면의 값 역시 모형이 계산한 자료이며 실제 전류계의 독립적인 측정과는 구분해야 합니다.</p>`;
  });
}
function particles(path, color, current, count = 5) {
  if (current < .000001) return '';
  const duration = Math.max(1.6, Math.min(24, 7 / current));
  return Array.from({ length: count }, (_, i) => `<circle r="3.3" fill="${color}" opacity=".85"><animateMotion dur="${duration}s" begin="-${duration * i / count}s" repeatCount="indefinite" path="${path}"/></circle>`).join('');
}
function renderDiagram(s) {
  const green = '#56836a', violet = '#9b87bd', orange = '#c79c73';
  const main = 'M 425 320 L 100 320 L 100 90 L 425 90';
  const p2 = 'M 425 90 L 425 320';
  const p3 = 'M 425 90 L 655 90 L 655 320 L 425 320';
  const active2 = law === 'voltage' && branch === 'r2';
  const active3 = law === 'voltage' && branch === 'r3' && circuit.closed;
  $('#diagram').innerHTML = `<svg viewBox="0 0 760 405" role="img" aria-label="직류 회로" id="circuit-svg">
  <title>공통 저항과 병렬 회로</title>
  <path d="M 100 180 V 90 H 425 M 100 220 V 320 H 655 V 90 H 425 M 425 90 V 320" class="wire"/>
  <path d="M100 180 V90 H425 M100 220 V320 H425" class="wire wire-main"/>
  <path d="M425 90 V320" class="wire wire-r2"/><path d="M425 90 H655 V320 H425" class="wire wire-r3" style="opacity:${circuit.closed ? 1 : .45}"/>
  ${active2 || active3 ? `<path d="M100 290 V115 Q100 90 125 90 H${active2 ? '400 Q425 90 425 115 V295 Q425 320 400 320' : '630 Q655 90 655 115 V295 Q655 320 630 320'} H125 Q100 320 100 295" fill="none" stroke="${active2 ? violet : orange}" stroke-width="10" opacity=".12"/>` : ''}
  ${particles(main, green, s.i1, 8)}${particles(p2, violet, s.i2, 5)}${particles(p3, orange, s.i3, 7)}
  <rect x="244" y="76" width="85" height="28" rx="3" class="component" stroke="${green}"/><path d="M255 90 H318" stroke="${green}" stroke-width="1" opacity=".3"/>
  <rect x="411" y="173" width="28" height="72" rx="3" class="component" stroke="${violet}"/>
  <rect x="641" y="173" width="28" height="72" rx="3" class="component" stroke="${orange}"/>
  <rect x="78" y="177" width="44" height="45" fill="#fff"/>
  <path d="M76 187 H124 M85 208 H115" stroke="${green}" stroke-width="3"/><path d="M100 177 V187 M100 208 V222" stroke="${green}" stroke-width="2"/>
  <text x="61" y="187" class="svg-value">+</text><text x="65" y="213" class="svg-value">−</text>
  <text x="95" y="247" text-anchor="middle" class="svg-label">전지</text><text x="95" y="266" text-anchor="middle" class="svg-value">${circuit.voltage} V</text>
  <text x="287" y="56" text-anchor="middle" class="svg-label">R₁ <tspan font-weight="400" fill="#94a28a">${circuit.r1} Ω</tspan></text>
  <text x="455" y="202" class="svg-label">R₂</text><text x="455" y="222" class="svg-value">${circuit.r2} Ω</text>
  <text x="684" y="202" class="svg-label">R₃</text><text x="684" y="222" class="svg-value">${circuit.r3} Ω</text>
  <circle cx="425" cy="90" r="5" fill="${green}"/><circle cx="425" cy="320" r="5" fill="${green}"/>
  <rect x="412" y="51" width="26" height="24" rx="6" fill="#e9eee2"/><text x="425" y="67" text-anchor="middle" class="node-tag">A</text>
  <rect x="412" y="339" width="26" height="24" rx="6" fill="#e9eee2"/><text x="425" y="355" text-anchor="middle" class="node-tag">B</text>
  <text x="194" y="134" fill="${green}" class="current-label">I₁ = ${fmt(s.i1)} A</text><path d="M187 112 H221 l-6 -4 m6 4 l-6 4" stroke="${green}" stroke-width="1.5" fill="none"/>
  <text x="282" y="205" fill="${violet}" class="current-label">I₂ = ${fmt(s.i2)} A</text><path d="M395 143 V165 l-4 -6 m4 6 l4 -6" stroke="${violet}" stroke-width="1.5" fill="none"/>
  <text x="502" y="134" fill="${orange}" class="current-label">I₃ = ${fmt(s.i3)} A</text>${circuit.closed ? `<path d="M510 112 H544 l-6 -4 m6 4 l-6 4" stroke="${orange}" stroke-width="1.5" fill="none"/>` : ''}
  <rect x="644" y="267" width="22" height="35" fill="white"/><circle cx="655" cy="267" r="3" fill="white" stroke="${orange}" stroke-width="2"/><circle cx="655" cy="302" r="3" fill="white" stroke="${orange}" stroke-width="2"/>
  <path d="M655 267 L${circuit.closed ? '655 302' : '680 290'}" stroke="${orange}" stroke-width="2"/>
  <text x="601" y="363" class="svg-small">${circuit.closed ? '스위치 닫힘' : '스위치 열림'}</text>
  ${law === 'voltage' ? `<text x="451" y="293" class="svg-small">Vₐ − Vᵦ = ${fmt(s.branchVoltage)} V</text><text x="225" y="369" class="svg-small">기준 전위 Vᵦ = 0 V</text>` : `<text x="227" y="369" class="svg-small">전하의 흐름은 이어지고, 가지에서 나뉩니다.</text>`}
  </svg>`;
  const svg = $('#circuit-svg');
  svg.setAttribute('aria-label', `전지 ${circuit.voltage} V, 공통 저항 ${circuit.r1} Ω와 병렬 가지 ${circuit.r2} Ω, ${circuit.r3} Ω. I₁ ${fmt(s.i1)} A, I₂ ${fmt(s.i2)} A, I₃ ${fmt(s.i3)} A. 스위치 ${circuit.closed ? '닫힘' : '열림'}.`);
  svg.querySelector('title').textContent = '공통 저항과 두 병렬 가지의 직류 회로';
  if (!playing) svg.pauseAnimations();
}
function potentialChart(changes) {
  const levels = [0]; changes.forEach(d => levels.push(levels.at(-1) + d));
  const max = Math.max(...levels, 1), min = Math.min(...levels, 0), span = max - min;
  const y = v => 68 - 48 * (v - min) / span;
  const xs = [22, 145, 265, 388];
  const points = levels.map((v,i) => `${xs[i]},${y(v)}`).join(' ');
  const labels = reverse ? ['출발 B','가지 저항 역방향','R₁ 역방향','전지 + → −'] : ['출발 B','전지 − → +','R₁ 통과','가지 저항 통과'];
  return `<div class="potential-chart"><svg viewBox="0 0 415 103" role="img" aria-label="선택한 고리를 따라 변하는 전위. 출발과 도착의 전위는 같습니다."><line x1="22" x2="388" y1="${y(0)}" y2="${y(0)}" stroke="#c8d5bd" stroke-dasharray="3 4"/><polyline points="${points}" fill="none" stroke="#71915e" stroke-width="2"/>${levels.map((v,i)=>`<circle cx="${xs[i]}" cy="${y(v)}" r="3" fill="#71915e"/><text x="${xs[i]}" y="${y(v)-8}" text-anchor="middle" font-size="14" fill="#536b44">${fmt(v,1)} V</text><text x="${xs[i]}" y="91" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" font-size="12" fill="#5f7450">${labels[i]}</text>`).join('')}</svg><p>전위 경로도 · 점 사이의 선은 변화를 연결한 안내선입니다.</p></div>`;
}
function renderReadout(s) {
  if (law === 'current') {
    $('#law-readout').innerHTML = `<div class="law-heading"><strong>분기점 A에서 · 전하량 보존</strong><span>들어온 만큼, 나갑니다</span></div><div class="equation">${fmt(s.i1)} ≈ ${fmt(s.i2)} + ${fmt(s.i3)} <small>A &nbsp; | &nbsp; I₁ = I₂ + I₃</small></div><p class="law-explainer">전하가 쌓이지 않는 정상 상태에서, 단위 시간에 들어오는 전하량과 나가는 전하량은 같습니다. 표시값은 반올림한 근삿값입니다.</p>`;
  } else {
    const changes = loopChanges(circuit, branch, reverse);
    $('#law-readout').innerHTML = `<div class="law-heading"><strong>고리를 한 바퀴 · 에너지 보존</strong><span>출발점으로 돌아오면 ΔV = 0</span></div><div class="loop-tools"><select id="loop-select" aria-label="관찰할 고리"><option value="r2" ${branch === 'r2' ? 'selected' : ''}>전지 → R₁ → R₂ → 전지</option><option value="r3" ${branch === 'r3' ? 'selected' : ''}>전지 → R₁ → R₃ → 전지</option></select><button id="reverse-loop" aria-pressed="${reverse}">${reverse ? '↶ 역방향 순회' : '↷ 정방향 순회'}</button></div>${changes ? `<div class="equation">${changes.map((x,i) => `${i ? (x < 0 ? ' − ' : ' + ') : (x < 0 ? '−' : '+')}${fmt(Math.abs(x))}`).join('')} ≈ 0 <small>V &nbsp; | &nbsp; ΣΔV = 0</small></div><p class="law-explainer">저항은 전류 방향으로 −IR, 반대 방향으로 +IR. 전지는 −극에서 +극으로 +ε입니다.</p>${potentialChart(changes)}` : `<div class="feedback warning">스위치가 열려 이 경로는 닫힌 도전 고리가 아닙니다. R₃의 전류는 0 A이고, 열린 스위치 양단에는 ${fmt(s.branchVoltage)} V가 걸립니다. R₂ 고리를 고르거나 스위치를 닫아 보세요.</div>`}`;
    $('#loop-select').addEventListener('change', e => { branch = e.target.value; update(); });
    $('#reverse-loop').addEventListener('click', () => { reverse = !reverse; update(); });
  }
}
function update() {
  const s = solve(circuit);
  for (const key of ['voltage','r1','r2','r3']) {
    $(`#${key}`).value = circuit[key];
    $(`#${key}-out`).textContent = `${circuit[key]} ${key === 'voltage' ? 'V' : 'Ω'}`;
    const el = $(`#${key}`); el.style.setProperty('--range', `${100*(circuit[key] - Number(el.min))/(Number(el.max)-Number(el.min))}%`);
  }
  $('#switch').setAttribute('aria-checked', String(circuit.closed));
  $('#switch-label').textContent = circuit.closed ? '회로가 연결되어 있어요' : '이 가지에는 전류가 흐르지 않아요';
  $('#play').textContent = playing ? 'Ⅱ' : '▷'; $('#play').setAttribute('aria-label', playing ? '전류 애니메이션 일시정지' : '전류 애니메이션 재생');
  renderDiagram(s); renderReadout(s);
  scene3D?.update(circuit, s, { playing, law, branch });
}
function syncSceneActivity() {
  scene3D?.setActive(dimension === '3d' && view === 'lesson' && step <= 1);
}
async function setDimension(next) {
  dimension = next;
  $$('[data-dimension]').forEach(button => {
    const selected = button.dataset.dimension === dimension;
    button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  });
  $('#diagram').hidden = dimension !== '2d';
  $('.diagram-hint').hidden = dimension !== '2d';
  $('#scene-3d').hidden = dimension !== '3d';
  $('#scene-explanation').hidden = dimension !== '3d';
  $('#reset-camera').hidden = dimension !== '3d';
  if (dimension === '2d') { syncSceneActivity(); return; }
  $('#scene-status').textContent = scene3D ? '' : '입체 회로를 준비하고 있어요…';
  try {
    if (!scenePromise) scenePromise = import('./circuit-3d.js').then(module => {
      scene3D = module.createCircuit3D($('#scene-viewport'), () => {
        setDimension('2d'); scene3D?.dispose(); scene3D = null; scenePromise = null;
        $('[data-dimension="3d"]').disabled = true; $('[data-dimension="3d"]').title = '새로고침 후 다시 시도할 수 있습니다.';
        toast('3D 화면 연결이 중단되어 2D로 전환했어요. 페이지를 새로고침하면 3D를 다시 시도할 수 있습니다.');
      });
      return scene3D;
    });
    await scenePromise;
    $('#scene-status').textContent = '';
    scene3D.update(circuit, solve(circuit), { playing, law, branch });
    syncSceneActivity();
  } catch {
    scene3D?.dispose(); scene3D = null; scenePromise = null; $('#scene-viewport').replaceChildren();
    if (dimension === '3d') { setDimension('2d'); toast('이 브라우저에서 3D를 시작하지 못했어요. 2D에서 탐구를 계속할 수 있습니다.'); }
  }
}
function renderInquiry() {
  $('#inquiry-work').innerHTML = `<div class="section-heading"><h2>숫자를 넘어, 나의 설명 만들기</h2><span>관계 맺기 → 조사하기 → 조직하기 → 일반화하기</span></div><div class="work-grid"><article class="content-panel"><span class="section-kicker">01 · PREDICT & TEST</span><h2>먼저 예측하고, 하나만 바꿔요</h2><p>R₁ = 4 Ω, R₂ = R₃ = 6 Ω에서 시작합니다. R₂만 12 Ω으로 늘리면 I₃는 어떻게 달라질까요? 예상과 그 이유를 먼저 적어 보세요.</p>${field('prediction','나의 예측과 이유','I₃는 늘어날까, 줄어들까, 그대로일까? 그 이유는…',3)}<p class="subtle">이 예측은 회로 결과를 기록할 때 함께 가져옵니다.</p><div class="experiment-recipes"><button data-preset="base">① 기본 회로</button><button data-preset="r2">② R₂만 12 Ω</button><button data-preset="open">③ R₃ 가지 열기</button></div><p class="save-hint">세 조건의 결과를 위 회로에서 각각 기록하고 비교해 보세요.</p></article><article class="content-panel"><span class="section-kicker">02 · CONNECT & EXPLAIN</span><h2>변한 것과, 변하지 않은 것</h2><p>전류의 값이 바뀌어도 성립하는 관계는 무엇인가요? 기록한 두 가지 이상의 사례를 근거로 설명하세요.</p>${field('generalization','나의 일반화','“정상 상태의 회로에서 … 왜냐하면 …”',3)}<details><summary class="text-button">생각을 돕는 질문 열기 ＋</summary><p>분기점에서 전하가 계속 쌓인다면 정상 상태일까요? 전류와 에너지 중 저항에서 전환되는 것은 무엇인가요? 공통 저항이 없다면 가지 간 영향도 같을까요?</p></details><button class="secondary" id="compare-notes" style="margin-top:17px">관찰 기록 비교하기 ↗</button></article></div><article class="content-panel"><span class="section-kicker">PHILOSOPHY OF SCIENCE</span><h2>시뮬레이션과 맞으면, 자연에서도 참일까요?</h2><p>이 프로그램은 옴의 법칙과 보존 법칙을 사용해 값을 계산합니다. 결과의 일치는 모형 안의 관계를 보여 주지만, 자연에서 법칙이 참이라는 독립적인 실험 증거는 아닙니다. 실제 전지와 전류계로도 같은 경향이 나타나는지 확인해야 합니다.</p>${field('falsification','내 예측을 수정하게 만들 관찰은?','어떤 측정 결과가 나오면 예측을 바꿀까? 측정 오차·전지 내부 저항도 어떻게 확인할까?',2)}<p class="subtle">오카샤의 과학적 추론, 플랑크의 모형과 사실 존중을 바탕으로 만든 수업 활동입니다. 책의 직접 인용이 아닙니다.</p></article>`;
  bindDrafts($('#inquiry-work'));
  $$('[data-preset]').forEach(el => el.addEventListener('click', () => {
    circuit = { ...defaults }; if (el.dataset.preset === 'r2') circuit.r2 = 12; if (el.dataset.preset === 'open') circuit.closed = false;
    update(); $('.lab-grid').scrollIntoView({ behavior:'smooth', block:'start' }); toast('비교할 회로 조건을 적용했어요. 결과를 관찰하고 기록해 보세요.');
  }));
  $('#compare-notes').addEventListener('click', () => setView('notebook'));
}
const challenges = [
  {tag:'NEAR TRANSFER · 생활 속 적용',title:'전구 하나가 꺼졌는데, 다른 전구는?',intro:'12 V 저전압 조명 모형입니다. 공통 배선 저항 R₁ = 4 Ω, 두 조명을 각각 R₂ = R₃ = 6 Ω의 일정한 저항으로 단순화했습니다. R₃ 쪽 스위치를 열면 R₂ 조명의 전력은 어떻게 될까요?',numbers:[['전원','12 V'],['공통 저항','4 Ω'],['각 조명','6 Ω']],question:'다른 조명 R₂의 전력은…',choices:['감소한다','그대로이다','증가한다'],answer:2,explain:'닫혔을 때 I₂ ≈ 0.857 A, P₂ ≈ 4.41 W, 열었을 때 I₂ = 1.20 A, P₂ = 8.64 W입니다. 전체 전류가 줄어 공통 저항의 전압 강하가 작아지고 R₂의 전압이 커집니다. 이상적 도선(R₁ = 0)과 정전압 전원이라면 남은 조명의 전력은 그대로입니다. 실제 전구는 온도에 따라 저항이 바뀌므로 이 계산은 모형의 예측입니다.'},
  {tag:'UNFAMILIAR PROBLEM · 낯선 회로 진단',title:'세 전류계 중, 무엇부터 의심할까요?',intro:'축전기와 누설 경로가 없는 정상 직류 회로에서 A로 들어오는 전류계는 2.0 A, 두 출구의 전류계는 각각 0.8 A와 0.7 A를 가리켰습니다. 이 자료만으로 어떤 판단이 가장 적절할까요?',numbers:[['들어옴','2.0 A'],['나감 ①','0.8 A'],['나감 ②','0.7 A']],question:'관찰과 모형이 맞지 않을 때…',choices:['전하 0.5 A가 저항에서 소모된다','측정 오차·누락 경로·정상 상태 가정을 확인한다','즉시 전하량 보존 법칙을 폐기한다'],answer:1,explain:'차이는 0.5 A입니다. 가정이 모두 맞다면 이 측정값들은 정상 상태의 전하량 보존과 맞지 않습니다. 먼저 전류계 영점과 연결, 보이지 않는 가지, 일시적 전하 축적을 검토해야 합니다. 한 번의 불일치가 곧바로 보존 법칙의 폐기를 뜻하지는 않습니다. A는 전하량이 아니라 전류의 단위라는 점도 구분하세요.'},
  {tag:'FAR TRANSFER · 다른 시스템으로',title:'분기점의 생각을 물탱크에 옮긴다면?',intro:'물탱크에 매분 10 L가 들어오고 두 배출구로 각각 매분 3 L와 5 L가 나갑니다. 증발과 누수는 없습니다. 회로에서 배운 “들어오는 양 = 나가는 양”을 바로 적용할 수 있을까요?',numbers:[['유입','10 L/min'],['배출 ①','3 L/min'],['배출 ②','5 L/min']],question:'물탱크 안의 물은…',choices:['매분 2 L씩 쌓이므로 정상 상태가 아니다','보존 법칙에 따라 매분 2 L가 사라진다','유입과 유출이 다르면 보존 법칙이 깨진다'],answer:0,explain:'보존의 더 일반적인 관계는 “축적률 = 유입률 − 유출률”입니다. 물은 매분 2 L씩 늘어납니다. 정상 상태일 때만 축적률이 0이어서 유입과 유출이 같습니다. 회로에서도 전하 축적이 무시되는 정상 상태라는 조건이 중요합니다. 물의 부피 유량과 전류는 다른 물리량이며 이 비유가 전기 현상 전체를 설명하지는 않습니다.'}
];
function renderTransfer() {
  const c = challenges[transferCase];
  $('#transfer-work').innerHTML = `<nav class="transfer-nav" aria-label="전이 문제 선택">${challenges.map((_,i)=>`<button data-case="${i}" class="${i === transferCase ? 'active' : ''}" aria-pressed="${i === transferCase}">${['01 생활 속 조명','02 낯선 측정값','03 물탱크 시스템'][i]}</button>`).join('')}</nav><div class="work-grid"><article class="content-panel"><span class="challenge-tag">${c.tag}</span><h2>${c.title}</h2><p>${c.intro}</p><div class="challenge-numbers">${c.numbers.map(([a,b])=>`<div><small>${a}</small><strong>${b}</strong></div>`).join('')}</div><p class="subtle">일상 회로는 학습용 저전압 모형으로만 다룹니다. 가정용 콘센트에 직접 연결하지 마세요.</p></article><article class="content-panel"><h3>${c.question}</h3><form id="challenge-form"><div class="choice-list">${c.choices.map((text,i)=>`<label><input type="radio" name="transfer-answer" value="${i}" required><span>${text}</span></label>`).join('')}</div>${field(`transfer-reason-${transferCase}`,'어떤 개념과 증거로 설명할 수 있나요?','답을 고른 이유와 이 설명이 성립하는 조건을 적어 보세요.',3)}<button class="primary" type="submit">예측과 해설 비교하기 →</button></form><div id="challenge-feedback" aria-live="polite"></div></article></div><article class="content-panel"><h3>전이는 같은 공식을 다시 쓰는 것에서 한 걸음 더 나아갑니다.</h3><p>새 상황에서 보존되는 것은 무엇인지, 어디를 시스템의 경계로 잡았는지, 축적은 없는지 설명해 보세요. 원래의 일반화에 조건을 더해야 한다면 문장을 수정하세요.</p>${field('transfer-generalization','새 상황을 거친 나의 일반화','기존 설명에서 유지할 부분과 고칠 부분은…',2)}</article>`;
  bindDrafts($('#transfer-work'));
  $$('[data-case]').forEach(el=>el.addEventListener('click',()=>{transferCase=Number(el.dataset.case);renderTransfer();}));
  $('#challenge-form').addEventListener('submit',e=>{e.preventDefault();const chosen=Number(new FormData(e.target).get('transfer-answer'));const reason=$(`#transfer-reason-${transferCase}`).value.trim();if(!reason){toast('비교하기 전에 내 설명을 한 문장 이상 적어 주세요.');$(`#transfer-reason-${transferCase}`).focus();return;}$('#challenge-feedback').className='feedback';$('#challenge-feedback').innerHTML=`<strong>${chosen===c.answer?'선택이 모형의 예측과 일치해요.':'다른 가능성도 검토해 볼까요?'}</strong><p>${c.explain}</p><p class="subtle">선택지의 일치만으로 이해를 평가하지 않습니다. 자신의 이유를 해설 및 관찰과 비교하세요.</p>`;drafts[`transfer-answer-${transferCase}`]={chosen,reason};persist();});
}
function renderReflection() {
  $('#reflection-work').innerHTML = `<div class="work-grid"><article class="content-panel"><span class="section-kicker">BEFORE → AFTER</span><h2>나는 이렇게 생각했어요</h2><p>저항을 지난 뒤 전하가 줄어든다고 생각했나요? 처음의 생각과 달라진 점을 근거와 함께 남겨 보세요.</p>${field('reflection-before','처음의 생각','탐구를 시작할 때 나는…',3)}${field('reflection-after','지금의 설명과 나를 바꾼 증거','기록 #…에서 …를 관찰했기 때문에 지금은…',4)}</article><article class="content-panel"><span class="section-kicker">MY NEXT QUESTION</span><h2>좋은 설명에는 조건이 있어요</h2><p>이 회로는 정상 직류, 일정한 저항, 이상적 전지와 도선을 가정합니다. 빠르게 변하는 자기장이 있다면 단순한 ΣΔV = 0만으로는 부족하고 유도 기전력을 포함해야 합니다.</p>${field('reflection-limits','내 설명의 조건과 모형의 한계','어떤 상황에서는 이 모형을 수정해야 할까?',3)}${field('reflection-next','다음에 검증하고 싶은 질문','실제 회로에서는 어떤 방법으로 알아볼까?',3)}<button class="primary" id="export-reflection">나의 탐구 기록 내려받기 ↓</button></article></div><article class="content-panel"><h3>스스로 확인하는 이해의 깊이</h3><div class="rubric"><div><h3>개념 연결</h3><p>전하량과 에너지를 구분하고, 두 법칙을 보존의 관점에서 설명했나요?</p></div><div><h3>증거로 정당화</h3><p>서로 다른 두 개 이상의 회로 조건을 비교하고 예측을 수정했나요?</p></div><div><h3>전이와 조건</h3><p>새 상황에 관계를 적용하고 정상 상태 등 성립 조건을 밝혔나요?</p></div></div><p class="subtle">작성 내용은 이 브라우저에 저장됩니다. 자동 채점이나 교사에게 전송하는 기능은 없습니다.</p></article>`;
  bindDrafts($('#reflection-work')); $('#export-reflection').addEventListener('click',exportNotes);
}
function openRecord() {
  pendingRecord={circuit:{...circuit},result:solve(circuit),date:new Date().toISOString()};
  const {result:s}=pendingRecord;
  $('#record-summary').textContent=`${circuit.voltage} V · R₁ ${circuit.r1} Ω / R₂ ${circuit.r2} Ω / R₃ ${circuit.r3} Ω · 스위치 ${circuit.closed?'닫힘':'열림'}\nI₁ ${fmt(s.i1)} A / I₂ ${fmt(s.i2)} A / I₃ ${fmt(s.i3)} A`;
  $('#record-prediction').value=drafts.prediction||''; $('#record-observation').value=''; $('#record-dialog').showModal();
}
function updateCount() { $('#note-count').textContent=notes.length; }
function renderNotebook() {
  $('#notebook-view').innerHTML=`<div class="view-heading"><div class="eyebrow"><span></span> MY INQUIRY NOTE</div><h1>관찰이 모이면, 설명이 됩니다.</h1><p>서로 다른 조건의 결과를 나란히 비교해 보세요. ${storageOK?'이 브라우저에만 저장되며, 다른 기기와 동기화되지 않습니다.':'현재 기기 저장을 사용할 수 없습니다. 내려받기로 보관하세요.'}</p></div>${notes.length?`<div class="table-scroll panel"><table><caption class="subtle" style="padding:13px;text-align:left">관찰 기록 ${notes.length}개 · 소수 둘째 자리까지 표시, 식은 반올림 전 값으로 계산합니다.</caption><thead><tr><th>기록</th><th>전압</th><th>R₁ / R₂ / R₃</th><th>스위치</th><th>I₁</th><th>I₂</th><th>I₃</th><th>가지 전압</th></tr></thead><tbody>${notes.map((n,i)=>`<tr><td>#${i+1}</td><td>${n.circuit.voltage} V</td><td>${n.circuit.r1} / ${n.circuit.r2} / ${n.circuit.r3} Ω</td><td>${n.circuit.closed?'닫힘':'열림'}</td><td>${fmt(n.result.i1)} A</td><td>${fmt(n.result.i2)} A</td><td>${fmt(n.result.i3)} A</td><td>${fmt(n.result.branchVoltage)} V</td></tr>`).join('')}</tbody></table></div><div class="notebook-actions"><button class="primary" id="download-notes">전체 기록 내려받기 ↓</button><button class="secondary" id="continue-inquiry">회로로 돌아가기 →</button></div>${notes.map((n,i)=>`<article class="note-card"><h3>관찰 #${i+1}<button data-delete="${i}" aria-label="관찰 ${i+1} 삭제">삭제 ×</button></h3><small>예측</small><p>${escapeHTML(n.prediction||'예측을 작성하지 않았어요.')}</p><small>관찰과 설명</small><p>${escapeHTML(n.observation||'설명을 작성하지 않았어요.')}</p></article>`).join('')}`:`<div class="empty-state"><div class="empty-icon">▤</div><h2>첫 번째 발견을 기다리고 있어요.</h2><p>회로의 조건을 바꾸고 ‘현재 결과 기록하기’를 눌러 보세요.<br>예측과 결과를 함께 남기면 생각의 변화가 보입니다.</p><button class="primary" id="continue-inquiry">탐구 실험실로 가기 →</button></div>`}<article class="content-panel"><h3>내가 만든 일반화</h3><p style="white-space:pre-wrap">${escapeHTML(drafts.generalization||'탐구하기에서 관찰을 연결한 나의 설명을 작성해 보세요.')}</p><div class="inline-actions"><button class="secondary" id="notebook-reflect">성찰 이어 쓰기 →</button></div></article>`;
  const philosophyEntries=Object.entries(philosophyLabels).filter(([id])=>drafts[id]);
  if(philosophyEntries.length) $('#notebook-view').insertAdjacentHTML('beforeend', `<article class="content-panel"><span class="section-kicker">과학철학으로 생각한 기록</span><h2>내 설명은 무엇에 근거하나요?</h2>${philosophyEntries.map(([id,label])=>`<h3>${label}</h3><p style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHTML(drafts[id])}</p>`).join('')}</article>`);
  $('#continue-inquiry').addEventListener('click',()=>{setView('lesson');setStep(1);});
  $('#notebook-reflect').addEventListener('click',()=>setStep(3));
  $('#download-notes')?.addEventListener('click',exportNotes);
  $$('[data-delete]').forEach(el=>el.addEventListener('click',()=>{const index=Number(el.dataset.delete);notes.splice(index,1);persist();updateCount();renderNotebook();toast('관찰을 삭제했어요.');}));
}
function exportNotes() {
  const lines=['# 사이언 · 키르히호프 탐구 노트','', '학습용 정상 직류 모형의 계산 결과입니다. 실제 측정 자료가 아닙니다.',''];
  notes.forEach((n,i)=>lines.push(`## 관찰 #${i+1}`,`전압 ${n.circuit.voltage} V; R₁=${n.circuit.r1} Ω, R₂=${n.circuit.r2} Ω, R₃=${n.circuit.r3} Ω; 스위치 ${n.circuit.closed?'닫힘':'열림'}`,`I₁=${fmt(n.result.i1,4)} A, I₂=${fmt(n.result.i2,4)} A, I₃=${fmt(n.result.i3,4)} A; 가지 전압=${fmt(n.result.branchVoltage,4)} V`,`예측: ${n.prediction||'미작성'}`,`관찰과 설명: ${n.observation||'미작성'}`,''));
  const names={prediction:'탐구 전 예측',generalization:'나의 일반화',falsification:'예측을 수정할 관찰','transfer-generalization':'전이 후 일반화','reflection-before':'처음의 생각','reflection-after':'지금의 설명과 증거','reflection-limits':'모형의 한계','reflection-next':'다음 질문'};
  Object.entries(drafts).forEach(([key,value])=>{if(typeof value==='string')lines.push(`## ${philosophyLabels[key]||names[key]||key}`,value,'');else if(value&&typeof value==='object')lines.push(`## ${key}`,`선택: ${value.chosen+1}`,`이유: ${value.reason}`,'');});
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='사이언_키르히호프_탐구노트.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('탐구 노트를 파일로 내려받았어요.');
}
function renderGuide() {
  $('#guide-view').innerHTML=`<div class="view-heading"><div class="eyebrow"><span></span> LEARNING GUIDE</div><h1>공식 너머, 보존을 이해하는 탐구.</h1><p>고등학교 심화 물리 · 권장 2차시(각 50분) · 개념적 렌즈: 시스템과 보존</p></div><div class="work-grid"><article class="content-panel"><span class="section-kicker">KNOW · UNDERSTAND · DO</span><h2>이 수업에서 배우는 것</h2><h3>알기</h3><p>전류는 단위 시간당 전하량, 전위차는 단위 전하당 에너지 차이입니다. 전압과 전류의 단위, 옴의 법칙, 고리 순회 부호를 익힙니다.</p><h3>이해하기</h3><p>정상 상태의 전하량 보존은 분기점에서 유입 전류와 유출 전류의 합을 같게 합니다. 이 이상적 직류 모형에서 닫힌 경로의 전위 변화 합은 0입니다. 회로의 연결 구조는 변화가 다른 부분에 미치는 영향을 결정합니다.</p><h3>하기</h3><p>예측 → 한 변인 조작 → 여러 사례 기록 → 비교 → 개념 사이의 관계 설명 → 새로운 상황에서 검토하기를 수행합니다.</p></article><article class="content-panel"><span class="section-kicker">INQUIRY JOURNEY</span><h2>학습 흐름과 수업 개요</h2>${[['01','개념 만나기 · 15분','전하와 에너지의 구분. “전류는 소모된다”는 첫 생각을 기록하고 개념을 형성합니다.'],['02','탐구하기 · 35분','R₂ 변화와 가지 개방 등 여러 사례를 조사·비교합니다. 전하·에너지·시스템을 연결하는 나의 일반화를 씁니다.'],['03','전이하기 · 30분','조명, 모순된 측정값, 축적되는 물탱크 문제에 적용하며 설명의 조건을 다듬습니다.'],['04','성찰하기 · 20분','처음과 지금의 생각, 바뀐 근거, 다음 검증 질문을 정리합니다. 성찰은 각 단계에서도 반복합니다.']].map(([n,t,p])=>`<div class="guide-step"><span>${n}</span><div><h3>${t}</h3><p>${p}</p></div></div>`).join('')}</article></div><article class="content-panel"><h2>과학적 신념은, 검토 가능한 질문으로</h2><p>오카샤의 과학적 추론을 바탕으로 “무엇이 내 예측을 틀렸다고 말해 줄까?”를 묻습니다. 플랑크의 물리적 세계상과 사실 존중을 바탕으로 모형과 현실을 구분하고, 자료가 맞지 않을 때 가정과 측정도 살펴봅니다. 이는 제공 자료를 이 수업에 맞게 재구성한 적용안이며 저자의 직접 인용이 아닙니다.</p><p style="margin-top:10px">마샬·프렌치의 7단계는 4개 화면 안에 연결했습니다. 관계 맺기·집중하기 → 조사하기·조직 및 정리하기·일반화하기 → 전이하기, 그리고 모든 단계를 관통하는 성찰하기입니다. 사용자의 의도에 따라 기초 개념을 먼저 안내하되, 사례 사이의 관계는 학생이 직접 작성하도록 구성했습니다.</p></article><article class="content-panel"><h2>모형과 해석의 범위</h2><ul><li>전지 ε와 공통 저항 R₁, 병렬 저항 R₂·R₃로 이루어진 정상 직류 회로입니다. 스위치는 R₃ 가지에 있습니다.</li><li>닫힘: Rₚ = R₂R₃/(R₂+R₃), I₁ = ε/(R₁+Rₚ), Vₐ−Vᵦ = I₁Rₚ. 각 가지에 옴의 법칙을 적용합니다.</li><li>열림: I₃ = 0, I₁ = I₂ = ε/(R₁+R₂). 열린 스위치 양단의 전압은 0일 필요가 없습니다.</li><li>도선 저항과 전지 내부 저항, 계측기 영향, 온도 변화 및 과도 현상을 생략합니다. 공통 저항은 슬라이더 범위 1–20 Ω입니다.</li><li>빠르게 변하는 자기장이 있으면 단순한 정전기적 고리 법칙을 그대로 적용하지 말고 유도 기전력을 고려해야 합니다.</li><li>표시값은 반올림되어 눈에 보이는 합에 0.01 정도 차이가 날 수 있습니다. 계산은 반올림 전 값으로 수행합니다.</li></ul></article><article class="content-panel"><h2>참고 자료와 출처</h2><ul class="source-list"><li>사용자 제공 『고급물리학_전자기학.pdf』, 책 표기 『심화 물리』 172–173쪽(PDF 35–36쪽): 키르히호프의 분기점·고리 법칙, 보존과 부호 규약.</li><li>『과학철학_과학적신념_개념기반탐구_웹사이트_원자료.md』, 강현욱 작성·Claude 정리(2026-10-16): 1부 과학적 추론, 2부 플랑크의 모형과 신념, 3부 3.1–3.3·3.8–3.10, 4부 연결표.</li><li>『과학적_신념은_어디에서_오는가_디자인.pdf』(37쪽): 막스 플랑크, 이정훈 옮김, 김영사. 제공된 판독·편집 자료를 참고했으며 불확실한 전사와 생애 정보는 인용하지 않았습니다.</li></ul><p class="subtle">내용은 요약·재서술했습니다. 교과서 도판과 본문을 복제하지 않았으며, 회로도와 학습 문제는 이 프로그램을 위해 새로 만들었습니다. 원자료의 별도 웹사이트 제작 지시는 실행 지시로 사용하지 않았습니다.</p></article><div class="inline-actions" style="margin-bottom:25px"><button class="primary" id="guide-start">개념부터 시작하기 →</button></div>`;
  $('#guide-start').addEventListener('click',()=>{setView('lesson');setStep(0);});
}
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.view)));
$$('[data-step]').forEach(el=>el.addEventListener('click',()=>setStep(Number(el.dataset.step))));
$('#open-guide').addEventListener('click',()=>setView('guide'));
$('#begin-inquiry').addEventListener('click',()=>setStep(1));
$('#next-stage').addEventListener('click',()=>step===3?setView('notebook'):setStep(step+1));
['voltage','r1','r2','r3'].forEach(key=>$(`#${key}`).addEventListener('input',e=>{circuit[key]=Number(e.target.value);update();}));
$('#switch').addEventListener('click',()=>{circuit.closed=!circuit.closed;update();});
$('#reset').addEventListener('click',()=>{circuit={...defaults};reverse=false;branch='r2';update();toast('회로를 처음 조건으로 되돌렸어요. 탐구 기록은 유지됩니다.');});
$('#play').addEventListener('click',()=>{playing=!playing;update();});
$$('[data-law]').forEach(el=>el.addEventListener('click',()=>{law=el.dataset.law;$$('[data-law]').forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-pressed',String(b===el));});update();}));
$('#record').addEventListener('click',openRecord);
['close-dialog','cancel-record'].forEach(id=>$(`#${id}`).addEventListener('click',()=>$('#record-dialog').close()));
$('#record-form').addEventListener('submit',e=>{e.preventDefault();if(!pendingRecord)return;notes.push({...pendingRecord,prediction:$('#record-prediction').value.trim(),observation:$('#record-observation').value.trim()});const saved=persist();pendingRecord=null;updateCount();$('#record-dialog').close();toast(saved ? `관찰 #${notes.length}을 탐구 노트에 저장했어요.` : '기기 저장을 사용할 수 없어 현재 화면에만 기록했어요. 파일로 내려받아 주세요.');});
initializeSidebar(toast);
$$('[data-dimension]').forEach(button => button.addEventListener('click', () => setDimension(button.dataset.dimension)));
$('#reset-camera').addEventListener('click', () => scene3D?.resetCamera());
$('#camera-zoom-in').addEventListener('click', () => scene3D?.zoom(.9));
$('#camera-zoom-out').addEventListener('click', () => scene3D?.zoom(1.1));
$('#camera-top').addEventListener('click', () => scene3D?.top());
setStep(0,false);update();updateCount();
