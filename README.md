# Deye cards for Home Assistant

**🇬🇧 English** · [🇺🇦 Українська](README.uk.md)

Two dashboard cards for Home Assistant with a Deye inverter (Solarman / Sunsynk integrations, etc.):

1. **`deye-screen-card`** — a replica of the Deye inverter screen: housing with logo, DC / AC / Normal / Alarm LEDs, 4 gauges (solar, battery, grid, home) around the "ON" circle, animated flow arrows and a live clock.
2. **`home-flow-styled`** — a wrapper around [home-flow-card](https://github.com/flixlix/home-flow-card) that paints the grey house (walls, roof, panels, lawn, sky).

| deye-screen-card | home-flow-styled |
|---|---|
| ![deye-screen-card](images/deye-screen-card.png) | ![home-flow-styled](images/home-flow-styled.png) |

House colour variants:

![variants](images/home-flow-variants.png)

---

## Installation

Both cards ship **in a single file** `ha-deye-cards.js`. Install once, then pick the one you want in "Add card":
- **Deye inverter screen**;
- **Coloured house**.

### ⚡ Quick — one-click buttons (Home Assistant 2026+)

Click a button → your Home Assistant opens straight on the right Marketplace page → **Install**.
(The first time my.home-assistant.io asks for your HA address, e.g. `http://192.168.1.10:8123`.)

| What | Button |
|---|---|
| **1. These cards** (Deye screen + coloured house) | [![Open in Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Taras1112&repository=ha-deye-cards&category=plugin) |
| **2. Home Flow Card by flixlix** (needed for the coloured house) | [![Open in Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=flixlix&repository=home-flow-card&category=plugin) |

Then reload with **Ctrl+F5**.

### Option 1 — Marketplace manually

HACS is now built into Home Assistant as **Marketplace** (sidebar → Marketplace, or `/marketplace`).

1. Marketplace → ⋮ → **Add from GitHub link** → `https://github.com/Taras1112/ha-deye-cards` → Add → **Install**.
2. For the house, also install **Home Flow Card** by **flixlix** (*"Your own little isometric home…"*) — easiest via [this link](https://my.home-assistant.io/redirect/hacs_repository/?owner=flixlix&repository=home-flow-card&category=plugin), search shows many similar cards.
   > ⚠️ There is another card with the same name by `rosenrot00` (a flow editor) — that is **not** the house.
3. Reload the page (**Ctrl+F5**).

Older HA with HACS: HACS → ⋮ → Custom repositories → same URL, type **Dashboard**.

### Option 2 — manual

1. Copy to `/config/www/deye-cards/` either the single `ha-deye-cards.js` (both cards) or only the one you need:
   - `deye-screen-card.js` — Deye screen only;
   - `home-flow-styled.js` — house only (also needs flixlix/home-flow-card).
2. **Settings → Dashboards → ⋮ → Resources → Add resource**, type **JavaScript module**, e.g. `/local/deye-cards/ha-deye-cards.js`.
3. Reload with **Ctrl+F5**. In the HA mobile app: App settings → Troubleshooting → Reset frontend cache.

### Adding a card

Dashboard → ✏️ Edit → **Add card** → search for **Deye** or **house** → pick it.

**The card finds the sensors by itself** — even with just `type: custom:deye-screen-card` in YAML.
It understands naming from different integrations and picks the inverter with the most matching sensors:

| Integration | Example names it finds |
|---|---|
| ha-solarman (davidrapan) | `sensor.deye_pv_power`, `_battery_power`, `_battery`, `_grid_power`, `_load_power`, `binary_sensor.deye_grid`, `_device_state` |
| legacy solarman (StephanJoubert) | `sensor.solarman_total_solar_power`, `_battery_soc`, `_total_grid_power`, `_total_load_power`, `_running_status` |
| Sunsynk / others | `sensor.sunsynk_solar_power`, `_battery_soc`, `_grid_power`, `_essential_power`, `binary_sensor.sunsynk_grid_connected` |

Values in **kW** are converted to W automatically. With several inverters (e.g. `lp1` and `lp3`) or a wrong match, just set the sensors in YAML — explicit settings always win over auto-detection.

### Point-and-click setup and charts

- **No-YAML editor:** ✏️ on the card → pick sensors from lists (only power / percent / status entities), gauge scale in kW, switches for housing and signs. For the house — palette from a list.
- **Size:** in dashboard edit mode the card can be resized with the mouse ("Layout" tab).
- **Charts:** tap a zone — solar, battery (or "86 %"), grid or home — and HA opens a dialog with the chart of that value. The AC / Alarm LEDs open grid and inverter-state history. The **gear** opens the inverter's device page in HA with all its settings (work mode, programs, charge currents…); override with `settings_url`.
- **Flow:** like on the Deye screen, green dots run along the lines in the direction of energy flow — from solar, to home, to/from grid, into the battery (charge) or out of it (discharge). On the house, solar, battery, grid and home are clickable too.

---

## deye-screen-card

```yaml
type: custom:deye-screen-card
solar: sensor.deye_pv_power
battery: sensor.deye_battery_power
battery_soc: sensor.deye_battery
grid: sensor.deye_grid_power
load: sensor.deye_load_power
grid_status: binary_sensor.deye_grid
alarm: sensor.deye_device_state
max: 8000
```

| Option | Required | Description |
|---|---|---|
| `solar` | no* | Solar panel power, W |
| `grid` | no* | Grid power, W. **Positive = import**, negative = export |
| `load` | no* | Home consumption, W |
| `battery` | no | Battery power, W. **Positive = discharge**, negative = charge (as in Deye/Solarman) |
| `battery_soc` | no | Battery state of charge, % — shown above the battery |
| `grid_status` | no | Grid presence `binary_sensor` → **AC** LED. Without it AC is lit whenever power flows through the grid |
| `alarm` | no | Alarm entity → red **Alarm** LED. Triggers on states `on`, `problem`, `Alarm`, `Fault` |
| `max` | no | Gauge limit in W, default `8000` |
| `frame` | no | `false` — screen only, without the housing |
| `invert_battery` | no | `true` — if your integration uses the opposite battery sign (charge positive) |
| `invert_grid` | no | `true` — if your grid sign is opposite (import negative) |

\* If omitted — detected automatically.

The **AC** LED is lit while **the grid is present** and goes dark during an outage. The **DC** LED is lit only while the panels produce power (as on the inverter); **Normal** — when there is no alarm.

> If the battery or grid arrow points the wrong way, add `invert_battery: true` or `invert_grid: true`.

---

## home-flow-styled

```yaml
type: custom:home-flow-styled
background: linear-gradient(180deg,#dff1ff 0%,#f6fbff 60%,#eef7e6 100%)
vars:
  wall: "#f3e2c4"
  roof: "#b4553a"
  roof-back: "#8f3f2a"
  panel: "#2b4a7e"
  ground: "#d5eabf"
card:
  solar: {entity: sensor.deye_pv_power}
  battery: {entity: sensor.deye_battery_power, state_of_charge: sensor.deye_battery}
  grid: {entity: sensor.deye_grid_power}
  home: {entity: sensor.deye_load_power}
```

- `card:` — regular `home-flow-card` config (without `type`).
- `vars:` — house colours; each key becomes the CSS variable `--house-<key>`.
- `background:` — card background (colour or gradient).

Ready-made palettes are in [examples/palettes.md](examples/palettes.md), full examples in [examples/](examples/).

---

## Dashboard layout (sections)

Side by side on screens ≥ 1024 px, stacked on iPad / phone:

```yaml
type: grid
column_span: 4
cards:
  - type: heading
    heading: Energy flow
  - type: horizontal-stack          # PC: side by side
    grid_options: {columns: full}
    visibility: [{condition: screen, media_query: "(min-width: 1024px)"}]
    cards:
      - type: custom:home-flow-styled   # …
      - type: custom:deye-screen-card   # …
  - type: vertical-stack            # iPad / phone: stacked
    grid_options: {columns: full}
    visibility: [{condition: screen, media_query: "(max-width: 1023px)"}]
    cards:
      - type: custom:home-flow-styled   # …
      - type: custom:deye-screen-card   # …
```

## License

MIT — see [LICENSE](LICENSE). `home-flow-card` belongs to its author and is not part of this repository.
