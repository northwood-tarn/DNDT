
// tools/area-editor/app/renderer/panels/validationPanel.js
export function mountValidation(store, el){
  function render(){
    el.innerHTML = `<h2>Validation</h2>`;
    const issues = store.state.issues;
    if (!issues || issues.length === 0){
      const ok = document.createElement('div');
      ok.className = 'issue ok';
      ok.textContent = '✓ No issues found.';
      el.appendChild(ok);
      return;
    }
    for (const msg of issues){
      const div = document.createElement('div');
      div.className = 'issue';
      div.textContent = msg;
      el.appendChild(div);
    }
  }

  store.subscribe(render);
  render();
}
