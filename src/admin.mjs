import {createServer} from 'node:http';
import {once} from 'node:events';
import {createIspAdminClient, IspAdminError, validateSettings} from './ispadmin.mjs';

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function page(res, {baseUrl = '', configured = false, messages = [], status = 200} = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Configurazione ISPAdmin</title>
<style>
:root { color-scheme: light dark; font: 16px system-ui; }
main { max-width: 34rem; margin: 4rem auto; padding: 0 1rem; }
label { display: block; margin: 1rem 0; }
input { display: block; box-sizing: border-box; width: 100%; padding: .6rem; font: inherit; }
button { padding: .5rem .8rem; font: inherit; margin: .5rem .5rem 0 0; }
</style></head><body><main>
<h1>Connessione a ISPAdmin</h1>
<p>Configurazione ${configured ? 'salvata' : 'da completare'}.</p>
${messages.length ? `<ul role="status">${messages.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : ''}
<form method="post" action="/" autocomplete="off">
<label>URL base <input name="baseUrl" type="url" required value="${escapeHtml(baseUrl ? new URL(baseUrl).origin : '')}" placeholder="https://ispadmin.example"></label>
<label>Token API <input name="token" type="password" required maxlength="1024"></label>
<label>ID fattura per la verifica (facoltativo) <input name="invoiceId" inputmode="numeric" pattern="[0-9]+"></label>
<button name="action" value="verify">Verifica connessione</button>
<button name="action" value="save">Salva</button>
</form></main></body></html>`);
}

async function verify(settings, invoiceId, fetchImpl) {
  const client = createIspAdminClient(settings, fetchImpl);
  const probes = [
    ['Clienti', 'list_clients', {name: 'ISPAdminConnectionCheck'}],
    ['Servizi', 'list_internet_services', {}],
    ['Pianificazione', 'list_tasks', {startDateFrom: '2000-01-01', startDateTo: '2000-01-01'}],
  ];
  if (invoiceId) probes.push(['Fatture', 'get_invoice', {id: Number(invoiceId)}]);
  const results = await Promise.all(probes.map(async ([area, operation, args]) => {
    try {
      await client.get(operation, args, {verifyOnly: true});
      return area + ': accesso verificato.';
    } catch (error) {
      return area + ': ' + (error instanceof IspAdminError ? error.message : 'Parametri di verifica non validi.');
    }
  }));
  if (!invoiceId) results.push('Fatture: verifica da eseguire con un ID fattura.');
  return results;
}

export async function startAdminServer({store, port, fetchImpl}) {
  const server = createServer(async (req, res) => {
    const host = '127.0.0.1:' + server.address().port;
    if (req.headers.host !== host || (req.method === 'POST' && req.headers.origin !== 'http://' + host)) {
      return page(res, {status: 403, messages: ['Richiesta non autorizzata.']});
    }
    if (req.url !== '/') return page(res, {status: 404});
    try {
      const saved = await store.load();
      const state = {baseUrl: saved?.baseUrl, configured: Boolean(saved)};
      if (req.method === 'GET') return page(res, state);
      if (req.method !== 'POST') return page(res, {...state, status: 405});
      if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
        return page(res, {...state, status: 415});
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 8192) return page(res, {...state, status: 413});
      }
      const form = new URLSearchParams(body);
      let settings;
      try {
        settings = validateSettings({baseUrl: form.get('baseUrl') ?? '', token: form.get('token')});
      } catch {
        return page(res, {...state, status: 400, messages: ['Inserisci un URL HTTPS e un token API validi.']});
      }
      if (form.get('action') === 'save') {
        await store.save(settings);
        res.writeHead(303, {Location: '/', 'Cache-Control': 'no-store'}).end();
        return;
      }
      if (form.get('action') !== 'verify') return page(res, {...state, status: 400});
      const messages = await verify(settings, form.get('invoiceId'), fetchImpl);
      return page(res, {...state, baseUrl: settings.baseUrl, messages});
    } catch {
      return page(res, {status: 500, messages: ['Errore nella gestione della configurazione.']});
    }
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server;
}
