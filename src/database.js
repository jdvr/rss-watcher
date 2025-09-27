const sqlite3 = require('sqlite3')

const createDb = (filename) => {
  const db = new sqlite3.Database(filename, (err) => {
    if (err) {
      console.error(err.message)
    }
    console.log(`Connected to the ${filename} database.`)
  })

  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER,
        feed_url TEXT,
        feed_title TEXT
      )`
    )

    db.run(
      `CREATE TABLE IF NOT EXISTS sent_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_url TEXT,
        item_link TEXT
      )`
    )
  })

  return db
}

module.exports = createDb