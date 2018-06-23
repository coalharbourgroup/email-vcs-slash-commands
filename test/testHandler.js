delete require.cache;
require('dotenv').config();
const debug = process.env.DEBUG === 'true';
const assert = require('assert');
const handler = require('../handler.js');


describe('handler.js', function() {

  it('loads the handler', async function() {

    assert.equal(typeof handler.process === 'function', 1);
    assert.equal(typeof handler.handler === 'function', 1);

  });

});