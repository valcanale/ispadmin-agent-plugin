# Plugin ChatGPT per ISPAdmin

La prima versione permette di consultare ISPAdmin da ChatGPT. Il codice sarà distribuito come software open source nel repository `valcanale/ispadmin-agent-plugin`.

## Distribuzione

Un server MCP self-hosted per installazione ISPAdmin. Questa modalità lascia all'operatore il controllo della rete e delle credenziali. Un servizio condiviso richiederebbe invece gestione multiutente e isolamento delle configurazioni. La prima versione usa un plugin personalizzato di ChatGPT con Streamable HTTP e autenticazione OAuth tramite un provider compatibile. L'operatore abilita l'accesso ai soli utenti autorizzati a consultare l'istanza associata. Gli utenti ChatGPT autorizzati usano lo stesso token ISPAdmin configurato dall'operatore per l'installazione. Il servizio usa HTTPS o un Secure MCP Tunnel per il collegamento privato.

## Configurazione

L'operatore apre una pagina di configurazione accessibile localmente sul server o via accesso amministrativo protetto. La pagina ha due campi, URL base e token, e i comandi Verifica connessione e Salva. Accetta URL HTTPS della radice dell'istanza o della radice API v1, normalizzati alla base API. Il campo del token è mascherato. Dopo il salvataggio l'interfaccia mostra lo stato della configurazione e lascia vuoto il campo del token.

Il backend custodisce il token con permessi riservati al processo e lo trasmette nell'header `Token` alla sola istanza configurata. Rifiuta i redirect e usa timeout e limiti alla dimensione delle risposte. Il token resta fuori da Git, log, argomenti MCP e risultati. Gli utenti autorizzati alle consultazioni MCP non acquisiscono accesso alla pagina amministrativa.

## Strumenti di sola lettura

| Area | Operazioni |
| --- | --- |
| Clienti | Elenco e dettaglio per ID tramite `GET /clients` e `GET /clients/{id}` |
| Servizi | Servizi del cliente e consultazione dei servizi Internet tramite `GET /clients/{id}/services`, `GET /internet` e `GET /internet/{internetId}` |
| Fatture | Dettaglio per ID tramite `GET /invoices/{id}`. La documentazione consultata espone il dettaglio, senza un endpoint di elenco. Il PDF resta fuori dalla prima versione |
| Pianificazione | Elenco e dettaglio dei task tramite `GET /tasks` e `GET /tasks/{id}` |

La creazione e l'assegnazione di task sono un'estensione futura. Ogni strumento usa endpoint espliciti e argomenti validati. Filtri e paginazione seguono i parametri documentati per ciascun endpoint. La verifica della connessione usa una richiesta di lettura e distingue credenziali rifiutate, permessi insufficienti e problemi di rete. Per un token abilitato esclusivamente alle fatture, la verifica può usare un ID fattura di esempio richiesto durante il test. In assenza dell'ID, la GUI segnala che la verifica delle fatture resta da eseguire.

## Criteri di accettazione

- Configurazione da browser con URL e token, verifica della connessione e riavvio con configurazione conservata.
- Chiamate MCP autenticate e in sola lettura, con verifica degli argomenti e risultati limitati.
- Test con un'API ISPAdmin simulata per richieste, autenticazione, errori, paginazione e tutela del token.
- README con istruzioni di installazione e collegamento a ChatGPT, configurazione dei permessi, verifica e limiti della prima versione. Licenza open source da includere prima del rilascio.

## Riferimenti

- [Documentazione ISPAdmin](https://api.ispadmin.eu/)
- [Documentazione ISPAdmin in inglese su Apiary](https://ispadminapien.docs.apiary.io/)
- [Plugin MCP personalizzati in ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Autenticazione dei plugin](https://developers.openai.com/plugins/build/auth)
