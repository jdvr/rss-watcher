const createFeedService = require('./check-feeds')

describe('checkFeeds', () => {
  it('should check feeds and send messages to subscribers', async () => {
    const storage = {
      getAllSubscriptions: jest.fn().mockResolvedValue([
        'https://example.com/rss.xml',
      ]),
      getSubscribers: jest.fn().mockResolvedValue([123]),
      getSentItems: jest.fn().mockResolvedValue([]),
      addSentItem: jest.fn(),
    }

    const bot = {
      telegram: {
        sendMessage: jest.fn(),
      },
    }

    const parser = {
      parseURL: jest.fn().mockResolvedValue({
        title: 'Example Feed',
        items: [
          {
            title: 'Item 1',
            link: 'https://example.com/item1',
          },
        ],
      }),
    }

    const feedService = createFeedService(storage, bot, parser)
    await feedService.checkFeeds()

    expect(storage.getAllSubscriptions).toHaveBeenCalled()
    expect(storage.getSubscribers).toHaveBeenCalledWith(
      'https://example.com/rss.xml'
    )
    expect(storage.getSentItems).toHaveBeenCalledWith(
      'https://example.com/rss.xml'
    )
    expect(bot.telegram.sendMessage).toHaveBeenCalled()
    expect(storage.addSentItem).toHaveBeenCalled()
  })

  it('should not send messages if all items have been sent', async () => {
    const storage = {
      getAllSubscriptions: jest.fn().mockResolvedValue([
        'https://example.com/rss.xml',
      ]),
      getSubscribers: jest.fn().mockResolvedValue([123]),
      getSentItems: jest.fn().mockResolvedValue(['https://example.com/item1']),
      addSentItem: jest.fn(),
    }

    const bot = {
      telegram: {
        sendMessage: jest.fn(),
      },
    }

    const parser = {
      parseURL: jest.fn().mockResolvedValue({
        title: 'Example Feed',
        items: [
          {
            title: 'Item 1',
            link: 'https://example.com/item1',
          },
        ],
      }),
    }

    const feedService = createFeedService(storage, bot, parser)
    await feedService.checkFeeds()

    expect(storage.getAllSubscriptions).toHaveBeenCalled()
    expect(storage.getSentItems).toHaveBeenCalledWith(
      'https://example.com/rss.xml'
    )
    expect(storage.getSubscribers).not.toHaveBeenCalled()
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled()
    expect(storage.addSentItem).not.toHaveBeenCalled()
  })
})