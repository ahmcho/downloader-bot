require('dotenv').config();

const {
    ID_AND_EXTENSION_REGEX
} = require('../constants');


const generateMessagePlaylist = (progress, info, matches, options) => {
    return `${info}\n\n${(info.includes('playlist') ? 'Playlist' : 'Channel')} progress: ${progress}\n\n⚙️   Current track: ${options[2].includes("audio") ? "Audio 🎵" : "Video 📹 ("+options[2]+")"}\n💾   File size:    ${matches[2]}\n⏳   Progress:    ${matches[1]}\n🚄   Speed:       ${matches[4]}\n⏱   Time left:   ${matches[6]}\n`;
}

const generateOutputMessage = (is_video, info, matches, options) => {
    if(is_video && options){
        return `${info}\n\n⚙️   Current track: ${options[2].includes("audio") ? "Audio 🎵" : "Video 📹 ("+options[2]+")"}\n💾   File size:    ${matches[2]}\n⏳   Progress:    ${matches[1]}\n🚄   Speed:       ${matches[4]}\n⏱   Time left:   ${matches[6]}\n`;
    } else {
        return `${info}\n\n💾   File size:    ${matches[2]}\n⏳   Progress:    ${matches[1]}\n🚄   Speed:       ${matches[4]}\n⏱   Time left:   ${matches[6]}\n`;        
    }
};

const getCurrentStreamOptions = (outputString) => {
    const options = [];
    let outputMatches = outputString.match(ID_AND_EXTENSION_REGEX);

    outputMatches.map((match) => {
        options.push(match.split(' ').filter(Boolean))
    });

    return options;
}

const generateDefaultPaginationKeyboard = async ([ctx, Markup, chat_id, message_id, text], [progress, current_page, per_page, total]) => {
    return ctx.telegram.editMessageText(chat_id, message_id,null,text,{ parse_mode: 'HTML',...Markup.inlineKeyboard([
        Markup.button.callback('⬅️', `goto?page=prev&currentPage=${current_page-1}&perpage=${per_page}&total=${total}`),
        Markup.button.callback(progress, `goto?page=start&currentPage=${current_page}&perpage=${per_page}&total=${total}`),
        Markup.button.callback('➡️',`goto?page=next&currentPage=${current_page+1}&perpage=${per_page}&total=${total}`)
    ])});
}



module.exports.generateOutputMessage = generateOutputMessage
module.exports.getCurrentStreamOptions = getCurrentStreamOptions
module.exports.generateMessagePlaylist = generateMessagePlaylist;
module.exports.generateDefaultPaginationKeyboard = generateDefaultPaginationKeyboard;