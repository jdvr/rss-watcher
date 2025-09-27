require('dotenv').config()
const createDb = require('./src/database.js')
const Storage = require('./src/storage.js')
const createBot = require('./src/bot')
const createFeedService = require('./src/check-feeds')
const { initMetrics } = require('./src/instrumentation')
const Parser = require('rss-parser')

const checkInterval = process.env.RSS_WATHCER_CHECK_INTERVAL_MINUTES || 10

const db = createDb('./data/rss-watcher.sqlite')
const storage = new Storage(db)
const bot = createBot(storage)
const parser = new Parser()
const feedService = createFeedService(storage, bot, parser)

initMetrics(storage)

console.log(`Feeds are checked every ${checkInterval} minute(s)`)
setInterval(feedService.checkFeeds, checkInterval * 60 * 1000)

bot.launch()

console.log('Bot started')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
