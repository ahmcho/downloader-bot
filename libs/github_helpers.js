const axios = require('axios');
const {getBinaryName} = require('../libs/get_binary');
const {
    YT_DLP_GITHUB_RELEASE_URL,
    YT_DLP_GITHUB_DOWNLOAD_URL,
    YT_DLP_SUPPORTED_WEBSITES_MD,
    MARKDOWN_LIST_ITEM_REGEX
} = require('../constants');

const getLatestVersion = async () => {
    const ghRequestResult = await axios.get(YT_DLP_GITHUB_RELEASE_URL);
    return ghRequestResult.data[0].tag_name;
}

const getDownloadLink = async () => {
    const latestVersion = await getLatestVersion();
    const binaryName = getBinaryName();
    return `${YT_DLP_GITHUB_DOWNLOAD_URL}/${latestVersion}/${binaryName}`;
}

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