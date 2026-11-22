// Обгортка над home-flow-card: фарбує будиночок через CSS-змінні --house-*.
// Конфіг: { type: custom:home-flow-styled, vars: { wall: '#..', roof: '#..', ... }, background: '...', card: { ...конфіг home-flow-card } }
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
    const ids = Object.keys(hass.states);
    const pv = ids.find(e => /^sensor\..+_pv_power$/.test(e) && !/pv\d_power$/.test(e));
    const p = pv ? pv.slice(7, -'_pv_power'.length) : 'deye';
    const card = { solar: { entity: `sensor.${p}_pv_power` }, grid: { entity: `sensor.${p}_grid_power` }, home: { entity: `sensor.${p}_load_power` } };
    if (hass.states[`sensor.${p}_battery_power`]) card.battery = { entity: `sensor.${p}_battery_power`, state_of_charge: `sensor.${p}_battery` };
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
