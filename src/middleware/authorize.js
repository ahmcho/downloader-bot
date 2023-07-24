/**
 * 
 * Authorize the request
 * 
 * @param {Context} ctx Telegram Update object
 * @param {function} next Function to execute next
 */
const authorize = async (ctx, next) => {
    const context = ctx.update.message ? ctx.update.message : ctx.update.callback_query.message;
    /**
     * Failsafe to prevent others from using this bot, otherwise everyone will be send links for downloading to YOUR computer. 
    */ 
    if(
        context.from.id == process.env.ME || context.chat.id == process.env.ME
    )
    {
        await next();
    } else 
    {
        await ctx.reply('Unauthorized');
    }
}
 
module.exports.authorize = authorize;