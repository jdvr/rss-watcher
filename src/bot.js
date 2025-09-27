const { Telegraf } = require('telegraf')
const { message } = require('telegraf/filters')
const { instrumentedCommand } = require('./instrumentation')
const createSubscriptionService = require('./subscription-service')
const createListService = require('./commands/list-service')
const Parser = require('rss-parser')
const he = require('he')

const WELCOME_MESSAGE =
  '¡Bienvenido al Bot Vigilante de RSS!\n\n' +
  'Usa /agregar <feed_url> para agregar un nuevo feed RSS.\n' +
  'Usa /listar para ver tus suscripciones actuales.\n' +
  'Usa /eliminar para darte de baja de un feed.'

const createBot = (storage) => {
  const parser = new Parser()
  const bot = new Telegraf(process.env.BOT_TOKEN)
  const subscriptionService = createSubscriptionService(storage, parser)
  const listService = createListService(storage)

  bot.start(instrumentedCommand('start', (ctx) => {
    ctx.reply(WELCOME_MESSAGE)
  }))

  bot.command(
    'agregar',
    instrumentedCommand('agregar', async (ctx) => {
      const feedUrl = ctx.message.text.split(' ')[1]
      if (!feedUrl) {
        return ctx.reply('Por favor, proporciona una URL de feed RSS.')
      }
      await subscriptionService.addFeedSubscription(ctx, feedUrl)
    })
  )

  bot.command('listar', listService.listSubscriptions)

  bot.command(
    'eliminar',
    instrumentedCommand('eliminar', (ctx) => {
      ctx.reply(
        'Por favor, usa el comando /listar para ver tus suscripciones y darte de baja.'
      )
    })
  )

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
      ctx.reply(`${he.decode(item.title)}\n${item.link}`)
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

    ctx.answerCbQuery(
      'Se han registrado todas las publicaciones como enviadas.'
    )
  })

  bot.on(
    message('text'),
    instrumentedCommand('text', async (ctx) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g
      const urls = ctx.message.text.match(urlRegex)

      if (urls && urls.length > 0) {
        const feedUrl = urls[0]
        await subscriptionService.addFeedSubscription(ctx, feedUrl)
      } else {
        ctx.reply(WELCOME_MESSAGE)
      }
    })
  )

  return bot
}

module.exports = createBot
