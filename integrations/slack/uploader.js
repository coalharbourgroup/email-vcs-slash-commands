/**
 * Slack Upload Integration
 */
const request = require('request');

module.exports = (function(){

  const uploader = {

    request: request,

    /**
     * Upload a PDF to Slack
     *
     * @param {String} channel
     * @param {String} filename
     * @param {fs.ReadStream} PDF ReadStream
     * @return {Object} response
     */
    uploadPdf: function(channel, filename, fileContents) {

      return new Promise(function(resolve, reject){

        uploader.request.post({
          url: 'https://slack.com/api/files.upload',
          formData: {
              token: process.env.CHAT_ACCESS_TOKEN,
              filename: filename,
              filetype: 'pdf',
              channels: channel,
              file: fileContents
          }
        }, function (err, response) {

          if (err) {
            return reject(err);
          }

          return resolve(JSON.parse(response.body));

        });

      });

    }

  };

  return uploader;

})();