const { tracer, checkFeedDuration } = require('./instrumentation')

const createFeedService = (storage, bot, parser) => {
  const checkFeeds = async () => {
    await tracer.startActiveSpan('checkFeeds', async (span) => {
      try {
        const allFeedUrls = await storage.getAllSubscriptions()
        span.setAttribute('feeds.count', allFeedUrls.length)
        console.log(`Checking ${allFeedUrls}`)

        for (const feedUrl of allFeedUrls) {
          await tracer.startActiveSpan(
            'checkFeed',
            {
              attributes: {
                'feed.url': feedUrl,
              },
            },
            async (feedSpan) => {
              const startTime = Date.now()
              try {
                const feed = await parser.parseURL(feedUrl)
                const sentItems = await storage.getSentItems(feedUrl)
                feedSpan.setAttribute('sent.items.count', sentItems.length)
                console.log(`Sent items ${sentItems}`)

                for (const item of feed.items) {
                  if (!sentItems.includes(item.link)) {
                    const message = `Nuevo contenido en el feed: ${feed.title}\n\n${item.title}\n${item.link}`

                    const subscribers = await storage.getSubscribers(feedUrl)
                    feedSpan.setAttribute(
                      'subscribers.count',
                      subscribers.length
                    )

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