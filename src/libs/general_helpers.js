const process = require('process');

/**
 * Returns binary name based on current platform
 * 
 * @return string
 */
const getBinaryName = () => {
    switch(process.platform){
        case 'darwin':
            return 'yt-dlp_macos'
        case 'linux':
            return 'yt-dlp';
        case 'win32':
            return 'yt-dlp.exe'
    }
}

/**
 * Parses current timestamp
 * 
 * @return string
 */
const getCurrentTime = () => {
    return new Date(((new Date()).setHours((new Date().getHours() + 4)))).toISOString().split('T');
}

/**
 * Array paginator function
 * @param  array  Input array
 * @param  page_size  Default page size
 * @param  page_number  Page number to paginate to
 */
const paginate = (array, page_size, page_number) => {
    return array.slice((page_number - 1) * page_size, page_number * page_size);
};

module.exports.paginate = paginate;
module.exports.getCurrentTime = getCurrentTime
module.exports.getBinaryName = getBinaryName