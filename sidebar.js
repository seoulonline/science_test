import { sidebarFields, normalizeSidebar } from './sidebar-config.js';
const KEY = 'saien-sidebar-v1';
export function initializeSidebar(notify) {
  let values = normalizeSidebar();
  try { values = normalizeSidebar(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* Default text remains available. */ }
  const dialog = document.querySelector('#sidebar-dialog');
  const form = document.querySelector('#sidebar-form');
  const fields = document.querySelector('#sidebar-fields');
  for (const spec of sidebarFields) {
    const wrapper = document.createElement('div'); wrapper.className = 'sidebar-field';
    const label = document.createElement('label'); label.htmlFor = `sidebar-${spec.key}`; label.textContent = spec.label;
    const input = document.createElement(spec.multiline ? 'textarea' : 'input');
    input.id = label.htmlFor; input.name = spec.key; input.maxLength = spec.max; input.required = true;
    if (spec.multiline) input.rows = 3; else input.type = 'text';
    wrapper.append(label, input); fields.append(wrapper);
  }
  function apply() {
    document.querySelectorAll('[data-sidebar]').forEach(el => { el.textContent = values[el.dataset.sidebar]; });
    document.querySelector('.brand').setAttribute('aria-label', `${values.brand} 처음으로`);
    document.querySelectorAll('.side-link').forEach(el => { el.setAttribute('aria-label', values[el.dataset.view]); });
  }
  function fill(source) { sidebarFields.forEach(f => { form.elements.namedItem(f.key).value = source[f.key]; }); }
  document.querySelectorAll('[data-action="edit-sidebar"]').forEach(button => button.addEventListener('click', () => {
    fill(values); document.querySelector('#sidebar-status').textContent = ''; dialog.showModal();
  }));
  document.querySelectorAll('[data-action="close-sidebar"]').forEach(button => button.addEventListener('click', () => dialog.close()));
  document.querySelector('#sidebar-defaults').addEventListener('click', () => {
    fill(normalizeSidebar()); document.querySelector('#sidebar-status').textContent = '기본 문구를 불러왔어요. 저장을 누르면 적용됩니다.';
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (sidebarFields.some(f => !form.elements.namedItem(f.key).value.trim())) {
      document.querySelector('#sidebar-status').textContent = '공백만 있는 항목은 사용할 수 없어요.'; return;
    }
    values = normalizeSidebar(Object.fromEntries(new FormData(form))); apply();
    let saved = true;
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { saved = false; }
    dialog.close(); notify(saved ? '사이드바 문구를 이 기기에 저장했어요.' : '문구는 적용했지만 기기 저장이 불가능해 새로고침하면 사라집니다.');
  });
  apply();
}
