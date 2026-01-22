# Internazionalizzazione (i18n)

Questo progetto utilizza **vue-i18n** per la gestione delle traduzioni in più lingue.

## Lingue supportate

- **Italiano (it)** - lingua principale
- **Inglese (en)** - lingua di fallback

## Configurazione

La lingua può essere configurata in tre modi:

1. **Rilevamento Automatico** (default): La lingua viene rilevata automaticamente dal sistema operativo
2. **Italiano**: Forza l'uso della lingua italiana
3. **Inglese**: Forza l'uso della lingua inglese

### Modifica della lingua

La lingua può essere modificata dall'utente tramite:
- **Impostazioni > Lingua** - Interfaccia grafica per la selezione
- La scelta viene salvata in `localStorage` ed è persistente tra le sessioni

### Struttura dei file

```
src/
  i18n/
    index.js          # Configurazione i18n con gestione localStorage
    locales/
      it.json         # Traduzioni italiane
      en.json         # Traduzioni inglesi
  stores/
    ui.js             # Store con gestione della lingua salvata
```

## Persistenza

La lingua selezionata viene salvata automaticamente in `localStorage` con la chiave `ui/language`.

Valori possibili:
- `"auto"` - Rilevamento automatico (default)
- `"it"` - Italiano
- `"en"` - Inglese

Quando l'utente riapre l'app, la lingua precedentemente selezionata viene ripristinata automaticamente.

## Come usare le traduzioni

### Nei template

```vue
<template>
  <h1>{{ t('app.name') }}</h1>
  <p>{{ t('common.loading') }}</p>
  
  <!-- Con parametri interpolati -->
  <p>{{ t('sidebar.channelsCount', { filtered: 10, total: 50 }) }}</p>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
```

### Aggiungere nuove traduzioni

1. Apri `src/i18n/locales/it.json` e aggiungi la nuova chiave
2. Apri `src/i18n/locales/en.json` e aggiungi la traduzione corrispondente
3. Usa `t('tua.nuova.chiave')` nel codice

Esempio:

```json
// it.json
{
  "settings": {
    "newFeature": "Nuova Funzionalità"
  }
}

// en.json
{
  "settings": {
    "newFeature": "New Feature"
  }
}
```

```vue
<template>
  <h2>{{ t('settings.newFeature') }}</h2>
</template>
```

## Cambiare lingua programmaticamente

```javascript
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()

// Imposta rilevamento automatico
uiStore.setLanguage('auto')

// Imposta italiano
uiStore.setLanguage('it')

// Imposta inglese
uiStore.setLanguage('en')
```

## Implementazione tecnica

### Flusso di inizializzazione

1. L'app si avvia e carica `src/i18n/index.js`
2. La funzione `getInitialLocale()` legge `localStorage` per vedere se c'è una lingua salvata
3. Se c'è una lingua salvata:
   - Se è `'auto'`, rileva la lingua del sistema
   - Se è `'it'` o `'en'`, usa quella lingua
4. Se non c'è una lingua salvata, usa il rilevamento automatico del sistema
5. L'i18n viene inizializzato con la lingua corretta

### Cambio lingua runtime

Quando l'utente cambia lingua dalle impostazioni:

1. Il valore viene salvato nello store UI (`selectedLanguage`)
2. Lo store salva automaticamente in `localStorage` (tramite `useLocalStorage`)
3. La `locale` di i18n viene aggiornata immediatamente
4. L'interfaccia si aggiorna in tempo reale con le nuove traduzioni
5. Al prossimo avvio, la lingua salvata viene ripristinata

## Note

- Tutte le stringhe hardcoded nell'applicazione sono state sostituite con chiavi i18n
- La selezione della lingua è persistente e sopravvive alla chiusura dell'app
- Il rilevamento automatico usa `navigator.language` del browser
- Il fallback è sempre inglese per garantire la compatibilità
