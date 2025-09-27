const Parser = require('rss-parser')
const { tracer } = require('./instrumentation')

const createSubscriptionService = (storage) => {
  const parser = new Parser()

  const addFeedSubscription = async (ctx, feedUrl) => {
    await tracer.startActiveSpan(
      'addFeedSubscription',
      {
        attributes: {
          'chat.id': ctx.chat.id,
          'feed.url': feedUrl,
        },
      },
      async (span) => {
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
          const newItems = feed.items.filter(
            (item) => !sentItems.includes(item.link)
          )

          if (newItems.length > 0) {
            ctx.reply('¿Quieres ver las últimas 5 publicaciones?', {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Sí',
                      callback_data: `show_last_5:${subscriptionId}`,
                    },
                    {
                      text: 'No',
                      callback_data: `skip_last_5:${subscriptionId}`,
                    },
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
    )
  }

  return { addFeedSubscription }
}

module.exports = createSubscriptionService
