// Обгортка над home-flow-card: фарбує будиночок через CSS-змінні --house-*.
// Конфіг: { type: custom:home-flow-styled, vars: { wall: '#..', roof: '#..', ... }, background: '...', card: { ...конфіг home-flow-card } }
class HomeFlowStyled extends HTMLElement {
  setConfig(config) {
    this._config = config;
    customElements.whenDefined('home-flow-card').then(() => this._build());
  }
  _build() {
    const config = this._config;
    if (!this._inner) {
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
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 'auto' }; }
}
customElements.define('home-flow-styled', HomeFlowStyled);
