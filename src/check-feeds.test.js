const createFeedService = require('./check-feeds')

describe('checkFeeds', () => {
  it('should check feeds and send messages to subscribers', async () => {
    const storage = {
      getAllSubscriptionsWithChats: jest.fn().mockResolvedValue([
        { feed_url: 'https://example.com/rss.xml', chat_id: 123 },
      ]),
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

    expect(storage.getAllSubscriptionsWithChats).toHaveBeenCalled()
    expect(storage.getSentItems).toHaveBeenCalledWith(
      'https://example.com/rss.xml',
      123
    )
    expect(bot.telegram.sendMessage).toHaveBeenCalled()
    expect(storage.addSentItem).toHaveBeenCalledWith(
      'https://example.com/rss.xml',
      'https://example.com/item1',
      123
    )
  })

  it('should not send messages if all items have been sent', async () => {
    const storage = {
      getAllSubscriptionsWithChats: jest.fn().mockResolvedValue([
        { feed_url: 'https://example.com/rss.xml', chat_id: 123 },
      ]),
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

    expect(storage.getAllSubscriptionsWithChats).toHaveBeenCalled()
    expect(storage.getSentItems).toHaveBeenCalledWith(
      'https://example.com/rss.xml',
      123
    )
    expect(bot.telegram.sendMessage).not.toHaveBeenCalled()
    expect(storage.addSentItem).not.toHaveBeenCalled()
  })

  it('should unescape HTML entities from item titles', async () => {
    const storage = {
      getAllSubscriptionsWithChats: jest
        .fn()
        .mockResolvedValue([
          { feed_url: 'https://example.com/rss.xml', chat_id: 123 },
        ]),
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
            title: 'This title has a &#039;single quote&#039;',
            link: 'https://example.com/item-with-html-entities',
          },
        ],
      }),
    }

    const feedService = createFeedService(storage, bot, parser)
    await feedService.checkFeeds()

    const expectedMessage =
      "Nuevo contenido en el feed: Example Feed\n\nThis title has a 'single quote'\nhttps://example.com/item-with-html-entities"
    expect(bot.telegram.sendMessage).toHaveBeenCalledWith(123, expectedMessage)
  })

  it('should only parse a feed once even with multiple subscribers', async () => {
    const storage = {
      getAllSubscriptionsWithChats: jest.fn().mockResolvedValue([
        { feed_url: 'https://example.com/rss.xml', chat_id: 123 },
        { feed_url: 'https://example.com/rss.xml', chat_id: 456 },
      ]),
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

    expect(parser.parseURL).toHaveBeenCalledTimes(1)
    expect(parser.parseURL).toHaveBeenCalledWith('https://example.com/rss.xml')
    expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(2)
  })
})