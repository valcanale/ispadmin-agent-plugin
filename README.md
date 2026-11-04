# ISPAdmin Agent Plugin

Integrazione open source self-hosted per consultare ISPAdmin da ChatGPT e Codex.

| Area | Operazioni |
| --- | --- |
| Clienti | Elenco con filtri e dettaglio per ID |
| Servizi | Elenco dei servizi di un cliente, elenco e dettaglio dei servizi Internet |
| Fatture | Dettaglio per ID |
| Pianificazione | Elenco con filtri e dettaglio dei task |

Tutte le operazioni sono in sola lettura. La creazione e l'assegnazione dei task sono previste per una versione successiva.

## Aggiungere il marketplace in Codex

### Dall'app desktop

1. Apri **Plugins** in Codex. Nelle versioni che raggruppano la gestione dei plugin, apri **Settings → Plugins**.
2. Se la tua versione mostra **Add marketplace**, aprilo e indica il repository `https://github.com/valcanale/ispadmin-agent-plugin`. Imposta `main` se la finestra offre un campo per il riferimento Git.
3. Seleziona il marketplace **ISPAdmin**, apri il plugin **ISPAdmin** e premi **Install**. Avvia una nuova chat per usare la procedura di configurazione.
4. Se **Add marketplace** non compare, puoi aprire come progetto la cartella del repository clonato e riavviare l'app per visualizzarne il marketplace, oppure usare i comandi qui sotto.

Gli amministratori possono aggiungere il catalogo dalla GUI del workspace in **Admin → Plugins → Add → Import marketplace**. Inserisci lo stesso URL in **Source**, lascia **Path** vuoto, seleziona `main` come riferimento e autorizza GitHub quando richiesto. Il catalogo distribuisce la guida di configurazione. L'accesso ai dati richiede il collegamento MCP della propria installazione. [Importare un marketplace in un workspace](https://learn.chatgpt.com/docs/enterprise/plugin-management)

### Dal terminale

```bash
codex plugin marketplace add valcanale/ispadmin-agent-plugin --ref main
codex plugin marketplace list
codex plugin add ispadmin@ispadmin-marketplace
```

Puoi installare **ISPAdmin** anche dal catalogo dell'app dopo aver aggiunto il marketplace. Per aggiornare il catalogo, usa `codex plugin marketplace upgrade ispadmin-marketplace`. [Documentazione OpenAI sui marketplace](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)

## Avviare il server

Servono Node.js 22 o successivo, accesso di rete all'API ISPAdmin e un provider OAuth compatibile con MCP. Un'installazione serve una sola istanza ISPAdmin. Gli utenti ammessi condividono i permessi del token configurato dall'operatore.

```bash
git clone https://github.com/valcanale/ispadmin-agent-plugin.git
cd ispadmin-agent-plugin
npm ci
```

Configura nel provider OAuth la risorsa MCP, lo scope `ispadmin:read` e i client che useranno il server. Il provider deve supportare authorization code con PKCE e pubblicare i metadati di discovery. Usa CIMD, DCR o un client preregistrato secondo le opzioni della piattaforma. Se usi un client preregistrato, registra il callback mostrato nella configurazione di ChatGPT o Codex. L'access token deve essere un JWT con firma RS256 o ES256, `iss` del provider, `aud` pari all'URL MCP, `sub` dell'utente, `exp` e claim stringa `scope` contenente `ispadmin:read`. [Autenticazione dei plugin MCP](https://developers.openai.com/plugins/build/auth)

```bash
export ISPADMIN_MCP_URL=https://mcp.example.net/mcp
export ISPADMIN_OAUTH_ISSUER=https://auth.example.net
export ISPADMIN_OAUTH_JWKS_URL=https://auth.example.net/.well-known/jwks.json
export ISPADMIN_OAUTH_SUBJECTS='subject-operatore,subject-collega'
npm start
```

Entrambi i listener si avviano su `127.0.0.1`. Configura un proxy HTTPS per inoltrare `/mcp` e `/.well-known/oauth-protected-resource` (inclusa la variante `/mcp` sotto quel percorso) alla porta MCP, `8766` per impostazione predefinita. Il proxy deve inoltrare l'header `Authorization`. Per ChatGPT puoi anche usare un Secure MCP Tunnel privato, se il workspace lo supporta, configurando come risorsa l'URL MCP usato dal client OAuth. Tieni la porta della maschera amministrativa separata dal proxy e dal tunnel. [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

## Configurare ISPAdmin dal browser

1. Apri `http://127.0.0.1:8765/` sul computer del server. Per un server remoto puoi inoltrare la porta sul tuo computer con `ssh -N -L 8765:127.0.0.1:8765 utente@server`.
2. Inserisci l'URL HTTPS dell'istanza o della relativa API v1 e un token ISPAdmin con i permessi di lettura desiderati.
3. Seleziona **Verifica connessione**. Per verificare anche le fatture, inserisci un ID fattura esistente.
4. Reinserisci il token nel campo mascherato e seleziona **Salva**.

Il server salva la configurazione con permessi file `0600` in `~/.config/ispadmin-agent-plugin/settings.json`. Puoi cambiare percorso con `ISPADMIN_SETTINGS_FILE` e porte con `ISPADMIN_ADMIN_PORT` e `ISPADMIN_MCP_PORT`. Il token serve solo al server per l'header `Token` di ISPAdmin. I dati restituiti dagli strumenti vengono inviati al client che effettua la chiamata. [API ISPAdmin](https://api.ispadmin.eu/)

## Collegare il server a Codex o a ChatGPT

**Codex.** Dopo aver installato il plugin, registra l'endpoint HTTPS del tuo server MCP. Sostituisci l'URL di esempio con quello di `ISPADMIN_MCP_URL`.

```bash
codex mcp add ispadmin --url https://mcp.example.net/mcp
```

Completa l'accesso OAuth quando richiesto. Se devi avviarlo separatamente, usa `codex mcp login ispadmin --scopes ispadmin:read`. Apri una nuova chat.

**ChatGPT sul web.** Apri **Plugins → + → Add custom MCP server**. Inserisci il tuo URL MCP o seleziona il Secure MCP Tunnel, scegli **OAuth**, completa la creazione e installa il plugin nel workspace. [Aggiungere un server MCP personalizzato](https://developers.openai.com/api/docs/guides/custom-mcp-server)

## Esempi

- «Trova il cliente Rossi in ISPAdmin.»
- «Mostrami i servizi del cliente con ID 123.»
- «Recupera i dati della fattura con ID 456.»
- «Quali task aperti sono assegnati al tecnico con ID 7?»

Le API di elenco non documentano parametri di paginazione. Il server limita ogni risposta a 256 KiB. Se superi il limite, usa filtri o un'operazione di dettaglio quando disponibili. [Schema OpenAPI ISPAdmin in inglese](https://api.ispadmin.eu/openapi/ispadmin.en.json)

## Sviluppo

`npm ci` installa le dipendenze. `npm test` esegue i test con un'API ISPAdmin simulata e listener temporanei su loopback.

Licenza MIT.
