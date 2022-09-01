/**
 * Regular expressions that are used in the project
 */
const YOUTUBE_URL_REGEX = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm;
//  ⬆️ detect all possible youtube links
const PROGRESS_REGEX = /\[download\] *(.*) of ([^ ]*)(:? *at *([^ ]*))?(:? *ETA *([^ ]*))?/gm;
//  ⬆️ parse yt-dlp progress string
const FORMAT_REGEX = /f\d+/gm;
//  ⬆️ extract current track id
const ID_AND_EXTENSION_REGEX = /^[0-9]+(-dash)?\s+((m4a)|(webm)|(3gp)|(mp4))\s{0,4}([0-9]+x[0-9]+|(audio))/gm;
//  ⬆️ parse yt-dlp -F command, that outputs the table of all available formats of a video
const PLAYLIST_PROGRESS_REGEX = / \d+ of \d+/gm;
//  ⬆️ extract progress of playlist/channel 
const PAGE_URL_REGEX = /\?page=\w+(&?\w+=\d+){0,3}/gm;
//  ⬆️ parse telegram pagination button query parameters
const MARKDOWN_LIST_ITEM_REGEX = /\*\*(.*)\*\*/gmi;
//  ⬆️ parse list item in a Markdown file/text
const DOMAIN_EXTRACTOR_REGEX = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/gim;

const PER_PAGE = 30;
const YT_DLP_GITHUB_RELEASE_URL = "https://api.github.com/repos/yt-dlp/yt-dlp/releases";
const YT_DLP_GITHUB_DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/download";
const YT_DLP_SUPPORTED_WEBSITES_MD = "https://raw.githubusercontent.com/yt-dlp/yt-dlp/master/supportedsites.md";

module.exports = {
    YOUTUBE_URL_REGEX,
    PROGRESS_REGEX,
    FORMAT_REGEX,
    ID_AND_EXTENSION_REGEX,
    PER_PAGE,
    YT_DLP_GITHUB_RELEASE_URL,
    YT_DLP_GITHUB_DOWNLOAD_URL,
    YT_DLP_SUPPORTED_WEBSITES_MD,
    MARKDOWN_LIST_ITEM_REGEX,
    PAGE_URL_REGEX,
    PLAYLIST_PROGRESS_REGEX,
    DOMAIN_EXTRACTOR_REGEX
};