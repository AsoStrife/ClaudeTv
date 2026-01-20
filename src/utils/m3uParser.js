/**
 * Parser per file M3U/M3U8 playlist
 * Supporta il formato EXTINF con attributi estesi
 */

/**
 * Estrae gli attributi da una linea EXTINF
 * @param {string} line - Linea EXTINF (es: #EXTINF:-1 tvg-id="..." group-title="...",Nome Canale)
 * @returns {Object} Oggetto con gli attributi estratti
 */
function parseExtinfAttributes(line) {
  const attributes = {};

  // Pattern per estrarre attributi key="value"
  const attrRegex = /([a-zA-Z\-_]+)="([^"]*)"/g;
  let match;

  while ((match = attrRegex.exec(line)) !== null) {
    const key = match[1].toLowerCase().replace(/-/g, "_");
    attributes[key] = match[2];
  }

  // Estrai il nome del canale (dopo l'ultima virgola)
  const nameMatch = line.match(/,(.+)$/);
  if (nameMatch) {
    attributes.name = nameMatch[1].trim();
  }

  // Estrai la durata (primo numero dopo #EXTINF:)
  const durationMatch = line.match(/#EXTINF:\s*(-?\d+)/);
  if (durationMatch) {
    attributes.duration = parseInt(durationMatch[1], 10);
  }

  return attributes;
}

/**
 * Parsa una playlist M3U e restituisce un array di canali
 * @param {string} content - Contenuto del file M3U
 * @returns {Object} Oggetto con channels e categories
 */
export function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const channels = [];
  const categoriesSet = new Set();

  let currentChannel = null;
  let channelId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Salta linee vuote
    if (!line) continue;

    // Header M3U (opzionale)
    if (line.startsWith("#EXTM3U")) {
      continue;
    }

    // Linea EXTINF - contiene info sul canale
    if (line.startsWith("#EXTINF:")) {
      const attrs = parseExtinfAttributes(line);
      currentChannel = {
        id: ++channelId,
        name: attrs.name || `Canale ${channelId}`,
        group: attrs.group_title || "Senza categoria",
        logo: attrs.tvg_logo || attrs.logo || null,
        tvgId: attrs.tvg_id || null,
        tvgName: attrs.tvg_name || null,
        url: null,
      };
      categoriesSet.add(currentChannel.group);
      continue;
    }

    // Altre direttive # (skip)
    if (line.startsWith("#")) {
      continue;
    }

    // URL del canale
    if (
      currentChannel &&
      (line.startsWith("http://") || line.startsWith("https://"))
    ) {
      currentChannel.url = line;
      channels.push(currentChannel);
      currentChannel = null;
    }
  }

  // Ordina le categorie alfabeticamente, ma "Senza categoria" alla fine
  const categories = Array.from(categoriesSet).sort((a, b) => {
    if (a === "Senza categoria") return 1;
    if (b === "Senza categoria") return -1;
    return a.localeCompare(b);
  });

  return {
    channels,
    categories,
  };
}

/**
 * Raggruppa i canali per categoria
 * @param {Array} channels - Array di canali
 * @returns {Object} Oggetto con categorie come chiavi e array di canali come valori
 */
export function groupChannelsByCategory(channels) {
  return channels.reduce((acc, channel) => {
    const group = channel.group || "Senza categoria";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(channel);
    return acc;
  }, {});
}

/**
 * Filtra i canali per nome
 * @param {Array} channels - Array di canali
 * @param {string} query - Stringa di ricerca
 * @returns {Array} Array di canali filtrati
 */
export function filterChannels(channels, query) {
  if (!query || !query.trim()) {
    return channels;
  }

  const lowerQuery = query.toLowerCase().trim();
  return channels.filter((channel) =>
    channel.name.toLowerCase().includes(lowerQuery),
  );
}
