const process = require('process');

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

module.exports.getBinaryName = getBinaryName