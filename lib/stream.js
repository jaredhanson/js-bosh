define(['./request',
        './errors/bosherror',
        './utils',
        'xml',
        'url',
        'events',
        'class',
        'debug'],
function(Request, BOSHError, utils, xml, uri, Emitter, clazz, debug) {
  debugrx = debug('bosh:rx');
  debugtx = debug('bosh:tx');
  debugtxq = debug('bosh:tx:queue');
  debugpoll = debug('bosh:poll');
  debugxmpp = debug('bosh:xmpp');
  debug = debug('bosh');
  
  // TODO:
  // - Implement support for acknowledgements.
  //   http://xmpp.org/extensions/xep-0124.html#ack
  // - Implement support for key sequencing algorithm.
  //   http://xmpp.org/extensions/xep-0124.html#keys
  // - Implement support for multiple streams over a single session.
  //   http://xmpp.org/extensions/xep-0124.html#multi
  
  var CONNECTING = 0;
  var OPEN = 1;
  var CLOSING = 2;
  var CLOSED = 3;
  
  function Stream(url, options) {
    options = options || {};
    Emitter.call(this);
    
    // TODO: Make inactivity value public
    
    this._url = url;
    this._version = options.version || '1.6';
    this._mime = options.mime || 'text/xml; charset=utf-8'
    this._lang = options.language || 'en';
    this._from = options.from;
    // TODO: Implement uri parsing to default the "to" field
    this._to = options.to;
    this._route = options.route;
    this._wait = options.wait !== undefined ? options.wait : 60;
    // NOTE: Setting hold to a value greater than 1 may cause issues if HTTP
    //       pipelining is not available.  Because there is no guarantee of
    //       support for pipelining when using XMLHttpRequest, it is not
    //       recommended to override this option.
    this._hold = options.hold !== undefined ? options.hold : 1;
    this._sid = null;
    this._rid = Math.floor(Math.random() * 4294967295);
    this._polling = null;    // polling interval
    this._inactivity = null; // inactivity period
    this._requests = 1;      // simultaneous requests limit
    this._protocol = options.protocol;
    // TODO: Default secure flag based on http or https URL
    this._secure = options.secure !== undefined ? options.secure : false;
    this.maxpause = null;
    this._inflight = [];
    this._queue = [];
    this.readyState = CONNECTING;
    
    
    this.open();
    
    // FIXME: Take this out.  testing only
    /*
    var self = this;
    setTimeout(function() {
      self.close();
    }, 10000);
    */
    
    /*
    var self = this;
    setTimeout(function() {
      //self.destroy();
      
      //self.close();
      //self._sid = 'foo';
      //self._url = 'http://bosh.metajack.im:5280/x-xmpp-httpbind';
    }, 15000);
    */
  }
  clazz.inherits(Stream, Emitter);
  
  /**
   * Open stream.
   *
   * @api protected
   */
  Stream.prototype.open = function() {
    var self = this;
    function __open(body) {
      self._sid = body.attr('sid');
      self._polling = parseInt(body.attr('polling')) || 15;
      self._inactivity = parseInt(body.attr('inactivity')) || (self._polling + 60);
      self._requests = parseInt(body.attr('requests')) || self._hold + 1;
      self._delay = self._polling * 1000;
      
      self.maxpause = parseInt(body.attr('maxpause'));
      
      debug('session created (sid: ' + self._sid  + ', polling: ' + self._polling +
                                                    ', inactivity: ' + self._inactivity +
                                                    ', requests: ' + self._requests + ')');
      
      self.readyState = OPEN;
      self.emit('open');
    }
    
    var doc = xml('body', 'http://jabber.org/protocol/httpbind', {
      ver: this._version,
      to: this._to,
      rid: this._rid,
      wait: this._wait,
      hold: this._hold,
      content: this._mime,
      secure: this._secure,
      'xml:lang': this._lang
    });
    this._rid++;
    
    if (this._route) { doc.attr('route', this._route); }
    if (this._from) { doc.attr('from', this._from); }
    if (this._protocol == 'xmpp') {
      doc.attr('xmpp:version', '1.0');
      doc.attr('xmlns:xmpp', 'urn:xmpp:xbosh');
    }
    
    this._enqueue(doc.root(), true, __open);
    this._pump();
  }
  
  Stream.prototype.poll =
  Stream.prototype.send = function(data) {
    // TODO: If data is type of string, base64 encode it and wrap it in a namespace
    // http://www.w3.org/TR/2004/PR-xop10-20041116/
    // http://www.w3.org/TR/xml-media-types/
    // what is a good namespace for this?
    // http://www.rpbourret.com/xmldbms/faqs/binary.htm
    // base64 binary or hex binary
    // http://stackoverflow.com/questions/19893/how-do-you-embed-binary-data-in-xml
    // google: encoding binary data in xml
    // http://en.wikipedia.org/wiki/Binary-to-text_encoding
    
    var payload;
    if (data && data.name && data.namespace && data.children) {
      payload = data;
    }
    
    this._enqueue(payload);
    this._pump();
  }
  
  /**
   * Close stream.
   *
   * This call will allow queued data to be sent before closing the stream.
   * The stream will emit `close` event once closed.
   *
   * @api public
   */
  Stream.prototype.close = function() {
    debug('closing stream')
    
    var self = this;
    function __close(body) {
      debug('closed stream')
      if (self.readyState == CLOSED) return;
      self.readyState = CLOSED;
      self.emit('close');
    }
    
    this.readyState = CLOSING;
    this._enqueue(null, { type: 'terminate' }, __close);
    this._pump();
  }
  
  /**
   * Destroy stream.
   *
   * The stream will not emit any more `message` events.  Any queued write data
   * will not be sent.  The stream will emit `close` event once its resources
   * have been disposed of.
   *
   * @api public
   */
  Stream.prototype.destroy = function() {
    for (var i = 0, len = this._inflight.length; i < len; i++) {
      var req = this._inflight[i];
      req.abort();
    }
    
    this._inflight = [];
    this._queue = [];
    this.readyState = CLOSED;
    this.emit('close');
  }
  
  /**
   * Temporarily pause the stream.
   *
   * This is useful in situations during which the client will be unable to send
   * requests to the connection manager (e.g., while a browser changes from one
   * web page to another).  The stream will emit `pause` event once paused.
   *
   * @param {Number} sec
   * @api public
   */
  Stream.prototype.pause = function(sec) {
    if (!sec) {
      // TODO: Treat this as a instance-level pause, temporarily halting I/O in
      //       order to mirror Node's stream interface.
      return;
    }
    
    if (!this.maxpause) throw new BOSHError('Connection manager does not support session pausing')
    
    var self = this;
    function __pause(body) {
      self.emit('pause', sec);
    }
    
    this._enqueue(null, { pause: sec }, __pause);
    this._pump();
  }
  
  /**
   * Restart XMPP stream.
   *
   * This function is used by higher-level XMPP implementations to restart an
   * XMPP stream using the BOSH binding.  Non-XMPP applications do not need to
   * call the function; its presence owes to the entaglement between XMPP and
   * BOSH generally.
   *
   * @api public
   */
  Stream.prototype.restart = function() {
    debugxmpp('restart');
    
    var doc = xml('body', 'http://jabber.org/protocol/httpbind', {
      to: this._to,
      sid: this._sid,
      rid: this._rid,
      'xml:lang': this._lang,
      'xmpp:restart': true,
      'xmlns:xmpp': 'urn:xmpp:xbosh',
    });
    this._rid++;
    
    this._enqueue(doc.root(), true);
    this._pump();
  }
  
  /**
   * Enqueue payload.
   *
   * @api private
   */
  Stream.prototype._enqueue = function(xml, attrs, cb) {
    var isBody = false;
    
    if (typeof attrs == 'function') {
      cb = init;
      attrs = undefined;
    } else if (typeof attrs == 'boolean') {
      isBody = attrs;
      options = undefined;
    }
    attrs = attrs || {};
    
    this._queue.push({ payload: xml, attrs: attrs, fn: cb, isBody: isBody });
    debugtxq('queued payload (queue: ' + this._queue.length + ', inflight: ' + this._inflight.length + ')');
  }
  
  /**
   * Pump stream.
   *
   * Pumping a stream causes any queued payloads to be transmitted, subject to
   * throttling parameters negotiated between the client and server.
   *
   * @api private
   */
  Stream.prototype._pump = function() {
    // No payloads to send.
    if (this._queue.length == 0) { return; }
    // Met simultaneous request limit.  Wait until response is received.
    if (this._inflight.length >= this._requests) { return; }
    
    var self = this
      , qi = this._queue.shift()
      , fn = qi.fn
      , attrs = {}
      , body;
      
    if (qi.isBody) {
      body = qi.payload;
    } else {
      var payload = [ qi.payload ];
      utils.merge(attrs, qi.attrs);
      
      while (this._queue.length) {
        // In order to unambiguously execute a payload's callback, only the first
        // payload that requires special handling will be included in a
        // multi-payload body.
        if (fn) break;
        // Peek the next item.  If it is a complete request body, it will be sent
        // as the next request.
        if (this._queue[0].isBody) break;
        
        qi = this._queue.shift();
        fn = qi.fn;
        payload.push(qi.payload);
        utils.merge(attrs, qi.attrs);
      }
      
      body = this._createBody(payload, attrs)
    }
    
    var req = new Request(this._url, body, fn);
    req.on('end', function() {
      if (req != self._inflight[0]) {
        // An out-of-order response was received.  Return immediately, leaving
        // the request in the in-flight queue.  Once the preceeding request(s)
        // complete, all completed requests in the queue will be processed in
        // order.
        debugrx('out of order response (rid: ' + req.rid + ')');
        return;
      }
      
      var r,
          pollok;
      while (self._inflight.length && self._inflight[0].condition == 'ok') {
        r = self._inflight.shift();
        pollok = self._complete(req);
        
        debugtx('request complete (rid: ' + r.rid + ')');
        debugtxq('  (inflight: ' + self._inflight.length + ', queue:' +  self._queue.length + ')');
      }
      
      if (self._inflight.length && self._inflight[0].type == 'terminate') {
        r = self._inflight.shift();
        if (r.condition == 'ok') {
          debug('remote closed stream')
          if (self.readyState == CLOSED) return;
          self.readyState = CLOSED;
          self.emit('close');
        } else {
          debug('terminate: ' + r.condition);
          self.readyState = CLOSED;
          self.emit('error', new BOSHError('Stream terminated', r.condition));
        }
        return;
      }
      
      if (self._inflight.length && self._inflight[0].type == 'error') {
        // TODO: These errors are recoverable by retrying the failed request.
        //       Support for this should be implemented.  For now, just consider
        //       the stream to have failed.
        //       http://xmpp.org/extensions/xep-0124.html#errorstatus-recover
        self.readyState = CLOSED;
        self.emit('error', new BOSHError('Recoverable condition unhandled'));
      }
      
      
      if (self.readyState == OPEN && self._queue.length == 0 && self._inflight.length == 0) {
        // If there's no queued data and no inflight request, poll the connection
        // manager with an empty request.  This allows the connection manager to
        // hold a request, to which it can immediately push incoming data.
        //
        // See Section 10. Inactivity for further details:
        // http://xmpp.org/extensions/xep-0124.html#inactive
        
        if (self._requests > 1) {
          self.poll();
        } else {
          // Polling session.  We cannot send consequtive empty requests in
          // which no payloads are received in response.  If the just completed
          // request was not empty, or its response was not empty, we can
          // immediately send a new request.  Otherwise, we must wait for the
          // interval to elapse.
          //
          // See Section 12. Polling Sessions for further details:
          // http://xmpp.org/extensions/xep-0124.html#poll
          
          if (pollok) {
            self.poll();
          } else {
            debugpoll('scheduling poll request');
            setTimeout(function() {
              debugpoll('sending poll request');
              self.poll();
            }, self._delay);
          }
        }
      }
      
      if (self.readyState == OPEN) self._pump();
    });
    req.on('error', function(err) {
      debug('error: ' + err);
      self.writable = false;
      self.readyState = CLOSED;
      self.emit('error', err);
    });
    
    debugtx('sending request (rid: ' + req.rid + ')');
    this._inflight.push(req);
    req.send();
  }
  
  /**
   * Create BOSH body element with `els` as payload and `attrs`.
   *
   * @api private
   */
  Stream.prototype._createBody = function(els, attrs) {
    var doc = xml('body', 'http://jabber.org/protocol/httpbind', {
      sid: this._sid,
      rid: this._rid
    });
    this._rid++;
    
    if (attrs.type) { doc.attr('type', attrs.type); }
    if (attrs.pause) { doc.attr('pause', attrs.pause); }
    
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el) {
        doc.c(el).up();
      }
    }
    
    return doc.root();
  }
  
  Stream.prototype._complete = function(req) {
    var fn = req.fn
      , body = req.response;
    
    fn && fn(body);
    
    var payloads = body.children()
      , payload;
    for (var i = 0, len = payloads.length; i < len; i++) {
      payload = payloads[i];
      this.emit('message', payload);
    }
    
    // `true` if ok to poll again, `false` otherwise
    // (only applicable to polling sessions)
    return (req.plength || payloads.length);
  }
  
  return Stream;
});
