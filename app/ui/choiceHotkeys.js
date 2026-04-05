// app/ui/choiceHotkeys.js
// Centralized numeric choice handling for 1–N lists.
// Usage:
//   enableChoiceHotkeys({ scopeEl: element, onChoose: (n)=>{}, allowZero:false })
//   disableChoiceHotkeys()
//   renderChoiceList(container, options)  // options: [{ label, onSelect }]
//
let _bound = false;
let _scope = null;
let _onChoose = null;
let _allowZero = false;

function keyIsDigit(k){
  // handle '1'..'9' (and optionally '0' as 10 if allowZero true)
  if (k.length !== 1) return false;
  return k >= '0' && k <= '9';
}

function toIndex(k){
  if (k === '0') return _allowZero ? 10 : null;
  const n = Number(k);
  return Number.isFinite(n) ? n : null;
}

function handleKeydown(ev){
  const k = ev.key;
  if (!keyIsDigit(k)) return;
  const idx = toIndex(k);
  if (idx == null) return;

  const root = _scope || document;
  // Preferred: standardized rows
  const sel = `.choice-opt[data-index="${idx}"]`;
  let row = root.querySelector(sel);
  if (row){
    ev.preventDefault();
    if (typeof row.onclick === 'function') { row.onclick(); return; }
    row.dispatchEvent(new Event('click', { bubbles: true }));
    return;
  }

  // Fallback: any row that starts with "N. "
  const regex = new RegExp('^' + idx + '\\.\\s');
  const candidates = Array.from(root.querySelectorAll('div, li'));
  const match = candidates.find(el => regex.test((el.textContent || '').trim()));
  if (match){
    ev.preventDefault();
    if (typeof match.onclick === 'function') { match.onclick(); return; }
    match.dispatchEvent(new Event('click', { bubbles: true }));
    return;
  }

  // Last resort: callback if provided
  if (typeof _onChoose === 'function'){
    ev.preventDefault();
    try { _onChoose(idx); } catch {}
  }
}

export function enableChoiceHotkeys({ scopeEl=null, onChoose=null, allowZero=false } = {}){
  _scope = scopeEl || null;
  _onChoose = onChoose || null;
  _allowZero = !!allowZero;
  if (_bound) return;
  window.addEventListener('keydown', handleKeydown);
  _bound = true;
}

export function disableChoiceHotkeys(){
  if (_bound){
    try { window.removeEventListener('keydown', handleKeydown); } catch {}
  }
  _bound = false;
  _scope = null;
  _onChoose = null;
  _allowZero = false;
}

export function setChoiceScope(el){ _scope = el || null; }

export function renderChoiceList(container, options=[]){
  const list = document.createElement('div');
  list.className = 'choice-list';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  options.forEach((opt, i)=>{
    const row = document.createElement('div');
    row.className = 'choice-opt';
    row.dataset.index = String(i+1);
    row.textContent = `${i+1}. ${opt.label}`;
    row.style.cursor = 'pointer';
    row.onclick = () => { try { opt.onSelect?.(); } catch {} };
    list.appendChild(row);
  });
  container.appendChild(list);
  return list;
}
