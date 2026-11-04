import {z} from 'zod';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const filter = z.string().trim().min(1).max(250).optional();
const flag = z.enum(['0', '1']).optional();
const timestamp = z.string().regex(/^\d{1,16}$/).optional();
const date = z.iso.date().optional();

export const operations = {
  list_clients: {
    path: () => 'clients', description: 'List ISPAdmin clients using optional filters. Timestamps are Unix seconds.',
    input: z.strictObject({
      name: filter, taxId: filter, phone: filter, lastUpdate: timestamp, createdFrom: timestamp,
      createdTo: timestamp, clientNumber: filter, email: filter, active: flag,
    }),
  },
  get_client: {path: ({id}) => `clients/${id}`, description: 'Get a client by ID.', input: z.strictObject({id})},
  list_client_services: {
    path: ({id}) => `clients/${id}/services`, description: 'List the services of a client by client ID.',
    input: z.strictObject({id}),
  },
  list_internet_services: {
    path: () => 'internet', description: 'List internet services for active clients.', input: z.strictObject({}),
  },
  get_internet_service: {
    path: ({id}) => `internet/${id}`, description: 'Get an internet service by ID.', input: z.strictObject({id}),
  },
  get_invoice: {
    path: ({id}) => `invoices/${id}`, description: 'Get an invoice by its ISPAdmin ID.', input: z.strictObject({id}),
  },
  list_tasks: {
    path: () => 'tasks', description: 'List scheduling tasks. complete is 0 for open or 1 for solved.',
    input: z.strictObject({complete: flag, technician: z.string().regex(/^\d{1,16}$/).optional(), startDateFrom: date, startDateTo: date}),
  },
  get_task: {
    path: ({id}) => `tasks/${id}`, description: 'Get a scheduling task by ID.',
    input: z.strictObject({id: z.union([id, z.string().regex(/^\d{1,32}$/)])}),
  },
};

export function normalizeBaseUrl(value) {
  const raw = value.trim();
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || /[?#\\]/.test(raw) ||
      !['', '/', '/api/v1', '/api/v1/'].includes(url.pathname)) {
    throw new Error('Inserisci un URL HTTPS dell’istanza o della sua API v1.');
  }
  return `${url.origin}/api/v1/`;
}

export function validateSettings({baseUrl, token}) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]{1,1024}$/.test(token)) {
    throw new Error('Inserisci un token API valido.');
  }
  return {baseUrl: normalizeBaseUrl(baseUrl), token};
}

export class IspAdminError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const errorMessages = {
  401: 'Token ISPAdmin rifiutato.',
  403: 'Permessi ISPAdmin insufficienti.',
  404: 'Risorsa ISPAdmin non trovata.',
};

async function readJson(response) {
  if (!response.body) throw new IspAdminError('Risposta ISPAdmin vuota.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 256 * 1024) {
      await reader.cancel();
      throw new IspAdminError('Risposta ISPAdmin troppo grande. Usa filtri o un ID quando disponibili.');
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new IspAdminError('ISPAdmin ha restituito una risposta non JSON.');
  }
}

function redact(value, token) {
  if (typeof value === 'string') return value.replaceAll(token, '[redacted]');
  if (Array.isArray(value)) return value.map(item => redact(item, token));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key.replaceAll(token, '[redacted]'), redact(item, token)]));
  }
  return value;
}

export function createIspAdminClient(settings, fetchImpl = fetch) {
  const {baseUrl, token} = validateSettings(settings);
  return {
    async get(name, args = {}, {verifyOnly = false} = {}) {
      if (!Object.hasOwn(operations, name)) throw new Error('Operazione sconosciuta.');
      const operation = operations[name];
      const {id, ...filters} = operation.input.parse(args);
      const url = new URL(operation.path({id}), baseUrl);
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
      try {
        const response = await fetchImpl(url, {
          method: 'GET', headers: {Token: token, Accept: 'application/json'},
          redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new IspAdminError(errorMessages[response.status] ?? `Errore ISPAdmin HTTP ${response.status}.`, response.status);
        }
        if (verifyOnly) {
          const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
          await response.body?.cancel();
          if (type !== 'application/json') throw new IspAdminError('ISPAdmin ha restituito una risposta non JSON.');
          return;
        }
        return redact(await readJson(response), token);
      } catch (error) {
        if (error instanceof IspAdminError) throw error;
        throw new IspAdminError('Connessione a ISPAdmin non riuscita.');
      }
    },
  };
}
