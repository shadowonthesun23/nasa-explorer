import { Telegraf, Markup } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("ERRORE FATALE: BOT_TOKEN mancante nelle variabili d'ambiente di Vercel.");
}

const bot = new Telegraf(BOT_TOKEN);

async function translateText(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=it&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(item => item[0]).join('');
  } catch (err) {
    console.error("Errore di traduzione:", err);
    return text;
  }
}

// Funzione helper per generare la tastiera di navigazione
function buildSearchKeyboard(query, currentIndex, totalItems, imageUrl) {
  // Telegram limita il callback_data a 64 byte. Tronchiamo la query per sicurezza.
  const safeQuery = query.substring(0, 35);
  const buttons = [];

  buttons.push([Markup.button.url('Scarica Originale (HD)', imageUrl)]);

  const navButtons = [];
  if (currentIndex > 0) {
    navButtons.push(Markup.button.callback('⬅️ Prec', `nav_${currentIndex - 1}_${safeQuery}`));
  } else {
    navButtons.push(Markup.button.callback('⛔️', 'noop'));
  }

  navButtons.push(Markup.button.callback(`${currentIndex + 1} / ${totalItems}`, 'noop'));

  if (currentIndex < totalItems - 1) {
    navButtons.push(Markup.button.callback('Succ ➡️', `nav_${currentIndex + 1}_${safeQuery}`));
  } else {
    navButtons.push(Markup.button.callback('⛔️', 'noop'));
  }

  buttons.push(navButtons);
  return Markup.inlineKeyboard(buttons);
}

// Funzione helper per estrarre e formattare un singolo risultato NASA
function formatItemData(item) {
  const itemData = item.data[0];
  const imageUrl = item.links[0].href;

  let description = itemData.description || 'Nessuna descrizione fornita dalla NASA.';
  description = description.length > 600 ? description.substring(0, 600) + '...' : description;

  const dateCreated = new Date(itemData.date_created).toLocaleDateString('it-IT');
  const caption = `*${itemData.title}*\n📅 ${dateCreated}\n\n${description}`;

  return { imageUrl, caption };
}

bot.start(async (ctx) => {
  const logoUrl = 'https://nasa-explorer-space.vercel.app/logo.png';
  const welcomeMessage = 'Benvenuto nel NASA Explorer Bot! 🚀\n\n' +
    'Comandi disponibili:\n' +
    '🌌 /apod - Mostra la Foto Astronomica del Giorno\n' +
    '🔍 /cerca <termine> - Cerca una foto (es. /cerca Apollo 11)';

  try {
    await ctx.replyWithPhoto(logoUrl, { caption: welcomeMessage });
  } catch (err) {
    console.error("Errore invio logo:", err);
    await ctx.reply(welcomeMessage);
  }
});

bot.command('apod', async (ctx) => {
  let loadingMsg;
  try {
    loadingMsg = await ctx.reply('Recupero la foto del giorno in corso... 🛰️');

    const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
    if (!res.ok) throw new Error('Errore API NASA APOD');
    const data = await res.json();

    const safeExplanation = data.explanation.length > 800 ? data.explanation.substring(0, 800) + '...' : data.explanation;
    const caption = `*${data.title}*\n📅 ${data.date}\n\n${safeExplanation}`;

    const keyboard = Markup.inlineKeyboard([Markup.button.callback('🇮🇹 Traduci in Italiano', 'translate_apod')]);

    if (data.media_type === 'video') {
      await ctx.reply(`${caption}\n\n[Guarda il video qui](${data.url})`, { parse_mode: 'Markdown', ...keyboard });
    } else {
      await ctx.replyWithPhoto(data.url, { caption: caption, parse_mode: 'Markdown', ...keyboard });
    }
  } catch (err) {
    console.error(err);
    ctx.reply('Impossibile recuperare la foto del giorno.');
  } finally {
    if (loadingMsg) ctx.deleteMessage(loadingMsg.message_id).catch(() => { });
  }
});

bot.action('translate_apod', async (ctx) => {
  try {
    await ctx.answerCbQuery('Traduzione in corso...');
    const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
    const data = await res.json();

    const translatedTitle = await translateText(data.title);
    const translatedExp = await translateText(data.explanation);

    const safeExplanation = translatedExp.length > 800 ? translatedExp.substring(0, 800) + '...' : translatedExp;
    const caption = `*${translatedTitle}*\n📅 ${data.date}\n\n${safeExplanation}`;

    await ctx.editMessageCaption(caption, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error(err);
    ctx.answerCbQuery('Errore server di traduzione.');
  }
});

bot.command('cerca', async (ctx) => {
  const query = ctx.message.text.replace('/cerca', '').trim();
  if (!query) return ctx.reply('Specificare un termine.\n\nUso: `/cerca Artemis`', { parse_mode: 'Markdown' });

  let loadingMsg;
  try {
    loadingMsg = await ctx.reply(`Ricerca per "${query}"... 🔭`);

    const url = new URL('https://images-api.nasa.gov/search');
    url.searchParams.append('q', query);
    url.searchParams.append('media_type', 'image');

    const res = await fetch(url);
    if (!res.ok) throw new Error('Errore API NASA Search');

    const data = await res.json();
    const items = data.collection.items;

    if (items.length === 0) return ctx.reply(`Nessun risultato trovato per "${query}".`);

    const currentIndex = 0;
    const { imageUrl, caption } = formatItemData(items[currentIndex]);
    const keyboard = buildSearchKeyboard(query, currentIndex, items.length, imageUrl);

    await ctx.replyWithPhoto(imageUrl, { caption: caption, parse_mode: 'Markdown', ...keyboard });
  } catch (err) {
    console.error(err);
    ctx.reply('Errore server NASA.');
  } finally {
    if (loadingMsg) ctx.deleteMessage(loadingMsg.message_id).catch(() => { });
  }
});

// Gestione dei click sulla paginazione
bot.action(/^nav_(\d+)_(.+)$/, async (ctx) => {
  try {
    const currentIndex = parseInt(ctx.match[1], 10);
    const query = ctx.match[2];

    await ctx.answerCbQuery('Caricamento...');

    const url = new URL('https://images-api.nasa.gov/search');
    url.searchParams.append('q', query);
    url.searchParams.append('media_type', 'image');

    const res = await fetch(url);
    if (!res.ok) throw new Error('Errore API NASA Search Pagination');

    const data = await res.json();
    const items = data.collection.items;

    if (items.length === 0 || currentIndex >= items.length) {
      return ctx.answerCbQuery('Nessun altro risultato disponibile.', { show_alert: true });
    }

    const { imageUrl, caption } = formatItemData(items[currentIndex]);
    const keyboard = buildSearchKeyboard(query, currentIndex, items.length, imageUrl);

    // Aggiorna l'immagine e il testo del messaggio esistente
    await ctx.editMessageMedia({
      type: 'photo',
      media: imageUrl,
      caption: caption,
      parse_mode: 'Markdown'
    }, {
      reply_markup: keyboard.reply_markup
    });

  } catch (err) {
    console.error(err);
    ctx.answerCbQuery('Errore durante il caricamento del risultato.', { show_alert: true });
  }
});

// Azione vuota per i pulsanti disabilitati (simbolo ⛔️ o contatore pagina)
bot.action('noop', (ctx) => ctx.answerCbQuery());

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('Errore Webhook:', err);
    res.status(500).send('Internal Server Error');
  }
}