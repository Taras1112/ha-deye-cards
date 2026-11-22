// ha-deye-cards — обидві картки в одному файлі (для Магазину/HACS). Both cards in one file.
// Картка «як інвертор Deye»: корпус з логотипом і лампочками DC/AC/Normal/Alarm, екран із 4 шкалами навколо «ON».
// Конфіг: solar, battery, battery_soc, grid, load — сутності у W; max — межа шкали у W (типово 8000);
//   grid_status — binary_sensor наявності мережі (лампочка AC); alarm — binary_sensor/сенсор аварії (лампочка Alarm);
//   frame: false — лише екран без корпусу.
// Знаки як в інверторі: battery > 0 — розряд (в інвертор), grid > 0 — купівля (в інвертор).


// Автопошук датчиків інвертора для різних інтеграцій (ha-solarman, старий solarman, Sunsynk, deye-modbus…).
// Шукає за закінченням назви сутності, групує за префіксом пристрою і бере пристрій, де знайшлося найбільше ролей.
const DEYE_ROLES = {
  solar: { d: 'sensor', u: ['W', 'kW'], s: ['pv_power', 'total_pv_power', 'pv_total_power', 'solar_power', 'total_solar_power', 'total_dc_power', 'dc_power', 'pv_input_power', 'input_power', 'solar_production', 'pv_production_power'] },
  battery: { d: 'sensor', u: ['W', 'kW'], s: ['battery_power', 'total_battery_power', 'battery_output_power', 'battery_charge_discharge_power', 'bat_power', 'battery_charging_power'] },
  battery_soc: { d: 'sensor', u: ['%'], s: ['battery', 'battery_soc', 'soc', 'battery_level', 'battery_capacity', 'battery_state_of_charge', 'state_of_charge', 'bat_soc'] },
  grid: { d: 'sensor', u: ['W', 'kW'], s: ['grid_power', 'total_grid_power', 'grid_total_power', 'grid_active_power', 'total_grid_ct_power', 'grid_ct_power', 'meter_power', 'external_power', 'grid_import_export_power'] },
  load: { d: 'sensor', u: ['W', 'kW'], s: ['load_power', 'total_load_power', 'load_total_power', 'consumption_power', 'consumption', 'essential_power', 'house_load', 'home_power', 'load'] },
  grid_status: { d: 'binary_sensor', s: ['grid', 'grid_connected', 'grid_status', 'grid_connected_status', 'grid_state'] },
  alarm: { d: 'sensor', s: ['device_state', 'running_status', 'inverter_status', 'run_state', 'device_status', 'running_state', 'inverter_state'] },
};
function deyeDetect(hass) {
  const found = {};   // prefix -> {role: entity}
  for (const [id, st] of Object.entries(hass.states)) {
    const [dom, obj] = id.split('.');
    const unit = (st.attributes || {}).unit_of_measurement;
    for (const [role, r] of Object.entries(DEYE_ROLES)) {
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
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
class DeyeScreenCard extends HTMLElement {
  setConfig(c) {
    this._c = Object.assign({ max: 8000, frame: true }, c);   // датчиків може не бути — знайдемо самі
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      // натиск на зону (сонце / АКБ / мережа / дім / лампочку) → стандартне вікно HA з графіком цього датчика
      this.shadowRoot.addEventListener('click', ev => {
        const path = ev.composedPath();
        if (path.find(n => n.dataset && n.dataset.act === 'settings')) return this._openSettings();
        const z = path.find(n => n.dataset && n.dataset.e);
        if (z) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: z.dataset.e }, bubbles: true, composed: true }));
      });
    }
    this._key = null; this._auto = false;
  }
  static getStubConfig(hass) {
    return Object.assign({ max: 8000 }, deyeDetect(hass));
  }
  getCardSize() { return 6; }
  // шестерня: сторінка пристрою інвертора в HA (режим роботи, програми, струми заряду…); якщо пристрою немає — налаштування картки
  _openSettings() {
    const c = this._c, h = this._hass, reg = (h && h.entities) || {};
    const ent = [c.solar, c.battery, c.grid, c.load, c.alarm].find(e => e && reg[e] && reg[e].device_id);
    const url = c.settings_url || (ent ? `/config/devices/device/${reg[ent].device_id}` : null);
    if (!url) { if (c.solar) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: c.solar }, bubbles: true, composed: true })); return; }
    history.pushState(null, '', url);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
  static getConfigElement() { return document.createElement('deye-screen-card-editor'); }
  connectedCallback() { this._tick = setInterval(() => this._clock(), 1000); }
  disconnectedCallback() { clearInterval(this._tick); }
  _clock() {
    const n = new Date(), p = x => String(x).padStart(2, '0');
    const t = this.shadowRoot && this.shadowRoot.getElementById('dt');
    if (t) t.textContent = `${p(n.getMonth() + 1)}/${p(n.getDate())}/${n.getFullYear()} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
    const d = this.shadowRoot && this.shadowRoot.getElementById('dw');
    if (d) d.textContent = DAYS[n.getDay()];
  }
  _v(e) {
    const s = e && this._hass.states[e]; const n = s ? parseFloat(s.state) : NaN;
    if (isNaN(n)) return 0;
    return (s.attributes || {}).unit_of_measurement === 'kW' ? n * 1000 : n;
  }
  _on(e) { const s = e && this._hass.states[e]; return !!s && ['on', 'true', 'problem', 'alarm', 'fault', 'connected', 'on-grid', 'on grid', 'ongrid'].includes(String(s.state).toLowerCase()); }
  set hass(h) {
    this._hass = h;
    if (!this._auto) {   // чого не вказано в конфігу — підставити з автопошуку (раз)
      const d = deyeDetect(h);
      this._auto = true;
      for (const k of Object.keys(DEYE_ROLES)) if (!this._c[k] && d[k]) this._c[k] = d[k];
    }
    const c = this._c, max = c.max;
    const pv = Math.max(0, this._v(c.solar)), load = Math.max(0, this._v(c.load));
    const bat = this._v(c.battery) * (c.invert_battery ? -1 : 1), grid = this._v(c.grid) * (c.invert_grid ? -1 : 1);
    const soc = c.battery_soc ? Math.round(this._v(c.battery_soc)) : null;
    const ac = c.grid_status ? this._on(c.grid_status) : Math.abs(grid) > 5;
    const alarm = c.alarm ? this._on(c.alarm) : false;
    const dc = pv > 5;   // як на інверторі: DC світиться лише коли панелі дають енергію
    const key = [pv, bat, grid, load, soc, ac, alarm].join('|');
    if (key === this._key) return;
    this._key = key;
    const kw = w => (Math.abs(w) / 1000).toFixed(2);
    const R = 47, SW = 12, A0 = 140, SWEEP = 260;
    const pt = (cx, cy, a) => [cx + R * Math.cos(a * Math.PI / 180), cy + R * Math.sin(a * Math.PI / 180)];
    const arc = (cx, cy, from, to) => { const [x1, y1] = pt(cx, cy, from), [x2, y2] = pt(cx, cy, to); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    const D = '#2a3038', BG = '#eef1f3';
    const I = {
      // сонце з променями + панель 4×3 на стійці
      sun: `<g transform="scale(.86) translate(-37 -33)">
<circle cx="20" cy="17" r="9" fill="none" stroke="${D}" stroke-width="2.4"/><circle cx="20" cy="17" r="5.2" fill="none" stroke="${D}" stroke-width="1.6"/>
<path stroke="${D}" stroke-width="2.4" stroke-linecap="round" d="M18.9 4.5 L18.5 0.1 M10.4 9.0 L7.0 6.1 M7.5 18.1 L3.1 18.5 M12.0 26.6 L9.1 30.0 M21.1 29.5 L21.5 33.9 M29.6 25.0 L33.0 27.9 M32.5 15.9 L36.9 15.5"/>
<path d="M31 25 L67 25 L71 49 L19 49Z" fill="${D}" stroke="${BG}" stroke-width="3" paint-order="stroke"/>
<path stroke="${BG}" stroke-width="1.8" fill="none" d="M40.0 25 L32.0 49 M49.0 25 L45.0 49 M58.0 25 L58.0 49 M27.0 33.0 H68.3 M23.0 41.0 H69.7"/>
<path fill="${D}" d="M43 49h4.5v9H43z M33 57.5h24.5v3.5H33z"/></g>`,
      // батарея з блискавкою
      bat: `<g transform="translate(-27 -2)">
        <rect x="2" y="2" width="44" height="24" rx="4" fill="none" stroke="${D}" stroke-width="3.2"/>
        <rect x="46.5" y="9" width="5" height="10" rx="1.5" fill="${D}"/>
        <path fill="${D}" d="M33 6 15.5 15.5l9 .8L14 22.5l20-9.2-9.2-.8z"/></g>`,
      // опора ЛЕП з проводами
      grid: `<g transform="scale(.86) translate(-35 -34)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path stroke="#8d90b8" stroke-width="1.3" d="M18 18 L0 25 M18 18 L2 33 M11 30 L0 40 M11 30 L3 47 M52 18 L70 25 M52 18 L68 33 M59 30 L70 40 M59 30 L67 47"/>
<path stroke="${D}" stroke-width="2.6" d="M35 3 L24 62 M35 3 L46 62 M20 62 H50"/>
<path stroke="${D}" stroke-width="2.2" d="M18 14 H52 M18 14 L33.7 10 M52 14 L36.3 10 M11 25 H59 M11 25 L31.8 20 M59 25 L38.2 20"/>
<path stroke="${D}" stroke-width="2.4" d="M18 14 v4 M52 14 v4 M11 25 v5 M59 25 v5 M35 3 v-1"/>
<path stroke="${D}" stroke-width="1.5" d="M32.9 14 L38.9 24 M37.1 14 L31.1 24 M31.1 24 H38.9 M31.1 24 L41.2 36 M38.9 24 L28.8 36 M28.8 36 H41.2 M28.8 36 L43.4 48 M41.2 36 L26.6 48 M26.6 48 H43.4 M26.6 48 L46.0 62 M43.4 48 L24.0 62 M24.0 62 H46.0"/></g>`,
      // будинок з димарем і вікном
      home: `<g transform="translate(-31 -26)">
        <path fill="none" stroke="${D}" stroke-width="3.2" stroke-linejoin="round" d="M4 25 31 4l27 21"/>
        <path fill="${D}" d="M42 6h6v11l-6-4.6z"/>
        <path fill="${D}" d="M11 25 31 9.5 51 25v24H11z"/>
        <rect x="23" y="28" width="16" height="15" fill="${BG}"/><path stroke="${D}" stroke-width="2.4" d="M31 28v15"/>
        <path stroke="${D}" stroke-width="3" d="M2 51h58"/></g>`,
    };
    const gauge = (cx, cy, w, icon, ent) => {
      const f = Math.min(Math.abs(w) / max, 1), end = A0 + SWEEP * f, [kx, ky] = pt(cx, cy, end);
      return `<g class="zone"${ent ? ` data-e="${ent}"` : ''}><rect x="${cx - 64}" y="${cy - 56}" width="128" height="116" rx="12" class="hit"/>` +
        `<path d="${arc(cx, cy, A0, A0 + SWEEP)}" class="track"/>` +
        (f > 0.004 ? `<path d="${arc(cx, cy, A0, end)}" class="fill"/>` : '') +
        `<circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="4.5" class="knob"/>` +
        `<g transform="translate(${cx} ${cy - 2})">${icon}</g>` +
        `<text x="${cx - 60}" y="${cy + 44}" class="sc">0</text><text x="${cx + 60}" y="${cy + 44}" class="sc">${(max / 1000).toFixed(1)}</text>` +
        `<text x="${cx}" y="${cy + 43}" class="val">${kw(w)}</text><text x="${cx}" y="${cy + 53}" class="unit">kW</text></g>`;
    };
    const pvIn = pv > 5, batIn = bat > 5, batOut = bat < -5, gridIn = grid > 5, gridOut = grid < -5, loadOut = load > 5;
    const DUR = 1.6, phase = (Date.now() / 1000) % DUR;
    const ln = (d, act, rev) => `<path d="${d}" class="ln${act ? ' act' : ''}"/>` + (act ? [0, 0.5].map(k =>
      `<circle r="3.2" class="run" style="offset-path:path('${d}');animation-delay:-${(phase + k * DUR).toFixed(2)}s;animation-direction:${rev ? 'reverse' : 'normal'}"/>`).join('') : '');
    const ar = (x, y, rot, act) => act ? `<path transform="translate(${x} ${y}) rotate(${rot})" d="M-5 -4.5 L0.5 0 L-5 4.5" class="arr"/>` : '';
    const dot = (x, y, act) => act ? `<circle cx="${x}" cy="${y}" r="3" class="dot"/>` : '';
    const led = (name, on, cls, ent) => `<div class="led${ent ? ' lamp' : ''}"${ent ? ` data-e="${ent}"` : ''}><i class="${on ? cls : ''}"></i><span>${name}</span></div>`;
    const S = { sx: 100, gx: 380, ty: 112, by: 247, ox: 240, oy: 177 };
    const screen = `<svg viewBox="0 0 480 320">
  <text id="dt" x="232" y="33" class="hdr" text-anchor="middle"></text>
  <text id="dw" x="400" y="33" class="hdr" text-anchor="end"></text>
  <g class="gearz" data-act="settings" transform="translate(424 27)"><circle r="16" fill="transparent"/><path class="gear" d="M-2.2-12h4.4l.8 3.4 2.6 1.1 3-1.8 3.1 3.1-1.8 3 1.1 2.6 3.4.8v4.4l-3.4.8-1.1 2.6 1.8 3-3.1 3.1-3-1.8-2.6 1.1-.8 3.4h-4.4l-.8-3.4-2.6-1.1-3 1.8-3.1-3.1 1.8-3-1.1-2.6-3.4-.8v-4.4l3.4-.8 1.1-2.6-1.8-3 3.1-3.1 3 1.8 2.6-1.1z"/><circle r="4.6" fill="#eef1f3"/></g>
  ${gauge(S.sx, S.ty, pv, I.sun, c.solar)}
  ${gauge(S.sx, S.by, bat, I.bat, c.battery || c.battery_soc)}
  ${soc !== null ? `<text x="${S.sx}" y="${S.by - 10}" class="soc zone" data-e="${c.battery_soc}">${soc}%</text>` : ''}
  ${gauge(S.gx, S.ty, grid, I.grid, c.grid)}
  ${gauge(S.gx, S.by, load, I.home, c.load)}
  ${ln(`M152 ${S.ty} H186 V${S.oy - 8} H206`, pvIn)}${ar(208, S.oy - 8, 0, pvIn)}${dot(186, S.oy - 8, pvIn)}
  ${ln(`M152 ${S.by} H186 V${S.oy + 8} H206`, batIn || batOut, batOut)}${ar(208, S.oy + 8, 0, batIn)}${ar(158, S.by, 180, batOut)}${dot(186, S.oy + 8, batIn || batOut)}
  ${ln(`M328 ${S.ty} H294 V${S.oy - 8} H274`, gridIn || gridOut, gridOut)}${ar(272, S.oy - 8, 180, gridIn)}${ar(322, S.ty, 0, gridOut)}${dot(294, S.oy - 8, gridIn || gridOut)}
  ${ln(`M268 ${S.oy + 8} H294 V${S.by} H322`, loadOut)}${ar(324, S.by, 0, loadOut)}${dot(294, S.by, loadOut)}
  <circle cx="${S.ox}" cy="${S.oy}" r="25" class="on"/><text x="${S.ox}" y="${S.oy + 7}" class="ontx">ON</text>
</svg>`;
    this.shadowRoot.innerHTML = `
<style>
  :host{display:block}
  ha-card{overflow:hidden;padding:0}
  .dev{background:radial-gradient(ellipse at 50% 30%,#e9eaea 0%,#d3d5d6 55%,#b9bcbe 100%);padding:16px 7% 22px;text-align:center}
  .logo{font:700 38px/1 "Arial Rounded MT Bold",Arial,sans-serif;color:#1d6f7a;letter-spacing:-1px;margin:2px 0 14px;position:relative;display:inline-block}
  .logo b{position:absolute;left:1px;top:-3px;width:7px;height:7px;background:#d8282f;border-radius:1px}
  .leds{display:flex;justify-content:space-between;margin:0 6% 10px}
  .led{display:flex;flex-direction:column;align-items:center;gap:4px}
  .led i{width:17px;height:17px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3a3f44,#121416);box-shadow:inset 0 0 0 2px #2a2e32,0 1px 1px #fff8}
  .led i.g{background:radial-gradient(circle at 40% 35%,#d9ffd0,#3cff2e 45%,#16a312);box-shadow:0 0 8px 2px #4dff3a99,inset 0 0 0 2px #1c7f16}
  .led i.r{background:radial-gradient(circle at 40% 35%,#ffd6d0,#ff3a2e 45%,#b3160f);box-shadow:0 0 8px 2px #ff3a2e99,inset 0 0 0 2px #7f1c16}
  .led span{font:700 13px Arial,sans-serif;color:#1d4f5a}
  .bezel{background:#16191c;border-radius:10px;padding:9px;box-shadow:0 2px 6px #0006}
  .noframe .bezel{border-radius:12px}
  .scr{background:#eef1f3;border-radius:3px}
  svg{width:100%;height:auto;display:block}
  .track{fill:none;stroke:#2a3038;stroke-width:${SW}}
  .fill{fill:none;stroke:#2fc23c;stroke-width:${SW}}
  .knob{fill:#2fc23c;stroke:#eef1f3;stroke-width:1.2}
  .icf{fill:#2a3038}
  .val{font:700 19px Arial,sans-serif;fill:#2fb83a;text-anchor:middle}
  .unit{font:700 9px Arial,sans-serif;fill:#2a3038;text-anchor:middle}
  .sc{font:12px Arial,sans-serif;fill:#3a4048;text-anchor:middle}
  .soc{font:700 18px Arial,sans-serif;fill:#2fb83a;text-anchor:middle}
  .hdr{font:15px Arial,sans-serif;fill:#14181c}
  .gear{fill:#3d6fae}
  .ln{fill:none;stroke:#2a3038;stroke-width:1.5;stroke-dasharray:2.5 3;opacity:.35}
  .ln.act{opacity:.9}
  .run{fill:#2fc23c;stroke:#eef1f3;stroke-width:1;offset-rotate:0deg;animation:run ${1.6}s linear infinite}
  @keyframes run{from{offset-distance:0%}to{offset-distance:100%}}
  .gearz{cursor:pointer}.gearz:hover .gear{fill:#2f5a92}
  .arr{fill:none;stroke:#2a3038;stroke-width:1.6;stroke-dasharray:2 1.6;stroke-linecap:round}
  .on{fill:#fff;stroke:#2fc23c;stroke-width:3}
  .ontx{font:700 17px Arial,sans-serif;fill:#2fb83a;text-anchor:middle}
  .dot{fill:#2fc23c}
  .zone{cursor:pointer}
  .hit{fill:transparent;transition:fill .15s}
  .zone:hover .hit{fill:rgba(47,194,60,.10)}
  .lamp{cursor:pointer}
</style>
<ha-card><div class="${c.frame ? 'dev' : 'noframe'}">
  ${c.frame ? `<div class="logo"><b></b>Deye</div>
  <div class="leds">${led('DC', dc, 'g', c.solar)}${led('AC', ac, 'g', c.grid_status)}${led('Normal', !alarm, 'g', c.alarm)}${led('Alarm', alarm, 'r', c.alarm)}</div>` : ''}
  <div class="bezel"><div class="scr">${screen}</div></div>
</div></ha-card>`;
    this._clock();
  }
}


// Простий редактор на звичайних списках — не залежить від лінивого завантаження вибирачів HA.
function simpleEditorStyle() {
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
function entityOptions(hass, filter, current) {
  const ids = Object.keys(hass.states).filter(id => filter(id, hass.states[id])).sort();
  if (current && !ids.includes(current)) ids.unshift(current);
  const name = id => { const f = hass.states[id] && hass.states[id].attributes.friendly_name; return f ? `${f} — ${id}` : id; };
  return '<option value="">— автоматично —</option>' + ids.map(id => `<option value="${id}"${id === current ? ' selected' : ''}>${name(id)}</option>`).join('');
}
const isPower = (id, s) => id.startsWith('sensor.') && ['W', 'kW'].includes(s.attributes.unit_of_measurement);
const isPct = (id, s) => id.startsWith('sensor.') && s.attributes.unit_of_measurement === '%';
const isStatus = (id, s) => id.startsWith('binary_sensor.') || (id.startsWith('sensor.') && !s.attributes.unit_of_measurement && isNaN(parseFloat(s.state)));

// Візуальний редактор: датчики зі списку, шкала, перемикачі — без YAML.
class DeyeScreenCardEditor extends HTMLElement {
  setConfig(c) { this._c = Object.assign({}, c); this._render(); }
  set hass(h) { const first = !this._hass; this._hass = h; if (first) this._render(); }
  _emit() { this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._c }, bubbles: true, composed: true })); }
  _render() {
    if (!this._hass || !this._c) return;
    const c = this._c, h = this._hass;
    const sel = (k, label, f, wide) => `<label class="${wide ? 'w' : ''}">${label}<select data-k="${k}">${entityOptions(h, f, c[k])}</select></label>`;
    const chk = (k, label, def) => `<label class="chk"><input type="checkbox" data-k="${k}"${(c[k] ?? def) ? ' checked' : ''}>${label}</label>`;
    this.innerHTML = simpleEditorStyle() + `<div class="f">
      <div class="hint">Порожні поля («автоматично») картка заповнить сама — знайде датчики інвертора.</div>
      ${sel('solar', 'Сонце — потужність панелей', isPower, true)}
      ${sel('battery', 'Батарея — потужність (+ розряд)', isPower)}${sel('battery_soc', 'Батарея — заряд, %', isPct)}
      ${sel('grid', 'Мережа — потужність (+ купівля)', isPower)}${sel('load', 'Споживання будинку', isPower)}
      ${sel('grid_status', 'Наявність мережі (лампочка AC)', isStatus)}${sel('alarm', 'Стан інвертора (лампочка Alarm)', isStatus)}
      <label>Шкала, кВт (0 … N)<input type="number" data-k="max" min="1" max="50" step="0.5" value="${(c.max || 8000) / 1000}"></label>
      <div></div>
      ${chk('frame', 'Корпус з логотипом і лампочками', true)}${chk('invert_battery', 'Перевернути знак батареї', false)}
      ${chk('invert_grid', 'Перевернути знак мережі', false)}
    </div>`;
    this.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.k, v = { ...this._c };
      if (el.type === 'checkbox') v[k] = el.checked;
      else if (k === 'max') v.max = Math.round(parseFloat(el.value || '8') * 1000);
      else if (el.value) v[k] = el.value; else delete v[k];
      this._c = v; this._emit();
    }));
  }
}
if (!customElements.get('deye-screen-card-editor')) customElements.define('deye-screen-card-editor', DeyeScreenCardEditor);
if (!customElements.get('deye-screen-card')) customElements.define('deye-screen-card', DeyeScreenCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'deye-screen-card'))
  window.customCards.push({ type: 'deye-screen-card', name: 'Deye — екран інвертора / Deye inverter screen',
    description: 'Копія екрана Deye: 4 шкали навколо ON, лампочки DC/AC/Normal/Alarm. Replica of the Deye inverter display.', preview: true });

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
