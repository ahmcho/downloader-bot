require('dotenv').config();
const {
    spawn
} = require('child_process');
const {
    ID_AND_EXTENSION_REGEX,
} = require('../constants');

/**
 * Returns current download progress for a playlist
 * 
 * @param {String} progress Playlist progress
 * @param {String} info General information message
 * @param {Array} matches Array of items to parse progress information
 * @param {Array} options Current track
 * @returns string 
 */
const generateMessagePlaylist = (progress, info, matches, options) => {
    return `${info}\n\n${(info.includes('playlist') ? 'Playlist' : 'Channel')} progress: ${progress}\n\n⚙️   Current track: ${options[2].includes("audio") ? "Audio 🎵" : "Video 📹 ("+options[2]+")"}\n💾   File size:    ${matches[2]}\n⏳   Progress:    ${matches[1]}%\n🚄   Speed:       ${matches[4]}\n⏱   Time left:   ${matches[6]}\n`;
}

/**
 * Generates a string with progress information
 * 
 * @param {Boolean} is_video Flag to check if current track is a video track
 * @param {String} info General information message
 * @param {Array} matches Array of items to parse progress information
 * @param {Array} options Current track
 * @returns string
 */
const generateOutputMessage = (is_video, info, matches, options) => {
    if(is_video && options){
        return `${info}\n\n⚙️   Current track: ${"Video 📹 ("+options[2]+")"}\n💾   File size:    ${matches[2]}\n⏳   Progress:    ${matches[1]}%\n🚄   Speed:       ${matches[3]}\n⏱   Time left:   ${matches[4]}\n`;
    } else {
        return `${info}\n\n💾   File size:    ${matches[2]}\n⏳   Progress:    ${matches[1]}%\n🚄   Speed:       ${matches[3]}\n⏱   Time left:   ${matches[4]}\n`;        
    }
};

/**
 * Parses a table of available stream options from yt-dlp command
 * 
 * @param {string} outputString 
 * @returns array
 */
const getCurrentStreamOptions = (outputString) => {
    const options = [];
    let outputMatches = outputString.match(ID_AND_EXTENSION_REGEX);
    outputMatches.map((match) => {
        options.push(match.split(' ').filter(Boolean))
    });

    return options;
}

/**
 * Extracts the video title from yt-dlp command
 * 
 * @param {string} outputString 
 * @returns Promise
 */
const getVideoTitle = async (outputString) => {
    let title;
    let titleProcess =  spawn('yt-dlp', [['--get-title'], [outputString]]);
    
    titleProcess.stdout.on('data', (data) => {
        bufferData = data.toString();
        title = bufferData;
    });

    let titleProcessPromise = new Promise((resolve, reject) => {
        titleProcess.on('close', async (code) => {
            resolve(title);
        });
    });

    try {
        return await titleProcessPromise;
    } catch (error) {
        console.log(error);
    }
}

/**
 * Generates default pagination keyboard 
 * 
 * @param {array} telegramOptions Options for Telegram
 * @param {array} paginationOptions Options for pagination 
 * @returns Promise
 */
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
module.exports.getVideoTitle = getVideoTitle;