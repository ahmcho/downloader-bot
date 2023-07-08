require('dotenv').config();

const {
    Telegraf,
} = require('telegraf');

const Downloader = require('./src/downloader');

const bot = new Telegraf(process.env.BOT_TOKEN);

const downloader = new Downloader();

bot.use(async (ctx, next) => {
    const context = ctx.update.message ? ctx.update.message : ctx.update.callback_query.message;
    // Failsafe to prevent others from using this bot, otherwise everyone will be send links for downloading to YOUR computer.
    if (
        context.from.id == process.env.ME ||
        context.chat.id == process.env.ME
    ) {
        await next();
    } else {
        await ctx.reply('Unauthorized');
    }
})

bot.on('document', async (ctx) => {
    downloader.handleDocument(ctx);
});

bot.hears(/mp3 (.+)/, async (ctx) => {
    downloader.handleAudio(ctx);
});

bot.hears('Check supported websites 🌍', async (ctx) => {
    downloader.handleSupportedWebsites(ctx);
});

bot.action(/.+/, async (ctx) => {
    downloader.handleAction(ctx);
});

bot.hears('F.A.Q ℹ️', async (ctx) => {
    await ctx.reply('F.A.Q section coming soon');
});

bot.hears('Check for the updates 🔄', async (ctx) => {
    downloader.handleUpdate(ctx);
});

bot.hears(/video (.+)/, async (ctx) => {
    downloader.handleVideo(ctx);
});

bot.help(async (ctx) => {
    await ctx.reply('F.A.Q section coming soon');
});

bot.start(async (ctx) => {
    downloader.handleStart(ctx);
});

bot.launch().then(() => {
    console.log('Bot launched');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))