delete require.cache;
require('dotenv').config();
const debug = process.env.DEBUG === 'true';
const command = require('../../../integrations/slack/handler.js');
const assert = require('assert');
const fs = require('fs');

describe('integrations/slack/handler.js', function() {

  describe('#process', function() {
    it('calls process lambda', async function() {

      //overload lambda invoke for processing
      const invoke = command.lambda.invoke;
      command.lambda.invoke = function(data, callback){
        callback(undefined, data);
      };

      const expectedLambdaInvocation = {
        FunctionName: process.env.PROCESS_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({
          body: {
            action: 'test',
            template_name: 'template',
            channel_id: 'channel',
            token: process.env.PROCESS_ACCESS_TOKEN
          }
        })
      }

      const response = await command.process('test', 'template', 'channel');

      //verify
      assert.deepEqual(response, expectedLambdaInvocation);

      //cleanup
      command.lambda.invoke = invoke;

    });
  });

  describe('#handler', async function() {

    it('fails without a slack token', async function() {

      let event = require('./mocks/slackCommandTemplateEvent.json');
      const CHAT_COMMAND_TOKEN = process.env.CHAT_COMMAND_TOKEN;
      delete process.env.CHAT_COMMAND_TOKEN;

      await command.handler(event, {}, async function(e, response){

        assert.equal(response.body, JSON.stringify({text: 'Must provide a \'CHAT_COMMAND_TOKEN\' env variable'}));

      });

      //cleanup
      process.env.CHAT_COMMAND_TOKEN = CHAT_COMMAND_TOKEN;

    });

    it('fails with an invalid slack token', async function() {

      let event = require('./mocks/slackCommandTemplateEvent.json');
      const CHAT_COMMAND_TOKEN = process.env.CHAT_COMMAND_TOKEN;
      process.env.CHAT_COMMAND_TOKEN = 'invalidToken';

      await command.handler(event, {}, async function(e, response){

        assert.equal(response.body, JSON.stringify({text: 'Invalid request token'}));

      });

      //cleanup
      process.env.CHAT_COMMAND_TOKEN = CHAT_COMMAND_TOKEN;

    });

    it('returns help text when no command arg is sent', async function() {

      const event = require('./mocks/slackCommandTemplateEvent.json');
      event.body.text = '';
      const expectedText = `Unrecognized parameters.  You can use the following commands:

        /email template {template-name}

        /email compare {template-name}

        /email all
      `;
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: expectedText})
      };

      await command.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

    });

    it('returns help text when invalid command arg is sent', async function() {

      const event = require('./mocks/slackCommandTemplateEvent.json');
      event.body.text = 'unknownAction';
      const expectedText = `Unrecognized parameters.  You can use the following commands:

        /email template {template-name}

        /email compare {template-name}

        /email all
      `;
      const expectedResponse = {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({text: expectedText})
      };

      await command.handler(event, {}, async function(e, response){

        //verify
        assert.deepEqual(response, expectedResponse);

      });

    });

    it('calls process webhook with template action for template event', async function() {

      const event = require('./mocks/slackCommandTemplateEvent.json');
      const expectedLambdaInvocation = {
        FunctionName: process.env.PROCESS_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({
          body: {
            action: 'template',
            templateName: 'test-template',
            channelId: 'C2147483705',
            token: process.env.PROCESS_ACCESS_TOKEN
          }
        })
      }

      //overload lambda invoke for processing
      const invoke = command.lambda.invoke;
      command.lambda.invoke = function(data, callback){

        //verify
        assert.deepEqual(data, expectedLambdaInvocation);
        callback(undefined, data);

      };

      await command.handler(event, {}, function(){});

      //cleanup
      command.lambda.invoke = invoke;

    });

    it('calls process webhook with compare action for compare event', async function() {

      const event = require('./mocks/slackCommandTemplateCompareEvent.json');
      const expectedLambdaInvocation = {
        FunctionName: process.env.PROCESS_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({
          body: {
            action: 'compare',
            template_name: 'test-template',
            channel_id: 'C2147483705',
            token: process.env.PROCESS_ACCESS_TOKEN
          }
        })
      }


      //overload lambda invoke for processing
      const invoke = command.lambda.invoke;
      command.lambda.invoke = function(data, callback){

        //verify
        assert.deepEqual(data, expectedLambdaInvocation);
        callback(undefined, data);

      };

      await command.handler(event, {}, function(){});

      //cleanup
      command.lambda.invoke = invoke;

    });

    it('calls process webhook with all action for all templates event', async function() {

      const event = require('./mocks/slackCommandTemplateAllEvent.json');
      const expectedLambdaInvocation = {
        FunctionName: process.env.PROCESS_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({
          body: {
            action: 'all',
            template_name: '',
            channel_id: 'C2147483705',
            token: process.env.PROCESS_ACCESS_TOKEN
          }
        })
      }

      //overload lambda invoke for processing
      const invoke = command.lambda.invoke;
      command.lambda.invoke = function(data, callback){

        //verify
        assert.deepEqual(data, expectedLambdaInvocation);
        callback(undefined, data);

      };

      await command.handler(event, {}, function(){});

      //cleanup
      command.lambda.invoke = invoke;

    });

  });

});