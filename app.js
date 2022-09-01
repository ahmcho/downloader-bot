require('dotenv').config();
const iconv = require('iconv-lite');
const axios = require('axios');
const chalk = require('chalk');
const { Telegraf, Markup } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
    YOUTUBE_URL_REGEX,
    PROGRESS_REGEX,
    FORMAT_REGEX,
    PER_PAGE,
    DOMAIN_EXTRACTOR_REGEX,
    PAGE_URL_REGEX,
    PLAYLIST_PROGRESS_REGEX
} = require('./constants');

const {paginate} = require('./libs/paginate');
const {buildPaginatedSiteList} = require('./libs/list_builder');
const {getBinaryName} = require('./libs/get_binary');

const {
    getSupportedWebsites,
    getLatestVersion,
    getDownloadLink
} = require('./libs/github_helpers');

const { 
    getCurrentStreamOptions, 
    generateOutputMessage, 
    generateDefaultPaginationKeyboard,
    generateMessagePlaylist
} = require('./libs/tg_helpers');

const { getCurrentTime } = require('./libs/get_time');

const bot = new Telegraf(process.env.BOT_TOKEN);

const fullPath = path.resolve(process.env.DEFAULT_DOWNLOAD_LOCATION);

let args = [];
let formatOptions;
let bufferData;
let format = '';
let downloader;
let info;
let list;
let hasAlreadyBeenDownloaded = false;
let isBeingExtracted = false;
let isPlaylist = false;
let isChannel = false;
let playlistProgress;
let downloadedFile = '';
let error = '';

bot.on('document', async(ctx) => {
    // User provided cookie file
    const document = ctx.update.message.document;
    const documentId = document.file_id;
    const getFileResponse = await ctx.telegram.getFile(documentId);
    const filePath = getFileResponse.file_path;
    const link = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
    console.log(link);
    //# Netscape HTTP Cookie File
    
});
bot.hears(/mp3 (.+)/, async (ctx) =>{
    if(ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME){
        //  ⬆️ Failsafe to prevent others from using this bot, otherwise everyone will be send links for downloading to YOUR computer.
        const messageText = ctx.match[1];
        let foundMatches = messageText.match(YOUTUBE_URL_REGEX); 
        
        if(foundMatches != null) {
            
            await ctx.telegram.sendMessage(ctx.update.message.from.id, 'Started.');
            let sentMessage = await ctx.reply('Downloading...'); //Saving message to for using it's id in the future.
            const message_id = sentMessage.message_id;
            const from_id = sentMessage.chat.id;
            args.push(['--add-header'],['Cookie:COOKIE_STRING_EXTRACTED_FROM_BROWSER'],['-x'],['--audio-format'],['mp3'],messageText);
            args.push([`-P ${fullPath}`]);
            args.push(["-o"],["mp3/%(title)s.%(ext)s"],messageText);
            /*
                ⬆️ Setting up command-line arguments to extract cookie from the browser 
                    and
                convert video to .mp3 after it has been downloaded
            */
            info = `ℹ️ Downloading video as mp3`;
            downloader = spawn('yt-dlp',args); //Spawning yt-dlp process with arguments
            //downloader.stdout.setEncoding('ascii');
            downloader.stdout.on('data', async (data) => {
                console.log(data.toString());
                bufferData = iconv.decode(data,'win1251').toString();
                if(bufferData.includes('ExtractAudio') && bufferData.includes('Destination')){
                    downloadedFile =  bufferData.match(/[a-zA-Z]:\\.*/gm)[0];
                    isBeingExtracted = true;
                    await ctx.telegram.editMessageText(from_id, message_id, null, 'Converting file ⏳');
                }
                
            });
            
            //⬇️ Setting up an interval to periodically send messages to telegram
            let tgInterval = setInterval(() => {
                let progressMatches = PROGRESS_REGEX.exec(bufferData);
                let message = '';
                if(progressMatches){
                    message += generateOutputMessage(false, info, progressMatches, null);
                    let [currentDate, currentTime] = getCurrentTime();
                    ctx.telegram.editMessageText(from_id, message_id, null, `${message} \n🕐   Current time: ${currentDate} ${currentTime}`);
                }
                
            }, 500)
            
            //  Listening for data stream from spawned process
            downloader.stderr.on('data', (data) => {
                console.error(chalk.red(`STD_ERROR: ${data.toString()}`));
            });
            
            //  Listening for errors 
            downloader.on('error',(error) => {
                console.log('eror',error);
            });
    
            //  Listening for end stream closing
            downloader.on('close', async (code) => {
                clearInterval(tgInterval); //   Clearing interval so it stops sending messages
                //⬇️ Clearing variables;
                args = [];
                bufferData = null;
                downloader = null;
                isBeingExtracted = false;
                info = '';
                let artist, title;
                
                const formatedFileName = downloadedFile.slice(1).split(/\.mp3/gm)[0];
                console.log(chalk.green(`child process exited with code ${code}`));
                await ctx.telegram.editMessageText(from_id, message_id, null, "Downloaded ✅");
                const fileSizeMB = Math.ceil(fs.statSync(downloadedFile).size/(Math.pow(1024,2)));
                //Check if filesize is less than 50mb
                if(fileSizeMB < 50 ){
                    let sendingFileMessage = await ctx.telegram.sendMessage(from_id, "Sending file ⏳");
                    //const unnecessaryRegex = /(\[.*\])/gm;
                    //let trashFilenameMatch = formatedFileName.match(unnecessaryRegex);
                    let splitted = formatedFileName.split('\\');
                    let filenameFromSplitted = splitted[splitted.length-1];
                    // return console.log(filenameFromSplitted);
                    if(filenameFromSplitted.includes('-')){
                        // It has official video
                        [artist, title] = filenameFromSplitted.replace(/(\[.*\])/gm,'').split(/\s\-\s/gm);
                    } else {
                        // It does not have it
                        artist = "Untitled Artist"
                        title = filenameFromSplitted
                        //[artist, title] = formatedFileName.trim().split(/\s\-\s/gm);
                    }
                    title = title.trim();
                    artist = artist.trim();
                    //  ffmpeg copy to add metadata
                    const metadataArgs = [['-i'],[downloadedFile],['-metadata'],[`title=${title}`],['-metadata'],[`artist=${artist}`],[path.resolve(fullPath,`mp3/${artist}-${title}_enc.mp3`)]];

                    const metadataEncoder = spawn('ffmpeg', metadataArgs);
                    
                    metadataEncoder.stdout.on('data', (data) => {
                        bufferData = data.toString();
                        console.log('MetaData Encoder stdout data: ',bufferData);
                    });
                    
                    metadataEncoder.stderr.on('data', (data) => {
                        console.error(`MetaData Encoder stderr Data: ${chalk.bgBlack.yellow(data.toString())}`);
                    });

                    metadataEncoder.stderr.on('error', (data) => {
                        console.error(`MetaData Encoder stderr Error: ${chalk.red(data.toString())}`);
                    });
                    
                    //  Listening for errors 
                    metadataEncoder.on('error',(error) => {
                        console.log(chalk.bgWhite('MetaData Encoder Error'), chalk.red(error));
                    });
                    
                    metadataEncoder.on('close', async (code) => {
                        console.log(chalk.green(`child process exited with code ${code}`));
                        fs.renameSync(path.resolve(fullPath,`mp3/${artist}-${title}_enc.mp3`), path.resolve(fullPath,`mp3/${artist}-${title}.mp3`))
                        await ctx.telegram.sendAudio(from_id, { source: fs.readFileSync(path.resolve(fullPath,`mp3/${artist}-${title}.mp3`))}, {
                            title,
                            performer: artist
                        });
                        await ctx.telegram.editMessageText(sendingFileMessage.chat.id, sendingFileMessage.message_id, null, 'File sent ✅')
                        fs.unlinkSync(path.resolve(fullPath, `mp3/${artist}-${title}.mp3`));
                    });
                } else {
                    // TODO: Sent links on the server to download, instead of sending file 
                    await ctx.reply(`File is too big: ${fileSizeMB}MB\nUnable to send 🚫`);
                }
                fs.unlinkSync(path.resolve(fullPath, downloadedFile));
            });
        } else {
            await ctx.reply('Please provide a YouTube video link!');
        }        
    } else {
        ctx.reply('Unauthorized');
    }
});
bot.hears('Check supported websites 🌍', async (ctx) => {
    if(ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME){
        let currentPage = 1;
        list = await getSupportedWebsites();
        let total = Math.ceil(list.length/PER_PAGE);
        let progress = `${currentPage}/${total}`;
        await ctx.reply(`Total supported websites: ${list.length}`);
        let paginatedList = paginate(list, PER_PAGE, currentPage);
        let messageText = buildPaginatedSiteList(paginatedList);
        
        await ctx.reply(messageText,{ parse_mode: 'HTML',...Markup.inlineKeyboard([
            Markup.button.callback(progress, `goto?page=start&currentPage=${currentPage}&perpage=${PER_PAGE}&total=${list.length}`),
            Markup.button.callback('➡️',`goto?page=next&currentPage=${currentPage+1}&perpage=${PER_PAGE}&total=${list.length}`)
        ])});
    }
})
bot.action(/.+/, async (ctx) => {
    //⬆️ generic callback parser
    
    //⬇️ Extracting message_id, chat_id from previous message
    let messageId = ctx.update.callback_query.message.message_id;
    let chatId = ctx.update.callback_query.message.chat.id;
    
    //  Parsing callback data
    let pageUrlMath = ctx.match[0].match(PAGE_URL_REGEX)[0];
    //  Getting integer values for currentPage, PER_PAGE and total
    let [currentPage,,total] = pageUrlMath.match(/\d+/gm);
    
    //  Getting supported websites from github 
    list = await getSupportedWebsites();
    
    //  Creating pagination
    let paginatedList = paginate(list, PER_PAGE, currentPage);
    //  Generating message text, based on paginated list
    let messageText = buildPaginatedSiteList(paginatedList);
    
    //  Setting types manually to number 
    currentPage = +currentPage;
    total = +total;

    //  Calculating last page
    let lastPage = Math.ceil(total/PER_PAGE);
    let progress = `${currentPage}/${lastPage}`;

    const paginationOptions = [progress, currentPage, PER_PAGE, total];
    const tgOptions = [ctx, Markup, chatId, messageId, messageText];

    if(pageUrlMath.includes('start')){
        await ctx.answerCbQuery(`Current page: ${currentPage}`);
    }

    if(pageUrlMath.includes('next')){
        if(lastPage > currentPage){
            await ctx.answerCbQuery(`Navigating to next page`);            
            await generateDefaultPaginationKeyboard(tgOptions, paginationOptions);
        }

        if(currentPage == lastPage) {
            ctx.answerCbQuery(`Last page`);            
            await ctx.telegram.editMessageText(chatId, messageId, null, messageText, { parse_mode: 'HTML',...Markup.inlineKeyboard([
                Markup.button.callback('⬅️', `goto?page=prev&currentPage=${currentPage-1}&perpage=${PER_PAGE}&total=${total}`),
                Markup.button.callback(progress, `goto?page=start&currentPage=${currentPage}&perpage=${PER_PAGE}&total=${list.length}`),
            ])});
        }
    }
    
    if(pageUrlMath.includes('prev')){
        if(currentPage == 1){
            ctx.answerCbQuery(`First page`);            
            await ctx.telegram.editMessageText(chatId, messageId, null, messageText, { parse_mode: 'HTML',...Markup.inlineKeyboard([
                Markup.button.callback(progress, `goto?page=start&currentPage=${currentPage}&perpage=${PER_PAGE}&total=${list.length}`),
                Markup.button.callback('➡️',`goto?page=next&currentPage=${currentPage+1}&perpage=${PER_PAGE}&total=${total}`)
            ])});
        } else {
            ctx.answerCbQuery(`Navigating to previous page`);
            await generateDefaultPaginationKeyboard(tgOptions, paginationOptions);
        }
    }
});
bot.hears('F.A.Q ℹ️',async(ctx) => {
    await ctx.reply('F.A.Q section coming soon');
})
bot.hears('Check for the updates 🔄', async (ctx) => {
    if(ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME){
        //  Checking if we have the latest yt-dlp binary
        let currentVersion;
        let sentMessage = await ctx.reply('Checking ⏳');
        const from_id = sentMessage.chat.id;
    
        args.push(['--version']);
    
        downloader = spawn('yt-dlp',args);
        
        downloader.stdout.on('data', (data) => {
            currentVersion = data.toString();
        });
        
        downloader.stderr.on('data', (data) => {
            console.error(`stderr: ${data.toString()}`);
        });
        
        downloader.on('error',(error) => {
            console.log(error);
        });
    
        downloader.on('close', async (code) => {
            currentVersion = currentVersion.trim();
            args = [];
            downloader = null;
            //  Getting latest available version tag from GitHub
            const latestVersion = await getLatestVersion();
            console.log(chalk.yellow(`child process exited with code ${code}`));
            console.log('currentVersion: ', chalk.black.bgWhite(currentVersion));
            console.log('latestVersion: ', chalk.black.bgGreen(latestVersion));
    
            if(latestVersion != currentVersion){
                ctx.telegram.sendMessage(from_id, "There is an update available 🔄");
                ctx.telegram.sendMessage(from_id, "Updating ⏳")
                
                //  Downloading latest binary
                const downloadResponse = await axios({
                    method: "get",
                    url: await getDownloadLink(),
                    responseType: "stream"
                });
    
                // Saving stream to a file
                const binaryStream = fs.createWriteStream(getBinaryName());
                
                downloadResponse.data.pipe(binaryStream);
                
                binaryStream.on('error', function (err) {
                    console.log(chalk.white.bgRed(err))
                })
                
                binaryStream.on('close', function () {
                    ctx.telegram.sendMessage(from_id,'App has been updated! ✅')
                })
            } else {
                ctx.telegram.sendMessage(from_id, "Your app is up to date! ✅");
            }
        });
    }
});



bot.hears(/video (.+)/, async (ctx) => {
    if(ctx.update.message.from.id == process.env.ME || ctx.update.message.chat.id == process.env.ME){
        const messageText = ctx.match[1];
        await ctx.telegram.sendMessage(ctx.update.message.from.id, 'Started.');
        await ctx.reply('Checking available formats ⏳');
        let foundMatches = messageText.match(YOUTUBE_URL_REGEX);
        
        if(foundMatches != null) {
            let outputStr = '';
            args.push(['-F'],messageText);
            
            //  Checking available formats
            const formatChecker = spawn('yt-dlp', args);

            formatChecker.stdout.on('data', (data) => {
                console.log(data.toString());
                outputStr += data.toString();
            });

            formatChecker.on('error',(error) => {
                console.error(error);
            });

            formatChecker.on('close', async (code) => {
                args = [];
                info = '';
                
                // Parsing results after checking available formats
                formatOptions = getCurrentStreamOptions(outputStr);
                
                // Start downloading            
                args.push(['--add-header'], ['Cookie:COOKIE_STRING_EXTRACTED_FROM_BROWSER'], messageText);
                args.push([`-P ${fullPath}`]);
                /*
                   Checking if provided link is a playlist,
                   saving each video from the playlist 
                   to the folder with the playlist name
                */               
                
                if(messageText.includes('playlist')){
                    info = `ℹ️ Downloading Youtube playlist`;
                    isPlaylist = true;
                    args.push(["-o"], ["Youtube Video/%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s"]);
                }
                
                /*
                   Checking if provided link is a channel link,
                   saving each video from the channel 
                   to the folder with the channel name
                */
                
                if(messageText.includes('/c/') || messageText.includes('/user/')){
                    info = `ℹ️ Downloading Youtube channel`;
                    isChannel = true;
                    args.push(["-o"],["Youtube Video/%(uploader)s/%(playlist)s/%(playlist_index)s - %(title)s.%(ext)s"]);
                }
                
                // Checking if it's just a single video link
                if(messageText.includes('watch?') || messageText.includes('youtu.be')){
                    info = `ℹ️   Downloading single Youtube video\n`;
                    args.push([`-o`],[`Youtube Video/%(title)s.%(ext)s`]);
                }
                //return console.log(args);
                let sentMessage = await ctx.reply('Downloading...');
                let message_id = sentMessage.message_id;
                let from_id = sentMessage.chat.id;

                downloader = spawn('yt-dlp',args);
                
                downloader.stdout.on('data', (data) => {
                    bufferData = data.toString();
                    
                    if(bufferData.includes('Destination')){
                        //  Extracting format id from currently downloading stream
                        format = bufferData.match(FORMAT_REGEX)[0].slice(1);
                    }
                    
                    if(bufferData.includes('Finished downloading playlist:')){
                        downloader.kill('SIGTERM')
                    }

                    if(bufferData.includes("has already been downloaded")){
                        console.log('Test: ', bufferData);
                        hasAlreadyBeenDownloaded = true;
                    }
                    
                    if(bufferData.match(PLAYLIST_PROGRESS_REGEX)){
                        playlistProgress = bufferData.match(PLAYLIST_PROGRESS_REGEX)[0].trim();
                        isPlaylist = true;
                    }

                    console.log(chalk.green(bufferData));
                });

                let tgInterval = setInterval(() => {
                    let progressMatches = PROGRESS_REGEX.exec(bufferData);
                    let message = '';
                    if(format != ''){
                        //  Iterating over parsed format options to find our current format
                        let foundFormatData = formatOptions.find((item) => item[0] == format);
                        
                        if(progressMatches){
                            if(isPlaylist || isChannel){
                                message += generateMessagePlaylist(playlistProgress, info, progressMatches, foundFormatData);
                            } else {
                                message += generateOutputMessage(true, info, progressMatches, foundFormatData);
                            }

                            //  You can change the date for your needs, I had to add +4 hrs to correctly display Azerbaijan time
                            let [currentDate, currentTime] = getCurrentTime();
                            ctx.telegram.editMessageText(from_id, message_id, null, `${message} \n🕐   Current time: ${currentDate} ${currentTime}`);
                        }
                    }
                    
                }, 500)
                
                downloader.stderr.on('data', (data) => {
                    error = data.toString();
                    console.error(chalk.red(`stderr: ${data.toString()}`));
                });
                
                downloader.on('error',(error) => {
                    console.log(chalk.red(error));
                });
            
                downloader.on('close', async (code) => {
                    console.log(chalk.yellow(`child process exited with code ${code}`));
                    // Clearing all variables
                    clearInterval(tgInterval);
                    args = [];
                    bufferData = null;
                    downloader = null;
                    isPlaylist = false;
                    info = '';
                    if(error.length === 0){
                        await ctx.telegram.editMessageText(from_id, message_id, null, `Downloaded! ✅`);
                    } else {
                        await ctx.telegram.editMessageText(from_id, message_id, null, `An error occured 🚫`);
                        error = '';
                    }
                });
            });
        } else {
            // Downloading any other video
            let domain;
            /* 
                Extracting the main domain from the link that was sent
            */
            const domainMatches = DOMAIN_EXTRACTOR_REGEX.exec(messageText);
            if(domainMatches){
                domain = domainMatches[1].match(/[a-zA-Z]+/img)[0];
            }
            info = `ℹ️ Downloading ${domain} video`;
            args.push(['--cookies'],['cookies.txt'],[`-P ${fullPath}`]);
            
            /*
                Adding extractor variable to output folder template,
                so each video will be downloaded in corresponding folder
            */
            args.push(['-o'],['%(extractor)s/%(title)s.%(ext)s']);    
            args.push(messageText);
            
            let sentMessage = await ctx.reply('Downloading...');
            let message_id = sentMessage.message_id;
            let from_id = sentMessage.chat.id;
            
            downloader = spawn('yt-dlp', args);
            
            downloader.stdout.on('data', (data) => {
                bufferData = data.toString();
                console.log(chalk.green(bufferData));
                if(bufferData.includes("has already been downloaded")){
                    hasAlreadyBeenDownloaded = true;
                }
            });
            
            downloader.on('error',(error) => {
                console.log(chalk.red(error));
            });

            let tgInterval = setInterval(() => {
                let progressMatches = PROGRESS_REGEX.exec(bufferData);
                let message = '';
                if(progressMatches){
                    message += generateOutputMessage(null, info, progressMatches, null);
                    let [currentDate, currentTime] = getCurrentTime();
                    ctx.telegram.editMessageText(from_id, message_id, null, `${message} \n🕐   Current time: ${currentDate} ${currentTime}`);
                }                
            }, 500)
        
            downloader.stderr.on('data', (data) => {
                data = data.toString();
                error = data;
                console.log(chalk.red(`stderrr => : ${data}`));
            });
            
            downloader.on('error',(error) => {
                console.log(chalk.red(error));
            });

            downloader.on('close', async (code) => {
                console.log(chalk.yellow(`child process exited with code ${code}`));
                // Clearing all variables
                clearInterval(tgInterval);
                args = [];
                bufferData = null;
                downloader = null;
                info = '';
                if(error.length === 0 || error.includes('WARNING')){
                    if(!hasAlreadyBeenDownloaded){
                        await ctx.telegram.editMessageText(from_id, message_id, null, `Downloaded! ✅`);
                    } else {
                        await ctx.telegram.editMessageText(from_id, message_id, null, `Already downloaded ℹ️`);
                    }
                } else {
                    await ctx.telegram.editMessageText(from_id, message_id, null, `An error occured 🚫`);
                    error = '';
                }
            });
        }
    } else {
        ctx.reply('Unauthorized');
    }
});
bot.help(async(ctx) => {
    console.log(ctx.update.message.from);
    await ctx.reply('F.A.Q section coming soon');
})
bot.start(async (ctx) => {
    await ctx.reply(`Hello, ${ctx.update.message.from.username}`, Markup
    .keyboard([['Check for the updates 🔄'],['Check supported websites 🌍'],['F.A.Q ℹ️']])
    .resize());
    list = await getSupportedWebsites();
});


bot.launch().then(() => {
    console.log('Bot launched');
});
  
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))