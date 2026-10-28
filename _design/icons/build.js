// Builds snippets/ma-icon.liquid and _design/icons/specimen.html from icons.js.
// Usage: node _design/icons/build.js <fonts dir>
const fs = require('fs'), path = require('path');
const icons = require('./icons');
const root = path.join(__dirname, '..', '..');
const fonts = (process.argv[2] || '').split('\\').join('/');

// ---------- theme snippet ----------
const aliases = { 'cart-small': 'cart', disc: 'rotor' };
let cases = '';
for (const [name, d] of Object.entries(icons)) cases += `    when '${name}'\n      assign d = '${d}'\n`;
for (const [alias, to] of Object.entries(aliases)) cases += `    when '${alias}'\n      assign d = '${icons[to]}'\n`;
const liquid = `{%- comment -%}
  Metro Auto line icons ("Torque Line" set, _design/icons). 24 x 24 grid, round caps and joins.
  Edit _design/icons/icons.js and run "node _design/icons/build.js" rather than editing this file.
  Usage: {% render 'ma-icon', name: 'truck', size: 22, stroke: '#FFFFFF', width: 1.8 %}
  stroke defaults to currentColor; width (stroke width) defaults to 2.
{%- endcomment -%}
{%- liquid
  assign s = size | default: 20
  assign c = stroke | default: 'currentColor'
  assign w = width | default: 2
  case name
${cases}    else
      assign d = '${icons.shield}'
  endcase
-%}
<svg class="ma-i" width="{{ s }}" height="{{ s }}" viewBox="0 0 24 24" fill="none" stroke="{{ c }}" stroke-width="{{ w }}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="{{ d }}"></path></svg>
`;
fs.writeFileSync(path.join(root, 'snippets', 'ma-icon.liquid'), liquid);

// ---------- specimen sheet ----------
const names = Object.keys(icons);
const cell = (n, i) => {
  const red = ['heart', 'cart', 'check', 'rotor'].includes(n);
  return `<figure>
    <div class="well"><svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="${red ? '#E1251B' : '#121316'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[n]}"/></svg></div>
    <figcaption><span>${String(i + 1).padStart(2, '0')}</span>${n}</figcaption>
  </figure>`;
};
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BigS;src:url("file:///${fonts}/BigShoulders-Bold.ttf")}
@font-face{font-family:Mono;src:url("file:///${fonts}/GeistMono-Regular.ttf")}
@font-face{font-family:Jura;src:url("file:///${fonts}/Jura-Light.ttf")}
*{box-sizing:border-box}html,body{margin:0}
body{width:1600px;height:1760px;background:#F4F3EF;color:#121316;font-family:Mono,monospace;padding:96px 112px;position:relative}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #121316;padding-bottom:28px}
h1{margin:0;font-family:BigS,sans-serif;font-size:120px;line-height:.86;letter-spacing:.01em;text-transform:uppercase}
h1 em{font-style:normal;color:#E1251B}
.meta{font-size:13px;line-height:1.9;letter-spacing:.12em;text-transform:uppercase;text-align:right;color:#5B5E64}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:28px 24px;margin-top:64px}
figure{margin:0}
.well{aspect-ratio:1;border:1px solid #D9D7D0;background:#FBFAF7;display:grid;place-items:center;position:relative;
  background-image:linear-gradient(#ECEAE4 1px,transparent 1px),linear-gradient(90deg,#ECEAE4 1px,transparent 1px);background-size:calc(100%/12) calc(100%/12)}
.well::after{content:"";position:absolute;inset:calc(100%/12);border:1px dashed #E3E1DA}
.well svg{position:relative;z-index:1}
figcaption{display:flex;gap:10px;margin-top:10px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#121316}
figcaption span{color:#9A9CA1}
footer{position:absolute;left:112px;right:112px;bottom:88px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #121316;padding-top:22px}
.scale{display:flex;align-items:flex-end;gap:36px}
.scale div{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:11px;letter-spacing:.12em;color:#5B5E64}
.note{font-family:Jura,sans-serif;font-size:22px;letter-spacing:.04em;color:#121316;max-width:560px;text-align:right}
.note b{color:#E1251B;font-weight:400}
</style></head><body>
<header><h1>Torque<br><em>Line</em></h1>
<div class="meta">Metro Auto icon set<br>24 &times; 24 grid &middot; 2.0 stroke<br>round cap &middot; round join<br>${names.length} marks</div></header>
<section class="grid">${names.map(cell).join('')}</section>
<footer>
  <div class="scale">${[16, 20, 24, 32, 48].map(s => `<div><svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#121316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icons.rotor}"/></svg>${s}px</div>`).join('')}</div>
  <p class="note">One gauge of line. <b>One</b> signal colour.</p>
</footer>
</body></html>`;
fs.writeFileSync(path.join(__dirname, 'specimen.html'), html);
console.log('icons:', names.length);
