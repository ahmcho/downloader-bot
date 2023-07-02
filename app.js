require('dotenv').config();
const {
    Telegraf,
} = require('telegraf');

const Downloader = require('./src/downloader');


const bot = new Telegraf(process.env.BOT_TOKEN);

const downloader = new Downloader();

bot.on('document', async (ctx) => {
    downloader.handleDocument(ctx);
});

bot.hears(/mp3 (.+)/, async (ctx) => {
    if (ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME) {
        //  ⬆️ Failsafe to prevent others from using this bot, otherwise everyone will be send links for downloading to YOUR computer.
        downloader.handleAudio(ctx);
    } else {
        ctx.reply('Unauthorized');
    }
});

bot.hears('Check supported websites 🌍', async (ctx) => {
    if (ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME) {
        downloader.handleSupportedWebsites(ctx);
    }
});

bot.action(/.+/, async (ctx) => {
    downloader.handleAction(ctx);
});

bot.hears('F.A.Q ℹ️', async (ctx) => {
    await ctx.reply('F.A.Q section coming soon');
});

bot.hears('Check for the updates 🔄', async (ctx) => {
    if (ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME) {
        downloader.handleUpdate(ctx);
    }
});

bot.hears(/video (.+)/, async (ctx) => {
    if (ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME) {
        downloader.handleVideo(ctx);
    } else {
        await ctx.reply('Unauthorized');
    }
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