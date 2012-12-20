require.config({
  paths: {
    'class': '../../vendor/class',
    'mocha': '../vendor/mocha/mocha',
    'chai': '../vendor/chai/chai'
  },
  packages: [
    { name: 'events', location: '../../vendor/events' },
    { name: 'ajax', location: '../../vendor/ajax' },
    { name: 'bosh', location: '../..' },
    { name: 'phantomjs-mocha', location: '../vendor/phantomjs-mocha' },
  ]
});

require(['require',
         'mocha',
         'chai',
         'phantomjs-mocha/reporter'],
function(require, _mocha, _chai, Reporter) {
  mocha.setup({ ui: 'bdd', reporter: Reporter });

  require(['../suite'],
  function() {
    mocha.run();
  });
});
