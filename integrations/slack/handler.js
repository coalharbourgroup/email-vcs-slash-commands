/**
 * Slack Command Integration for generating PDFs of templates
 */
const debug = process.env.DEBUG === 'true';
const queryString = require('query-string');
const aws = require('aws-sdk');

module.exports = (function(){

  const command = {

    lambda: new aws.Lambda({
      region: process.env.PROCESS_LAMBDA_REGION
    }),

    /**
     * Process a command via invoking process Lambda function
     *
     * @param {String} action
     * @param {String} templateName
     * @param {String} channelId
     * @return {Array} files
     */
    process: function(action, templateName='', channelId) {

      return new Promise(function(resolve, reject){

        command.lambda.invoke({
          FunctionName: process.env.PROCESS_LAMBDA_NAME,
          InvocationType: 'Event',
          Payload: JSON.stringify({
            body: {
              action: action,
              template_name: templateName,
              channel_id: channelId,
              token: process.env.PROCESS_ACCESS_TOKEN
            }
          })
        }, function(err, response) {

          if (typeof err !== 'undefined') {
            return reject(err);
          }

          return resolve(response);

        });

      });

    },

    /**
     * Handle a command request
     *
     * @param {Object} event
     * @param {Object} context
     * @param {Function} callback
     * @return {Function} callback
     */
    handler: async function(event, context, callback){

      let upload = {ok: false};
      let successMsg = '';
      const body = (function(event){
        if (typeof event.body === 'string') {
          try {
            return JSON.parse(event.body);
          }
          catch(e) {
            return queryString.parse(event.body);
          }
        }
        return event.body;
      })(event);
      const token = process.env.CHAT_COMMAND_TOKEN;
      const user = body.user_name;
      const channelName = body.channel_name;
      const channelId = body.channel_id;
      const commandText = body.text;
      const args = body.text.split(' ');
      const helpText = `Unrecognized parameters.  You can use the following commands:

        ${body.command} template {template-name}

        ${body.command} compare {template-name}

        ${body.command} all
      `;

      if (typeof token !== 'string') {
        const errMsg = 'Must provide a \'CHAT_COMMAND_TOKEN\' env variable';
        return callback(null, {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: errMsg
          })
        });
      }

      if (body.token !== token) {
          const errMsg = 'Invalid request token';
          return callback(null, {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: errMsg
            })
          });
      }


      if (args[0] === 'template' || args[0] === 'compare' || args[0] === 'all') {

        //call process webhook
        command.process(args[0], args[1], channelId);

        //return a message to slack
        return callback(null, {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Generating PDF...'
          })
        });

      }

      //fail
      return callback(null, {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: helpText
        })
      });


    }

  };

  return command;

})();