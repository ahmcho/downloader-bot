const axios = require('axios');
const { getBinaryName } = require('./general_helpers');
const {
    YT_DLP_GITHUB_RELEASE_URL,
    YT_DLP_GITHUB_DOWNLOAD_URL,
    YT_DLP_SUPPORTED_WEBSITES_MD,
    MARKDOWN_LIST_ITEM_REGEX
} = require('../constants');

/**
 * Extracts the latest version of yt-dlp library
 * 
 * @return string
 */
const getLatestVersion = async () => {
    const ghRequestResult = await axios.get(YT_DLP_GITHUB_RELEASE_URL);
    return ghRequestResult.data[0].tag_name;
}

/**
 * Generates a download link for the binary
 * 
 * @return string
 */
const getDownloadLink = async () => {
    const latestVersion = await getLatestVersion();
    const binaryName = getBinaryName();
    return `${YT_DLP_GITHUB_DOWNLOAD_URL}/${latestVersion}/${binaryName}`;
}

/**
 * Gets list of supported websites
 * 
 * @return array
 */
const getSupportedWebsites = async () => {
    const {data} = await axios.get(YT_DLP_SUPPORTED_WEBSITES_MD);
    const supportedWebsitesRaw = data.match(MARKDOWN_LIST_ITEM_REGEX);
    let final = supportedWebsitesRaw.map((item) => {
        return item.replace(/\*\*/gm,'');
    }).filter((item) => {
        if(item.toLowerCase().includes('youtube')){
            return false;
        }
        return true;
    });
    return final;
}

module.exports = {
    getLatestVersion,
    getDownloadLink,
    getSupportedWebsites
}