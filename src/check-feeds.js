const { tracer, checkFeedDuration } = require('./instrumentation')
const he = require('he')

const createFeedService = (storage, bot, parser) => {
  const checkFeeds = async () => {
    await tracer.startActiveSpan('checkFeeds', async (span) => {
      try {
        const allSubscriptions = await storage.getAllSubscriptionsWithChats()
        span.setAttribute('subscriptions.count', allSubscriptions.length)
        console.log(`Checking ${allSubscriptions.length} subscriptions`)
        const localFeedCache = {}
        for (const subscription of allSubscriptions) {
          const { feed_url: feedUrl, chat_id: chatId } = subscription
          await tracer.startActiveSpan(
            'checkFeed',
            {
              attributes: {
                'feed.url': feedUrl,
                'chat.id': chatId,
              },
            },
            async (feedSpan) => {
              const startTime = Date.now()
              try {
                const feed = localFeedCache[feedUrl] || await parser.parseURL(feedUrl)
                localFeedCache[feedUrl] = feed
                const sentItems = await storage.getSentItems(feedUrl, chatId)
                feedSpan.setAttribute('sent.items.count', sentItems.length)
                console.log(`Sent items for ${chatId}: ${sentItems}`)

                for (const item of feed.items) {
                  if (!sentItems.includes(item.link)) {
                    const message = `Nuevo contenido en el feed: ${feed.title}\n\n${he.decode(
                      item.title
                    )}\n${item.link}`

                    console.log(`Sending ${message} to ${chatId}`)
                    bot.telegram.sendMessage(chatId, message)

                    await storage.addSentItem(feedUrl, item.link, chatId)
                  }
                }
              } catch (error) {
                feedSpan.recordException(error)
                console.error(`Failed to check feed ${feedUrl}:`, error)
              } finally {
                const endTime = Date.now()
                checkFeedDuration.record(endTime - startTime, {
                  'feed.url': feedUrl,
                })
                feedSpan.end()
              }
            }
          )
        }
      } catch (error) {
        span.recordException(error)
        console.error('Failed to get all subscriptions:', error)
      } finally {
        span.end()
      }
    })
  }

  return { checkFeeds }
}

module.exports = createFeedService