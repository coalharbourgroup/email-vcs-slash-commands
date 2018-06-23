delete require.cache;
require('dotenv').config();
const debug = process.env.DEBUG === 'true';
const assert = require('assert');
const uploader = require('../../../integrations/slack/uploader.js');


describe('integrations/slack/uploader.js', function() {

  it('uploads a pdf', async function() {

    //overload request.post for slack uploads
    const requestPost = uploader.request.post;
    uploader.request.post = function(data, callback){
      callback(null, {body: '{"ok": true}'});
    };

    const expectedResponse = {
      ok: true
    };

    const response = await uploader.uploadPdf();

    //verify
    assert.deepEqual(response, expectedResponse);

    //cleanup
    uploader.request.post = requestPost;

  });

  it('rejects on failure to upload a pdf', async function() {

    //overload request.post for slack uploads
    const requestPost = uploader.request.post;
    uploader.request.post = function(data, callback){
      callback('fail');
    };

    const expectedError = 'fail';

    try {
      const response = await uploader.uploadPdf();
    }
    catch(e) {
      //verify
      assert.equal(e, expectedError);
    }

    //cleanup
    uploader.request.post = requestPost;

  });

});