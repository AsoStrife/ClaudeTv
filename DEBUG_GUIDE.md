# Guida al Debug di ClaudeTV

## 🔧 Come Aprire i DevTools (Console Browser)

### Metodo 1: Click Destro (Raccomandato)
1. Avvia l'app: `npm run tauri:dev`
2. Nella finestra dell'app, **click destro** ovunque
3. Seleziona **"Inspect"** o **"Ispeziona elemento"**
4. Si aprirà il pannello DevTools con Console, Network, etc.

### Metodo 2: Scorciatoia da Tastiera
- **Windows/Linux**: `Ctrl + Shift + I` o `F12`
- **macOS**: `Cmd + Option + I`

### Metodo 3: Dal Menu (se disponibile)
- Menu → View → Developer → Developer Tools

## 📊 Cosa Guardare nella Console

Dopo aver aperto i DevTools, controlla questi log:

### Log del httpClient (nuovi log aggiunti)
```
[httpClient] Checking Tauri availability...
[httpClient] window.__TAURI_INTERNALS__: object
[httpClient] Tauri internals found, importing invoke...
[httpClient] invoke imported: function
[httpClient] httpFetch called with URL: http://...
[httpClient] Calling invoke with command: http_fetch
[httpClient] Response received, status: 200
```

### Se vedi errori
Cerca messaggi come:
- `invoke is not defined`
- `Tauri API not available`
- `HTTP request failed`

## 🐛 Checklist Debug

### 1. Verifica che l'app sia in modalità Tauri
✅ **Corretto**: `npm run tauri:dev` (apre finestra desktop)
❌ **Sbagliato**: `npm run dev` (apre solo browser)

### 2. Controlla la console Rust (terminale)
Nel terminale dove hai lanciato `npm run tauri:dev` dovresti vedere:
```
[INFO] ClaudeTV started successfully!
[INFO] Fetching URL: http://...
[INFO] Request completed with status: 200
```

### 3. Controlla la console JavaScript (DevTools)
Apri DevTools e guarda la tab **Console**

### 4. Verifica Network (DevTools)
- Tab **Network** nei DevTools
- Cerca richieste fallite (in rosso)

## 🔍 Test Manuale dell'API Tauri

Apri la Console nei DevTools e prova:

```javascript
// Test 1: Verifica che Tauri sia caricato
console.log(window.__TAURI_INTERNALS__);
// Dovrebbe mostrare: Object {...}

// Test 2: Importa e testa invoke
const { invoke } = await import('@tauri-apps/api/core');
console.log(typeof invoke);
// Dovrebbe mostrare: "function"

// Test 3: Chiama il comando http_fetch
const response = await invoke('http_fetch', {
    url: 'https://api.github.com',
    method: 'GET',
    headers: null,
    body: null
});
console.log(response);
// Dovrebbe mostrare: {body: "...", status: 200, headers: {...}}
```

## 🛠️ Soluzioni Comuni

### Errore: "invoke is not defined"
**Causa**: App non in modalità Tauri
**Soluzione**: Usa `npm run tauri:dev` invece di `npm run dev`

### Errore: "Tauri API not available"
**Causa**: Tauri non inizializzato
**Soluzione**: Aspetta che la finestra sia completamente caricata

### Errore: "Failed to load Tauri API"
**Causa**: Problemi con @tauri-apps/api
**Soluzione**: 
```bash
npm install @tauri-apps/api@latest
npm run tauri:dev
```

### DevTools non si aprono
**Soluzione**: Ho già aggiunto `"devtools": true` nella configurazione

## 📝 Log Utili

### Nel terminale (Rust)
```bash
[INFO] ClaudeTV started successfully!
[INFO] Fetching URL: ...
[INFO] Request completed with status: 200
```

### Nella console (JavaScript)
```javascript
[httpClient] Checking Tauri availability...
[httpClient] httpFetch called with URL: ...
[httpClient] Response received, status: 200
```

## 🚨 In Caso di Problemi

1. **Chiudi completamente l'app** (non solo la finestra)
2. **Ferma il processo** nel terminale (Ctrl+C)
3. **Pulisci e riavvia**:
   ```bash
   cd src-tauri
   cargo clean
   cd ..
   npm run tauri:dev
   ```

4. **Controlla che non ci siano altre istanze** dell'app in esecuzione:
   ```powershell
   Get-Process claudetv
   ```

---

**Con i nuovi log, potrai vedere esattamente dove si blocca la chiamata!**
