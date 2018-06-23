/**
 * Generic handler that loads appropriate integration handler
 */

module.exports = (function(){

  return require('./integrations/' + process.env.INTEGRATION + '/handler');

})();