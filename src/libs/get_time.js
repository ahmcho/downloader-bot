/**
 * Parses current timestamp
 * 
 * @returns string
 */
const getCurrentTime = () => {
    return new Date(((new Date()).setHours((new Date().getHours() + 4)))).toISOString().split('T');
}

module.exports.getCurrentTime = getCurrentTime