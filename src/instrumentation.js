const { trace, metrics } = require('@opentelemetry/api')

const tracer = trace.getTracer('rss-watcher-tracer')
const meter = metrics.getMeter('rss-watcher-meter')

const METRICS_PREFIX = 'rss.watcher.'

const checkFeedDuration = meter.createHistogram(
  `${METRICS_PREFIX}check.feed.duration`,
  {
    description: 'Duration of each feed process',
    unit: 'ms',
  }
)

const activeFeeds = meter.createObservableGauge(
  `${METRICS_PREFIX}active.feeds`,
  {
    description: 'Number of active feeds',
    unit: '1',
  }
)

const activeChats = meter.createObservableGauge(
  `${METRICS_PREFIX}active.chats`,
  {
    description: 'Number of active chats',
    unit: '1',
  }
)

const instrumentedCommand = (command, fn) => {
  return (ctx) => {
    tracer.startActiveSpan(
      `command: ${command}`,
      {
        attributes: {
          'chat.id': ctx.chat.id,
          'user.id': ctx.from.id,
          'user.username': ctx.from.username,
        },
      },
      (span) => {
        span.addEvent('command.received')
        fn(ctx)
        span.end()
      }
    )
  }
}

const initMetrics = (storage) => {
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
}

module.exports = {
  tracer,
  meter,
  checkFeedDuration,
  instrumentedCommand,
  initMetrics,
}