const { instrumentedCommand } = require('../instrumentation')

const createListService = (storage) => {
  const listSubscriptions = async (ctx) => {
    const chatId = ctx.chat.id

    try {
      const userSubscriptions = await storage.getSubscriptions(chatId)

      if (userSubscriptions.length === 0) {
        return ctx.reply('No estás suscrito a ningún feed.')
      }

      ctx.reply('Tus suscripciones:')
      for (const sub of userSubscriptions) {
        ctx.reply(sub.feed_title, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Borrar', callback_data: `unsubscribe:${sub.id}` }],
            ],
          },
        })
      }
    } catch (error) {
      console.error(error)
      ctx.reply('Ocurrió un error al obtener tus suscripciones.')
    }
  }

  return {
    listSubscriptions: instrumentedCommand('listar', listSubscriptions),
  }
}

module.exports = createListService
