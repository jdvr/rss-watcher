require('dotenv').config()
const { Telegraf } = require('telegraf')
const { message } = require('telegraf/filters')
const Parser = require('rss-parser')
const storage = require('./storage.js')

const checkInterval = process.env.RSS_WATHCER_CHECK_INTERVAL_MINUTES || 10
const bot = new Telegraf(process.env.BOT_TOKEN)
const parser = new Parser()

bot.start((ctx) => {
  ctx.reply(
    '¡Bienvenido al Bot Vigilante de RSS!\n\n' +
      'Usa /agregar <feed_url> para agregar un nuevo feed RSS.\n' +
      'Usa /listar para ver tus suscripciones actuales.\n' +
      'Usa /eliminar para darte de baja de un feed.'
  )
})

const addFeedSubscription = async (ctx, feedUrl) => {
  try {
    const feed = await parser.parseURL(feedUrl)
    const chatId = ctx.chat.id

    const isSubscribed = await storage.isSubscribed(chatId, feedUrl)
    if (isSubscribed) {
      return ctx.reply('Ya estás suscrito a este feed.')
    }

    const subscriptionId = await storage.addSubscription(
      chatId,
      feedUrl,
      feed.title
    )
    ctx.reply(`Suscrito exitosamente a ${feed.title}`)

    const sentItems = await storage.getSentItems(feedUrl)
    const newItems = feed.items.filter((item) => !sentItems.includes(item.link))

    if (newItems.length > 0) {
      ctx.reply('¿Quieres ver las últimas 5 publicaciones?', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Sí', callback_data: `show_last_5:${subscriptionId}` },
              { text: 'No', callback_data: `skip_last_5:${subscriptionId}` },
            ],
          ],
        },
      })
    } else {
      for (const item of newItems) {
        await storage.addSentItem(feedUrl, item.link)
      }
    }
  } catch {
    ctx.reply(
      'No se pudo obtener o analizar el feed RSS. Por favor, comprueba la URL.'
    )
  }
}

bot.command('agregar', async (ctx) => {
  const feedUrl = ctx.message.text.split(' ')[1]
  if (!feedUrl) {
    return ctx.reply('Por favor, proporciona una URL de feed RSS.')
  }
  await addFeedSubscription(ctx, feedUrl)
})

bot.command('listar', async (ctx) => {
  const chatId = ctx.chat.id

  try {
    const userSubscriptions = await storage.getSubscriptions(chatId)

    if (userSubscriptions.length === 0) {
      return ctx.reply('No estás suscrito a ningún feed.')
    }

    ctx.reply('Tus suscripciones:')
    for (const sub of userSubscriptions) {
      ctx.reply(sub.feed_title, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Borrar', callback_data: `unsubscribe:${sub.id}` }],
          ],
        },
      })
    }
  } catch (error) {
    console.error(error)
    ctx.reply('Ocurrió un error al obtener tus suscripciones.')
  }
})

bot.command('eliminar', (ctx) => {
  ctx.reply(
    'Por favor, usa el comando /listar para ver tus suscripciones y darte de baja.'
  )
})

bot.action(/unsubscribe:(\d+)/, async (ctx) => {
  const subId = parseInt(ctx.match[1], 10)

  try {
    const sub = await storage.getSubscriptionById(subId)
    if (sub) {
      await storage.removeSubscription(subId)
      ctx.editMessageText(`Suscripción a "${sub.feed_title}" eliminada.`)
    } else {
      ctx.answerCbQuery('La suscripción ya ha sido eliminada.')
      ctx.editMessageReplyMarkup({ inline_keyboard: [] })
    }
  } catch (error) {
    console.error(error)
    ctx.answerCbQuery('Ocurrió un error al darte de baja.')
  }
})

bot.action(/show_last_5:(\d+)/, async (ctx) => {
  const subId = parseInt(ctx.match[1], 10)
  const sub = await storage.getSubscriptionById(subId)
  if (!sub) {
    return ctx.answerCbQuery('Suscripción no encontrada.')
  }
  const feed = await parser.parseURL(sub.feed_url)
  const sentItems = await storage.getSentItems(sub.feed_url)
  const newItems = feed.items.filter((item) => !sentItems.includes(item.link))

  for (const item of newItems.slice(0, 5)) {
    ctx.reply(`${item.title}\n${item.link}`)
  }

  for (const item of newItems) {
    await storage.addSentItem(sub.feed_url, item.link)
  }

  ctx.answerCbQuery('Aquí tienes las últimas 5 publicaciones.')
})

bot.action(/skip_last_5:(\d+)/, async (ctx) => {
  const subId = parseInt(ctx.match[1], 10)
  const sub = await storage.getSubscriptionById(subId)
  if (!sub) {
    return ctx.answerCbQuery('Suscripción no encontrada.')
  }
  const feed = await parser.parseURL(sub.feed_url)
  const sentItems = await storage.getSentItems(sub.feed_url)
  const newItems = feed.items.filter((item) => !sentItems.includes(item.link))

  for (const item of newItems) {
    await storage.addSentItem(sub.feed_url, item.link)
  }

  ctx.answerCbQuery('Se han registrado todas las publicaciones como enviadas.')
})

bot.on(message('text'), async (ctx) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls = ctx.message.text.match(urlRegex)

  if (urls && urls.length > 0) {
    const feedUrl = urls[0]
    await addFeedSubscription(ctx, feedUrl)
  } else {
    ctx.reply(
      '¡Bienvenido al Bot Vigilante de RSS!\n\n' +
        'Usa /agregar <feed_url> para agregar un nuevo feed RSS.\n' +
        'Usa /listar para ver tus suscripciones actuales.\n' +
        'Usa /eliminar para darte de baja de un feed.'
    )
  }
})

const checkFeeds = async () => {
  try {
    const allFeedUrls = await storage.getAllSubscriptions()
    console.log(`Checking ${allFeedUrls}`)

    for (const feedUrl of allFeedUrls) {
      try {
        const feed = await parser.parseURL(feedUrl)
        const sentItems = await storage.getSentItems(feedUrl)
        console.log(`Sent items ${sentItems}`)

        for (const item of feed.items) {
          if (!sentItems.includes(item.link)) {
            const message = `Nuevo contenido en el feed: ${feed.title}\n\n${item.title}\n${item.link}`

            const subscribers = await storage.getSubscribers(feedUrl)

            for (const chatId of subscribers) {
              console.log(`Sending ${message} to ${chatId}`)
              bot.telegram.sendMessage(chatId, message)
            }

            await storage.addSentItem(feedUrl, item.link)
          }
        }
      } catch (error) {
        console.error(`Failed to check feed ${feedUrl}:`, error)
      }
    }
  } catch (error) {
    console.error('Failed to get all subscriptions:', error)
  }
}

console.log(`Feeds are checked every ${checkInterval} minute(s)`)
setInterval(checkFeeds, checkInterval * 60 * 1000)

bot.launch()

console.log('Bot started')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
