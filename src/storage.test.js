const Storage = require('./storage')
const createDb = require('./database')
const fs = require('fs')

describe('storage', () => {
  let db
  let storage
  const dbfile = './test.sqlite'

  beforeEach(async () => {
    db = createDb(dbfile)
    storage = new Storage(db)
  })

  afterEach(async () => {
    db.close()
    fs.unlinkSync(dbfile)
  })

  it('should add and get subscriptions', async () => {
    await storage.addSubscription(123, 'https://example.com/rss.xml', 'Example Feed')
    const subscriptions = await storage.getSubscriptions(123)
    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0].feed_title).toBe('Example Feed')
  })

  it('should not add duplicate subscriptions', async () => {
    await storage.addSubscription(123, 'https://example.com/rss.xml', 'Example Feed')
    const subscriptionId = await storage.addSubscription(
      123,
      'https://example.com/rss.xml',
      'Example Feed'
    )
    expect(subscriptionId).toBeNull()
  })

  it('should remove subscriptions', async () => {
    const subscriptionId = await storage.addSubscription(
      123,
      'https://example.com/rss.xml',
      'Example Feed'
    )
    await storage.removeSubscription(subscriptionId)
    const subscriptions = await storage.getSubscriptions(123)
    expect(subscriptions).toHaveLength(0)
  })

  it('should get all subscriptions', async () => {
    await storage.addSubscription(123, 'https://example.com/rss.xml', 'Example Feed')
    await storage.addSubscription(456, 'https://example.com/rss2.xml', 'Example Feed 2')
    const allSubscriptions = await storage.getAllSubscriptions()
    expect(allSubscriptions).toHaveLength(2)
  })

  it('should get subscribers for a feed', async () => {
    await storage.addSubscription(123, 'https://example.com/rss.xml', 'Example Feed')
    await storage.addSubscription(456, 'https://example.com/rss.xml', 'Example Feed')
    const subscribers = await storage.getSubscribers('https://example.com/rss.xml')
    expect(subscribers).toHaveLength(2)
    expect(subscribers).toContain(123)
    expect(subscribers).toContain(456)
  })

  it('should add and get sent items', async () => {
    await storage.addSentItem('https://example.com/rss.xml', 'https://example.com/item1', 123)
    const sentItems = await storage.getSentItems('https://example.com/rss.xml', 123)
    expect(sentItems).toHaveLength(1)
    expect(sentItems[0]).toBe('https://example.com/item1')
  })

  it('should remove sent items', async () => {
    await storage.addSentItem('https://example.com/rss.xml', 'https://example.com/item1', 123)
    await storage.removeSentItems('https://example.com/rss.xml', 123)
    const sentItems = await storage.getSentItems('https://example.com/rss.xml', 123)
    expect(sentItems).toHaveLength(0)
  })

  it('should check if a user is subscribed', async () => {
    await storage.addSubscription(123, 'https://example.com/rss.xml', 'Example Feed')
    const isSubscribed = await storage.isSubscribed(123, 'https://example.com/rss.xml')
    expect(isSubscribed).toBe(true)
    const isNotSubscribed = await storage.isSubscribed(456, 'https://example.com/rss.xml')
    expect(isNotSubscribed).toBe(false)
  })

  it('should get subscription by id', async () => {
    const subscriptionId = await storage.addSubscription(
      123,
      'https://example.com/rss.xml',
      'Example Feed'
    )
    const subscription = await storage.getSubscriptionById(subscriptionId)
    expect(subscription.id).toBe(subscriptionId)
    expect(subscription.feed_title).toBe('Example Feed')
  })
})