const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./rss-watcher.db')

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      feed_url TEXT NOT NULL,
      feed_title TEXT NOT NULL DEFAULT '',
      UNIQUE (chat_id, feed_url)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS sent_items (
      feed_url TEXT NOT NULL,
      item_link TEXT NOT NULL,
      PRIMARY KEY (feed_url, item_link)
    )
  `)
})

module.exports = db
