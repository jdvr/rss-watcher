const db = require('./database.js')

class Storage {
  addSubscription(chatId, feedUrl, feedTitle) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO subscriptions (chat_id, feed_url, feed_title) VALUES (?, ?, ?)',
        [chatId, feedUrl, feedTitle],
        function (err) {
          if (err) {
            return reject(err)
          }
          resolve(this.lastID)
        }
      )
    })
  }

  removeSubscription(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM subscriptions WHERE id = ?', [id], (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  getSubscriptions(chatId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, feed_url, feed_title FROM subscriptions WHERE chat_id = ?',
        [chatId],
        (err, rows) => {
          if (err) {
            return reject(err)
          }
          resolve(rows)
        }
      )
    })
  }

  getAllSubscriptions() {
    return new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT feed_url FROM subscriptions', [], (err, rows) => {
        if (err) {
          return reject(err)
        }
        resolve(rows.map((row) => row.feed_url))
      })
    })
  }

  getSentItems(feedUrl) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT item_link FROM sent_items WHERE feed_url = ?',
        [feedUrl],
        (err, rows) => {
          if (err) {
            return reject(err)
          }
          resolve(rows.map((row) => row.item_link))
        }
      )
    })
  }

  addSentItem(feedUrl, itemLink) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO sent_items (feed_url, item_link) VALUES (?, ?)',
        [feedUrl, itemLink],
        (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        }
      )
    })
  }

  isSubscribed(chatId, feedUrl) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM subscriptions WHERE chat_id = ? AND feed_url = ?',
        [chatId, feedUrl],
        (err, row) => {
          if (err) {
            return reject(err)
          }
          resolve(!!row)
        }
      )
    })
  }

  getSubscriptionById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM subscriptions WHERE id = ?', [id], (err, row) => {
        if (err) {
          return reject(err)
        }
        resolve(row)
      })
    })
  }

  getSubscribers(feedUrl) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT chat_id FROM subscriptions WHERE feed_url = ?',
        [feedUrl],
        (err, rows) => {
          if (err) {
            return reject(err)
          }
          resolve(rows.map((row) => row.chat_id))
        }
      )
    })
  }
}

module.exports = new Storage()
