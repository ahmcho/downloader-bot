/**
 * Youtube URL regex that detects all possible variants
 * 
 */
const YOUTUBE_URL_REGEX = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm;

/**
 * Regex that extracts progress data for YouTube URLs
 */
const PROGRESS_REGEX = /\[download\]\s+([\d\.]+)% of\s+([\d\.]+[A-Za-z]*) at\s+([\d\.]+[A-Za-z/]*) ETA (\d{2}:\d{2})/gm;

/**
 * Regex that extracts progress data for non-YouTube URLs, default progress string
 */
const PROGRESS_REGEX_NOT_YOUTUBE = /\[download\]\s+([\d.]+)% of ~?\s*([\d.]+MiB) at\s+([\d.]+MiB\/s) ETA (\d{2}:\d{2})/gm;

/**
 * Regex to extract yt-dlp format, to use as current track id
 */
const FORMAT_REGEX = /f\d+/gm;

/**
 * Regex for parsing yt-dlp -F command, that outputs the table of all available formats of a video
 */
const ID_AND_EXTENSION_REGEX = /^[0-9]+(-dash)?\s+((m4a)|(webm)|(3gp)|(mp4))\s{0,4}([0-9]+x[0-9]+|(audio))/gm;

/**
 * Regex to extract progress of YouTubeu playlist/channel 
 */
const PLAYLIST_PROGRESS_REGEX = / \d+ of \d+/gm;

/**
 * Regex to parse telegram pagination button query parameters
 */
const PAGE_URL_REGEX = /\?page=\w+(&?\w+=\d+){0,3}/gm;

/**
 * Regex to parse list item in a Markdown file/text
 */
const MARKDOWN_LIST_ITEM_REGEX = /\*\*(.*)\*\*/gmi;

/**
 * Regex to extract domain from the link
 */
const DOMAIN_EXTRACTOR_REGEX = /(?:http(?:s)?:\/\/)?(?:w{3}\.)?([^\.]+)/i;


const UNWANTED_CHARACTERS_IN_FILENAME_REGEX_1 = / *(\([^)]*\))|(\[[^)]*\]) */g;
const UNWANTED_CHARACTERS_IN_FILENAME_REGEX_2 = /(\[).*(\])?/g;

/**
 * Default pagination amount
 */
const PER_PAGE = 30;

/**
 * yt-dlp GitHub API releases list link
 */
const YT_DLP_GITHUB_RELEASE_URL = "https://api.github.com/repos/yt-dlp/yt-dlp/releases";

/**
 * yt-dlp GitHub API releases download link
 */
const YT_DLP_GITHUB_DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/download";

/**
 * yt-dlp supported websites list link
 */
const YT_DLP_SUPPORTED_WEBSITES_MD = "https://raw.githubusercontent.com/yt-dlp/yt-dlp/master/supportedsites.md";

module.exports = {
    YOUTUBE_URL_REGEX,
    PROGRESS_REGEX,
    PROGRESS_REGEX_NOT_YOUTUBE,
    FORMAT_REGEX,
    ID_AND_EXTENSION_REGEX,
    PER_PAGE,
    YT_DLP_GITHUB_RELEASE_URL,
    YT_DLP_GITHUB_DOWNLOAD_URL,
    YT_DLP_SUPPORTED_WEBSITES_MD,
    MARKDOWN_LIST_ITEM_REGEX,
    PAGE_URL_REGEX,
    PLAYLIST_PROGRESS_REGEX,
    DOMAIN_EXTRACTOR_REGEX,
    UNWANTED_CHARACTERS_IN_FILENAME_REGEX_1,
    UNWANTED_CHARACTERS_IN_FILENAME_REGEX_2
};