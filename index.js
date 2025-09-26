require('dotenv').config()
const { Telegraf } = require('telegraf')
const { message } = require('telegraf/filters')
const Parser = require('rss-parser')
const storage = require('./storage.js')
const { trace, metrics } = require('@opentelemetry/api')

const checkInterval = process.env.RSS_WATHCER_CHECK_INTERVAL_MINUTES || 10
const bot = new Telegraf(process.env.BOT_TOKEN)
const parser = new Parser()

const tracer = trace.getTracer('rss-watcher-tracer')
const meter = metrics.getMeter('rss-watcher-meter')

const checkFeedsDuration = meter.createHistogram(
  'rss_watcher_check_feeds_duration',
  {
    description: 'Duration of checkFeeds function',
    unit: 'ms',
  }
)

const activeFeeds = meter.createObservableGauge('rss_watcher_active_feeds', {
  description: 'Number of active feeds',
  unit: '1',
})

const activeChats = meter.createObservableGauge('rss_watcher_active_chats', {
  description: 'Number of active chats',
  unit: '1',
})

activeFeeds.addCallback(async (result) => {
  const allFeedUrls = await storage.getAllSubscriptions()
  result.observe(allFeedUrls.length)
})

activeChats.addCallback(async (result) => {
  const allFeedUrls = await storage.getAllSubscriptions()
  const subscribers = new Set()
  for (const feedUrl of allFeedUrls) {
    const feedSubscribers = await storage.getSubscribers(feedUrl)
    feedSubscribers.forEach((subscriber) => subscribers.add(subscriber))
  }
  result.observe(subscribers.size)
})

const instrumentedCommand = (command, fn) => {
  return (ctx) => {
    const span = tracer.startSpan(`command: ${command}`, {
      attributes: {
        'chat.id': ctx.chat.id,
        'user.id': ctx.from.id,
        'user.username': ctx.from.username,
      },
    })
    span.addEvent('command received')
    fn(ctx)
    span.end()
  }
}

bot.start(
  instrumentedCommand('start', (ctx) => {
    ctx.reply(
      '¡Bienvenido al Bot Vigilante de RSS!\n\n' +
        'Usa /agregar <feed_url> para agregar un nuevo feed RSS.\n' +
        'Usa /listar para ver tus suscripciones actuales.\n' +
        'Usa /eliminar para darte de baja de un feed.'
    )
  })
)

const addFeedSubscription = async (ctx, feedUrl) => {
  const span = tracer.startSpan('addFeedSubscription', {
    attributes: {
      'chat.id': ctx.chat.id,
      'feed.url': feedUrl,
    },
  })
  try {
    const feed = await parser.parseURL(feedUrl)
    const chatId = ctx.chat.id

    const isSubscribed = await storage.isSubscribed(chatId, feedUrl)
    if (isSubscribed) {
      span.addEvent('already subscribed')
      return ctx.reply('Ya estás suscrito a este feed.')
    }

    const subscriptionId = await storage.addSubscription(
      chatId,
      feedUrl,
      feed.title
    )
    span.addEvent('subscription added')
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
  } catch (error) {
    span.recordException(error)
    ctx.reply(
      'No se pudo obtener o analizar el feed RSS. Por favor, comprueba la URL.'
    )
  } finally {
    span.end()
  }
}

bot.command(
  'agregar',
  instrumentedCommand('agregar', async (ctx) => {
    const feedUrl = ctx.message.text.split(' ')[1]
    if (!feedUrl) {
      return ctx.reply('Por favor, proporciona una URL de feed RSS.')
    }
    await addFeedSubscription(ctx, feedUrl)
  })
)

bot.command(
  'listar',
  instrumentedCommand('listar', async (ctx) => {
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
)

bot.command(
  'eliminar',
  instrumentedCommand('eliminar', (ctx) => {
    ctx.reply(
      'Por favor, usa el comando /listar para ver tus suscripciones y darte de baja.'
    )
  })
)

bot.action(
  /unsubscribe:(\d+)/,
  instrumentedCommand('unsubscribe', async (ctx) => {
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
)

bot.action(
  /show_last_5:(\d+)/,
  instrumentedCommand('show_last_5', async (ctx) => {
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
)

bot.action(
  /skip_last_5:(\d+)/,
  instrumentedCommand('skip_last_5', async (ctx) => {
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
)

bot.on(
  message('text'),
  instrumentedCommand('text', async (ctx) => {
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
)

const checkFeeds = async () => {
  const span = tracer.startSpan('checkFeeds')
  const startTime = Date.now()
  try {
    const allFeedUrls = await storage.getAllSubscriptions()
    span.setAttribute('feeds.count', allFeedUrls.length)
    console.log(`Checking ${allFeedUrls}`)

    for (const feedUrl of allFeedUrls) {
      const feedSpan = tracer.startSpan('checkFeed', {
        attributes: {
          'feed.url': feedUrl,
        },
      })
      try {
        const feed = await parser.parseURL(feedUrl)
        const sentItems = await storage.getSentItems(feedUrl)
        feedSpan.setAttribute('sent.items.count', sentItems.length)
        console.log(`Sent items ${sentItems}`)

        for (const item of feed.items) {
          if (!sentItems.includes(item.link)) {
            const message = `Nuevo contenido en el feed: ${feed.title}\n\n${item.title}\n${item.link}`

            const subscribers = await storage.getSubscribers(feedUrl)
            feedSpan.setAttribute('subscribers.count', subscribers.length)

            for (const chatId of subscribers) {
              console.log(`Sending ${message} to ${chatId}`)
              bot.telegram.sendMessage(chatId, message)
            }

            await storage.addSentItem(feedUrl, item.link)
          }
        }
      } catch (error) {
        feedSpan.recordException(error)
        console.error(`Failed to check feed ${feedUrl}:`, error)
      } finally {
        feedSpan.end()
      }
    }
  } catch (error) {
    span.recordException(error)
    console.error('Failed to get all subscriptions:', error)
  } finally {
    const endTime = Date.now()
    checkFeedsDuration.record(endTime - startTime)
    span.end()
  }
}

console.log(`Feeds are checked every ${checkInterval} minute(s)`)
setInterval(checkFeeds, checkInterval * 60 * 1000)

bot.launch()

console.log('Bot started')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))