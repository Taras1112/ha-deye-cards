// Обгортка над home-flow-card: фарбує будиночок через CSS-змінні --house-*.
// Конфіг: { type: custom:home-flow-styled, vars: { wall: '#..', roof: '#..', ... }, background: '...', card: { ...конфіг home-flow-card } }

// Автопошук датчиків інвертора для різних інтеграцій (ha-solarman, старий solarman, Sunsynk, deye-modbus…).
// Шукає за закінченням назви сутності, групує за префіксом пристрою і бере пристрій, де знайшлося найбільше ролей.
const HFS_ROLES = {
  solar: { d: 'sensor', u: ['W', 'kW'], s: ['pv_power', 'total_pv_power', 'pv_total_power', 'solar_power', 'total_solar_power', 'total_dc_power', 'dc_power', 'pv_input_power', 'input_power', 'solar_production', 'pv_production_power'] },
  battery: { d: 'sensor', u: ['W', 'kW'], s: ['battery_power', 'total_battery_power', 'battery_output_power', 'battery_charge_discharge_power', 'bat_power', 'battery_charging_power'] },
  battery_soc: { d: 'sensor', u: ['%'], s: ['battery', 'battery_soc', 'soc', 'battery_level', 'battery_capacity', 'battery_state_of_charge', 'state_of_charge', 'bat_soc'] },
  grid: { d: 'sensor', u: ['W', 'kW'], s: ['grid_power', 'total_grid_power', 'grid_total_power', 'grid_active_power', 'total_grid_ct_power', 'grid_ct_power', 'meter_power', 'external_power', 'grid_import_export_power'] },
  load: { d: 'sensor', u: ['W', 'kW'], s: ['load_power', 'total_load_power', 'load_total_power', 'consumption_power', 'consumption', 'essential_power', 'house_load', 'home_power', 'load'] },
  grid_status: { d: 'binary_sensor', s: ['grid', 'grid_connected', 'grid_status', 'grid_connected_status', 'grid_state'] },
  alarm: { d: 'sensor', s: ['device_state', 'running_status', 'inverter_status', 'run_state', 'device_status', 'running_state', 'inverter_state'] },
};
function hfsDetect(hass) {
  const found = {};   // prefix -> {role: entity}
  for (const [id, st] of Object.entries(hass.states)) {
    const [dom, obj] = id.split('.');
    const unit = (st.attributes || {}).unit_of_measurement;
    for (const [role, r] of Object.entries(HFS_ROLES)) {
      if (dom !== r.d || (r.u && !r.u.includes(unit))) continue;
      for (const suf of [...r.s].sort((a, b) => b.length - a.length)) {   // довші закінчення першими: total_solar_power ≠ solar_power
        if (obj !== suf && !obj.endsWith('_' + suf)) continue;
        if (/(^|_)pv\d+_power$/.test(obj)) continue;
        const pre = obj === suf ? '' : obj.slice(0, -suf.length - 1);
        const f = found[pre] = found[pre] || {};
        if (!f[role] || r.s.indexOf(suf) < f[role][1]) f[role] = [id, r.s.indexOf(suf)];
        break;
      }
    }
  }
  let best = null, score = -1;
  for (const [pre, f] of Object.entries(found)) {
    const sc = Object.keys(f).length + (f.solar ? 2 : 0) + (f.grid ? 1 : 0);
    if (sc > score) { score = sc; best = f; }
  }
  const out = {};
  if (best) for (const [k, v] of Object.entries(best)) out[k] = v[0];
  return out;
}

// Палітра «Цегла й черепиця» (типова)
const BRICK = { wall: '#f3e2c4', 'wall-top': '#f8ecd6', gable: '#e6cfa8', 'gable-top': '#ecd8b6', fascia: '#fff7ea', roof: '#b4553a',
  'roof-back': '#8f3f2a', panel: '#2b4a7e', 'panel-top': '#3a5d96', 'panel-seam': '#8fb0de', ground: '#d5eabf',
  shadow: 'rgba(60,90,40,.25)', 'box-front': '#ffffff', 'box-side': '#dfe3ea' };
const HFS_PALETTES = {
  brick: { name: 'Цегла й черепиця', bg: 'linear-gradient(180deg,#dff1ff 0%,#f6fbff 60%,#eef7e6 100%)', vars: BRICK },
  modern: { name: 'Сучасний: білий + графіт', bg: 'linear-gradient(180deg,#cfe9ff 0%,#f4faff 70%)', vars: { wall: '#fafafa', 'wall-top': '#ffffff', gable: '#e9eaec', 'gable-top': '#f1f2f3', fascia: '#ffffff', roof: '#3b3f46', 'roof-back': '#2a2d33', panel: '#1d3461', 'panel-top': '#27467f', 'panel-seam': '#6f8fc4', ground: '#c4e3a9', shadow: 'rgba(30,60,30,.22)' } },
  nordic: { name: 'Скандинавський: дерево + зелений дах', bg: 'linear-gradient(180deg,#e8f4ff 0%,#ffffff 100%)', vars: { wall: '#c98d5b', 'wall-top': '#d9a274', gable: '#b27648', 'gable-top': '#bf8455', fascia: '#f4efe6', roof: '#3f5f4a', 'roof-back': '#2f4a39', panel: '#22344f', 'panel-top': '#2e4567', 'panel-seam': '#7d97bd', ground: '#e3efd6', shadow: 'rgba(50,70,40,.25)' } },
  evening: { name: 'Теплий вечір', bg: 'linear-gradient(180deg,#ffd9a8 0%,#ffeeda 45%,#f3f7e6 100%)', vars: { wall: '#ffe7c2', 'wall-top': '#fff0d6', gable: '#f2d3a3', 'gable-top': '#f7dcb2', fascia: '#fff8ec', roof: '#6b4a3a', 'roof-back': '#4f362a', panel: '#1f2c4a', 'panel-top': '#2b3c62', 'panel-seam': '#8193c0', ground: '#bcd99b', shadow: 'rgba(80,50,20,.3)' } },
  grey: { name: 'Сірий (як оригінал)', bg: '', vars: {} },
};
class HomeFlowStyled extends HTMLElement {
  setConfig(config) {
    this._config = config;
    customElements.whenDefined('home-flow-card').then(() => this._build());
    clearTimeout(this._miss);
    this._miss = setTimeout(() => {
      if (!customElements.get('home-flow-card') && !this._inner) this.innerHTML =
        '<ha-card style="padding:16px">Потрібна картка <b>Home Flow Card</b> від <b>flixlix</b> — встанови її з Магазину (Marketplace).<br>Requires <b>Home Flow Card</b> by <b>flixlix</b> — install it from the Marketplace.</ha-card>';
    }, 4000);
  }
  _build() {
    const config = this._config;
    if (!this._inner) {
      this.innerHTML = '';
      this._inner = document.createElement('home-flow-card');
      this.appendChild(this._inner);
    }
    this._inner.setConfig(Object.assign({ clickable_entities: true }, config.card || {}));   // натиск на сонце/АКБ/мережу/дім → графік
    const pal = HFS_PALETTES[config.palette] || null;
    for (const [k, v] of Object.entries(Object.assign({}, pal ? pal.vars : {}, config.vars || {}))) this._inner.style.setProperty('--house-' + k, v);
    if (!config.background && pal && pal.bg) { this._inner.style.setProperty('--ha-card-background', pal.bg); this._inner.style.setProperty('--card-background-color', pal.bg); }
    if (config.background) {
      this._inner.style.setProperty('--ha-card-background', config.background);
      this._inner.style.setProperty('--card-background-color', config.background);
    }
    if (this._hass) this._inner.hass = this._hass;
  }
  set hass(h) { this._hass = h; if (this._inner) this._inner.hass = h; }
  static getStubConfig(hass) {
    const d = hfsDetect(hass), card = {};
    if (d.solar) card.solar = { entity: d.solar };
    if (d.grid) card.grid = { entity: d.grid };
    if (d.load) card.home = { entity: d.load };
    if (d.battery) card.battery = d.battery_soc ? { entity: d.battery, state_of_charge: d.battery_soc } : { entity: d.battery };
    return { palette: 'brick', card };
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
  static getConfigElement() { return document.createElement('home-flow-styled-editor'); }
}


// Простий редактор на звичайних списках — не залежить від лінивого завантаження вибирачів HA.
function hfsEditorStyle() {
  return `<style>
    .f{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;font:14px var(--paper-font-body1_-_font-family,system-ui,sans-serif);color:var(--primary-text-color)}
    .f>*{min-width:0}
    .f label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--secondary-text-color)}
    .f .w{grid-column:1/-1}
    .f select,.f input[type=number]{width:100%;box-sizing:border-box;font-size:14px;padding:8px;border-radius:6px;border:1px solid var(--divider-color,#ccc);background:var(--card-background-color,#fff);color:var(--primary-text-color)}
    .f .chk{flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--primary-text-color)}
    .f .hint{grid-column:1/-1;font-size:12px;color:var(--secondary-text-color)}
  </style>`;
}
function hfsEntityOptions(hass, filter, current) {
  const ids = Object.keys(hass.states).filter(id => filter(id, hass.states[id])).sort();
  if (current && !ids.includes(current)) ids.unshift(current);
  const name = id => { const f = hass.states[id] && hass.states[id].attributes.friendly_name; return f ? `${f} — ${id}` : id; };
  return '<option value="">— автоматично —</option>' + ids.map(id => `<option value="${id}"${id === current ? ' selected' : ''}>${name(id)}</option>`).join('');
}
const hfsIsPower = (id, s) => id.startsWith('sensor.') && ['W', 'kW'].includes(s.attributes.unit_of_measurement);
const hfsIsPct = (id, s) => id.startsWith('sensor.') && s.attributes.unit_of_measurement === '%';
const hfsIsStatus = (id, s) => id.startsWith('binary_sensor.') || (id.startsWith('sensor.') && !s.attributes.unit_of_measurement && isNaN(parseFloat(s.state)));

// Візуальний редактор будиночка: палітра зі списку + датчики.
class HomeFlowStyledEditor extends HTMLElement {
  setConfig(c) { this._c = JSON.parse(JSON.stringify(c)); this._render(); }
  set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
  _render() {
    if (!this._hass || !this._c) return;
    const c = this._c, h = this._hass, card = c.card || {};
    const cur = { solar: (card.solar || {}).entity, battery: (card.battery || {}).entity, soc: (card.battery || {}).state_of_charge, grid: (card.grid || {}).entity, home: (card.home || {}).entity };
    const sel = (k, label, f, wide) => `<label class="${wide ? 'w' : ''}">${label}<select data-k="${k}">${hfsEntityOptions(h, f, cur[k])}</select></label>`;
    const pal = c.palette || (c.vars ? '' : 'brick');
    this.innerHTML = hfsEditorStyle() + `<div class="f">
      <label class="w">Кольори будиночка<select data-k="palette">${c.vars && !c.palette ? '<option value="" selected>свої кольори (з YAML)</option>' : ''}${Object.entries(HFS_PALETTES).map(([k, p]) => `<option value="${k}"${k === pal ? ' selected' : ''}>${p.name}</option>`).join('')}</select></label>
      ${sel('solar', 'Сонце — потужність панелей', hfsIsPower, true)}
      ${sel('battery', 'Батарея — потужність', hfsIsPower)}${sel('soc', 'Батарея — заряд, %', hfsIsPct)}
      ${sel('grid', 'Мережа', hfsIsPower)}${sel('home', 'Споживання будинку', hfsIsPower)}
      <div class="hint">Натиск на сонце / батарею / мережу / дім на картці відкриває графік.</div>
    </div>`;
    this.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.k, v = el.value, c2 = JSON.parse(JSON.stringify(this._c)), cd = c2.card = c2.card || {};
      if (k === 'palette') { if (v) { c2.palette = v; delete c2.vars; delete c2.background; } }
      else if (k === 'soc') { if (cd.battery) { if (v) cd.battery.state_of_charge = v; else delete cd.battery.state_of_charge; } }
      else { const key = k; if (v) cd[key] = Object.assign({}, cd[key] || {}, { entity: v }); else delete cd[key]; }
      this._c = c2;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c2 }, bubbles: true, composed: true }));
    }));
  }
}
if (!customElements.get('home-flow-styled-editor')) customElements.define('home-flow-styled-editor', HomeFlowStyledEditor);
if (!customElements.get('home-flow-styled')) customElements.define('home-flow-styled', HomeFlowStyled);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'home-flow-styled'))
  window.customCards.push({ type: 'home-flow-styled', name: 'Будиночок кольоровий / Coloured house',
    description: 'Кольоровий ізометричний будиночок (потрібна flixlix/home-flow-card). Coloured isometric house (needs flixlix/home-flow-card).', preview: true });
