# BOSH

This module implements [BOSH](http://xmpp.org/extensions/xep-0124.html) streams,
which emulate the semantics of TCP connections using multiple HTTP
request/response pairs and long polling techniques.

## Install

##### volo

    $ volo add jaredhanson/js-bosh bosh

For more information on using volo to manage JavaScript modules, visit [http://volojs.org/](http://volojs.org/).

## Usage

Create a BOSH stream.

```javascript
var stream = bosh.createStream('http://127.0.0.1:5280/http-bind', {
  to: 'jabber.org',
  protocol: 'xmpp'
});
```

Send XML payloads.

```javascript
var message = xml('message', { to: 'romeo@example.net' })
                .c('body').t('Art thou not Romeo, and a Montague?').root();
stream.send(m);
```

Process incoming XML payloads.

```javascript
stream.on('message', function(stanza) {
  // process stanza
});
```

## Compatibility

##### Browser

This module is [AMD](https://github.com/amdjs/amdjs-api)-compliant, and can be
loaded by module loaders such as [RequireJS](http://requirejs.org/).

This module is optimized for use with [Anchor](https://github.com/anchorjs/anchor).

## Tests

##### Browser

To run tests in a browser, execute the Make target for the desired browser:

    $ make test-chrome
    $ make test-firefox
    $ make test-safari

##### PhantomJS

To run headless tests from a terminal using [PhantomJS](http://phantomjs.org/):

    $ make test-phantomjs
    
##### Status

[![Travis CI](https://secure.travis-ci.org/jaredhanson/js-sasl.png)](http://travis-ci.org/jaredhanson/js-sasl)

## Credits

  - [Jared Hanson](http://github.com/jaredhanson)

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2012 Jared Hanson <[http://jaredhanson.net/](http://jaredhanson.net/)>
