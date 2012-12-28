/**
 * bosh
 *
 * This module support for BOSH streams, which emulate the semantics of TCP
 * connections using multiple HTTP request/response pairs without frequent
 * polling.
 *
 * References:
 *  - [XEP-0124](http://xmpp.org/extensions/xep-0124.html)
 *  - [XEP-0206](http://xmpp.org/extensions/xep-0206.html)
 */
define(['exports',
        './lib/stream'],
function(exports, Stream) {
  
  function createStream(url, options, cb) {
    if (typeof options == 'function') {
      cb = options;
      options = {};
    }
    
    var s = new Stream(url, options);
    if (cb) s.on('open', cb);
    return s;
  }
  
  exports.createStream = createStream;
  exports.Stream = Stream;
});
