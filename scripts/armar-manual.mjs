/**
 * Arma el manual de uso en un solo archivo HTML, con las capturas incrustadas para que
 * funcione sin internet y se pueda mandar por WhatsApp o imprimir.
 * Uso: node scripts/armar-manual.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { CAPITULOS, RECORRIDO, PROBLEMAS } from './manual-contenido.mjs'

const DIR = new URL('./capturas/', import.meta.url).pathname.replace(/^\//, '')

const enBase64 = (archivo) =>
  `data:image/jpeg;base64,${readFileSync(`${DIR}${archivo}`).toString('base64')}`

const figura = (p) => `
        <figure class="captura${p.movil ? ' captura--movil' : ''}">
          <img src="${enBase64(p.img)}" alt="Pantalla: ${p.titulo}" loading="lazy" />
        </figure>`

const pantalla = (p) => `
      <article class="pantalla">
        <div class="pantalla__texto">
          <h3>${p.titulo}</h3>
          <p class="lead">${p.para}</p>
          ${p.puntos?.length ? `<ul class="marcas">${p.puntos.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
        </div>
        ${figura(p)}
      </article>`

const escenario = (e) => `
      <section class="caso${e.nota ? ' caso--nota' : ''}">
        <h4>${e.titulo}</h4>
        <ol class="pasos">${e.pasos.map((x) => `<li>${x}</li>`).join('')}</ol>
      </section>`

const capitulo = (c, n) => `
    <section class="capitulo" id="${c.id}">
      <header class="capitulo__cab">
        <span class="capitulo__n">${n}</span>
        <div>
          <h2>${c.persona}</h2>
          <p class="entra">${c.entra}</p>
        </div>
      </header>
      <p class="capitulo__resumen">${c.resumen}</p>
      ${c.pantallas.map(pantalla).join('')}
      ${c.escenarios.length ? `<h3 class="sub">Qué hacer en cada caso</h3>${c.escenarios.map(escenario).join('')}` : ''}
    </section>`

const html = `<title>Manual de uso · Distrito Novo</title>
<style>
  :root {
    --papel: #FBF9F5;
    --papel-2: #F3EEE4;
    --tinta: #1A1712;
    --tinta-2: #5C5346;
    --placa: #14120F;
    --oro: #B8862B;
    --oro-claro: #D9B463;
    --naranja: #D9741F;
    --verde: #0F6E56;
    --linea: #E2DACB;
    --serif: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: ui-monospace, 'Cascadia Code', Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --papel: #121110; --papel-2: #1C1A17; --tinta: #F2ECE0; --tinta-2: #A79D8C;
      --placa: #0B0A09; --linea: #2E2A24; --oro: #D9B463; --naranja: #EE8B3C; --verde: #4FBF9F;
    }
  }
  :root[data-theme='dark'] {
    --papel: #121110; --papel-2: #1C1A17; --tinta: #F2ECE0; --tinta-2: #A79D8C;
    --placa: #0B0A09; --linea: #2E2A24; --oro: #D9B463; --naranja: #EE8B3C; --verde: #4FBF9F;
  }
  :root[data-theme='light'] {
    --papel: #FBF9F5; --papel-2: #F3EEE4; --tinta: #1A1712; --tinta-2: #5C5346;
    --placa: #14120F; --linea: #E2DACB; --oro: #B8862B; --naranja: #D9741F; --verde: #0F6E56;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--papel); color: var(--tinta);
    font-family: var(--sans); font-size: 17px; line-height: 1.65;
  }
  .envoltura { max-width: 1180px; margin: 0 auto; padding: 0 20px 80px; }

  /* ---- Portada ---- */
  .portada {
    background: var(--placa); color: #F4EFE4; margin-bottom: 44px;
    padding: 56px 20px 48px; text-align: center;
    border-bottom: 3px solid var(--oro);
  }
  .portada h1 {
    font-family: var(--serif); font-size: clamp(2.1rem, 6vw, 3.4rem);
    margin: 0 0 6px; font-weight: 700; text-wrap: balance; color: var(--oro-claro);
  }
  .portada p { margin: 0 auto; max-width: 58ch; color: #B8AF9E; }
  .filete { width: 120px; height: 1px; background: var(--oro); margin: 18px auto; opacity: .7; }

  .dos-apps { display: grid; gap: 14px; grid-template-columns: 1fr; max-width: 720px; margin: 30px auto 0; }
  @media (min-width: 700px) { .dos-apps { grid-template-columns: 1fr 1fr; } }
  .app-caja {
    border: 1px solid rgba(184,134,43,.45); border-radius: 12px; padding: 16px 18px; text-align: left;
  }
  .app-caja b { display: block; color: var(--oro-claro); font-size: 1.05rem; }
  .app-caja span { color: #B8AF9E; font-size: .92rem; }
  .app-caja code {
    display: block; margin-top: 8px; font-family: var(--mono); font-size: .82rem;
    color: #F4EFE4; word-break: break-all;
  }

  /* ---- Índice ---- */
  .indice { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 44px; padding: 0; list-style: none; }
  .indice a {
    display: block; padding: 9px 15px; border: 1px solid var(--linea); border-radius: 999px;
    text-decoration: none; color: var(--tinta); font-size: .93rem; background: var(--papel-2);
    transition: border-color .15s, color .15s;
  }
  .indice a:hover, .indice a:focus-visible { border-color: var(--oro); color: var(--oro); }

  /* ---- Capítulos ---- */
  .capitulo { margin-bottom: 68px; scroll-margin-top: 20px; }
  .capitulo__cab { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
  .capitulo__n {
    flex: none; width: 44px; height: 44px; border-radius: 50%;
    background: var(--placa); color: var(--oro-claro);
    display: grid; place-items: center; font-family: var(--serif); font-size: 1.3rem;
  }
  .capitulo h2 { font-family: var(--serif); font-size: 1.9rem; margin: 0; line-height: 1.15; }
  .entra { margin: 2px 0 0; font-family: var(--mono); font-size: .82rem; color: var(--tinta-2); }
  .capitulo__resumen { max-width: 68ch; color: var(--tinta-2); margin: 0 0 26px; }

  .pantalla {
    display: grid; gap: 22px; align-items: start;
    padding: 22px 0 26px; border-top: 1px solid var(--linea);
  }
  @media (min-width: 900px) { .pantalla { grid-template-columns: minmax(0,1fr) minmax(0,1.15fr); gap: 34px; } }
  .pantalla h3 { font-family: var(--serif); font-size: 1.3rem; margin: 0 0 6px; }
  .lead { margin: 0 0 12px; color: var(--tinta-2); }
  .marcas { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 9px; }
  .marcas li { position: relative; padding-left: 22px; font-size: .96rem; }
  .marcas li::before {
    content: ''; position: absolute; left: 4px; top: .62em;
    width: 7px; height: 7px; border-radius: 2px; background: var(--oro);
  }
  .captura { margin: 0; }
  .captura img {
    display: block; width: 100%; height: auto; border-radius: 10px;
    border: 1px solid var(--linea); box-shadow: 0 6px 22px rgba(26,23,18,.10);
  }
  .captura--movil img { max-width: 300px; margin: 0 auto; }

  .sub {
    font-family: var(--serif); font-size: 1.15rem; margin: 34px 0 14px;
    padding-bottom: 8px; border-bottom: 1px solid var(--linea);
  }
  .caso {
    background: var(--papel-2); border-left: 3px solid var(--oro);
    border-radius: 0 10px 10px 0; padding: 16px 20px; margin-bottom: 12px;
  }
  .caso--nota { border-left-color: var(--naranja); }
  .caso h4 { margin: 0 0 10px; font-size: 1.02rem; }
  .pasos { margin: 0; padding-left: 20px; display: grid; gap: 7px; }
  .pasos li { font-size: .96rem; }

  /* ---- Recorrido y tablas ---- */
  .marco { overflow-x: auto; margin: 0 0 26px; }
  table { border-collapse: collapse; width: 100%; min-width: 560px; font-size: .95rem; }
  th, td { text-align: left; padding: 11px 14px; border-bottom: 1px solid var(--linea); vertical-align: top; }
  th { font-size: .78rem; text-transform: uppercase; letter-spacing: .07em; color: var(--tinta-2); font-weight: 600; }
  td:first-child { font-family: var(--mono); color: var(--oro); width: 3ch; }
  .donde { font-family: var(--mono); font-size: .84rem; color: var(--tinta-2); }

  .cierre {
    margin-top: 60px; padding: 22px 24px; border: 1px solid var(--linea);
    border-radius: 12px; background: var(--papel-2);
  }
  .cierre h2 { font-family: var(--serif); margin: 0 0 12px; font-size: 1.25rem; }
  .cierre dl { margin: 0; display: grid; gap: 14px; }
  .cierre dt { font-weight: 600; }
  .cierre dd { margin: 3px 0 0; color: var(--tinta-2); font-size: .95rem; }

  b, strong { font-weight: 650; }
  u { text-decoration-color: var(--naranja); text-underline-offset: 3px; }
  a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--oro); outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<header class="portada">
  <h1>Manual de uso</h1>
  <div class="filete"></div>
  <p>Cómo funciona el sistema, puesto por puesto. Cada quien lee solo su capítulo.</p>

  <div class="dos-apps">
    <div class="app-caja">
      <b>Menú</b>
      <span>Lo que ve el cliente. Se instala en su celular como “Menú”.</span>
      <code>tudominio.com/distrito-novo</code>
    </div>
    <div class="app-caja">
      <b>App del equipo</b>
      <span>Caja, cocina, pase, mesero y domicilios. Se instala aparte.</span>
      <code>tudominio.com/app</code>
    </div>
  </div>
</header>

<div class="envoltura">
  <nav aria-label="Capítulos">
    <ul class="indice">
      ${CAPITULOS.map((c) => `<li><a href="#${c.id}">${c.persona}</a></li>`).join('')}
      <li><a href="#recorrido">El recorrido de un pedido</a></li>
      <li><a href="#problemas">Si algo no cuadra</a></li>
    </ul>
  </nav>

  ${CAPITULOS.map((c, i) => capitulo(c, i + 1)).join('')}

  <section class="capitulo" id="recorrido">
    <header class="capitulo__cab">
      <span class="capitulo__n">→</span>
      <div>
        <h2>El recorrido de un pedido</h2>
        <p class="entra">De la calle a la caja, paso por paso</p>
      </div>
    </header>
    <div class="marco">
      <table>
        <thead><tr><th></th><th>Qué pasa</th><th>En detalle</th><th>Dónde se ve</th></tr></thead>
        <tbody>
          ${RECORRIDO.map(([n, q, d, w]) => `<tr><td>${n}</td><td><b>${q}</b></td><td>${d}</td><td class="donde">${w}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>

  <section class="cierre" id="problemas">
    <h2>Si algo no cuadra</h2>
    <dl>
      ${PROBLEMAS.map(([p, r]) => `<dt>${p}</dt><dd>${r}</dd>`).join('')}
    </dl>
  </section>
</div>`

writeFileSync(new URL('./manual-distrito-novo.html', import.meta.url), html, 'utf8')
console.log('Manual generado:', (html.length / 1024 / 1024).toFixed(2), 'MB')
