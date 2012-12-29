define(['./errors/bosherror',
        'xml',
        'ajax',
        'events',
        'class',
        'debug'],
function(BOSHError, xml, ajax, Emitter, clazz, debug) {
  debugrxd = debug('bosh:rx:data');
  debugtxd = debug('bosh:tx:data');
  
  function Request(url, body, fn) {
    Emitter.call(this);
    this.rid = body.attr('rid');
    this.payloadCount = body.children().length;
    this.fn = fn;
    this.type = undefined;
    this.condition = undefined;
    this.response = undefined;
    
    this._url = url;
    this._data = body.toString();
    this._req = null;
  }
  clazz.inherits(Request, Emitter);
  
  // TODO: Set content-type to text/xml; charset=utf-8 on Ajax requests
  
  Request.prototype.send = function() {
    var self = this
      , req = ajax.request(this._url, 'POST');
    
    this._req = req;
      
    req.on('response', function(res) {
      res.on('end', function() {
        debugrxd('status: ' + res.statusCode);
        debugrxd(res.responseText);
        
        if (res.statusCode == 200) {
          var body;
          try {
            body = self.response = xml(res.responseXML);
          } catch(err) {
            self.emit('error', err);
            return;
          }
          
          if (!body.is('body', 'http://jabber.org/protocol/httpbind')) {
            self.emit('error', new BOSHError('Bad protocol'));
            return;
          }
          
          self.type = body.attr('type');
          self.condition = body.attr('condition') || 'ok';
          self.emit('end');
        } else {
          var cond = 'internal-server-error';
          switch (res.statusCode) {
            case 400:
              cond = 'bad-request';
              break;
            case 403:
              cond = 'policy-violation';
              break;
            case 404:
              cond = 'item-not-found';
              break;
          }
          
          self.type = 'terminate';
          self.condition = cond;
          self.emit('end');
        }
      });
      res.on('error', function(err) {
        self.emit('error', err);
      });
    });
    req.on('error', function(err) {
      self.emit('error', err);
    });
    
    debugtxd(this._data);
    req.send(this._data);
  }
  
  Request.prototype.abort = function() {
    this._req.abort();
  }
  
  return Request;
});
