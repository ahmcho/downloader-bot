/**
 * Builds a string of supported websites 
 * 
 * @param {array} arrayOfWebsites Array of websites 
 * @returns string
 */
const buildPaginatedSiteList = (arrayOfWebsites) => {
    let finalMessage = '';
    arrayOfWebsites.map((website) => {
        finalMessage += `• <code>${website}</code>\n`;
    });
    return finalMessage;
}

module.exports.buildPaginatedSiteList = buildPaginatedSiteList;