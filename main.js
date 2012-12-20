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
});
