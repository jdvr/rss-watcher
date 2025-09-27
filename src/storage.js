const sqlite3 = require('sqlite3')

class Storage {
  constructor(db) {
    this.db = db
  }

  addSubscription(chatId, feedUrl, feedTitle) {
    return this.isSubscribed(chatId, feedUrl).then((isSubscribed) => {
      if (isSubscribed) {
        return null
      }
      return new Promise((resolve, reject) => {
        this.db.run(
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
    })
  }

  removeSubscription(subscriptionId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM subscriptions WHERE id = ?',
        [subscriptionId],
        function (err) {
          if (err) {
            return reject(err)
          }
          resolve(this.changes)
        }
      )
    })
  }

  getSubscriptions(chatId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM subscriptions WHERE chat_id = ?',
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
      this.db.all(
        'SELECT DISTINCT feed_url FROM subscriptions',
        (err, rows) => {
          if (err) {
            return reject(err)
          }
          resolve(rows.map((row) => row.feed_url))
        }
      )
    })
  }

  getSubscribers(feedUrl) {
    return new Promise((resolve, reject) => {
      this.db.all(
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

  addSentItem(feedUrl, itemLink) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO sent_items (feed_url, item_link) VALUES (?, ?)',
        [feedUrl, itemLink],
        function (err) {
          if (err) {
            return reject(err)
          }
          resolve(this.lastID)
        }
      )
    })
  }

  getSentItems(feedUrl) {
    return new Promise((resolve, reject) => {
      this.db.all(
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

  isSubscribed(chatId, feedUrl) {
    return new Promise((resolve, reject) => {
      this.db.get(
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

  getSubscriptionById(subscriptionId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM subscriptions WHERE id = ?',
        [subscriptionId],
        (err, row) => {
          if (err) {
            return reject(err)
          }
          resolve(row)
        }
      )
    })
  }
}

module.exports = Storage
