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
    this._inner.setConfig(config.card || {});
    for (const [k, v] of Object.entries(config.vars || {})) this._inner.style.setProperty('--house-' + k, v);
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
    return { background: 'linear-gradient(180deg,#dff1ff 0%,#f6fbff 60%,#eef7e6 100%)', vars: BRICK, card };
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 'auto' }; }
}
if (!customElements.get('home-flow-styled')) customElements.define('home-flow-styled', HomeFlowStyled);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'home-flow-styled'))
  window.customCards.push({ type: 'home-flow-styled', name: 'Будиночок кольоровий / Coloured house',
    description: 'Кольоровий ізометричний будиночок (потрібна flixlix/home-flow-card). Coloured isometric house (needs flixlix/home-flow-card).', preview: true });
