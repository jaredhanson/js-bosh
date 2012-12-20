require.config({
  paths: {
    'class': '../vendor/class',
    'mocha': 'vendor/mocha/mocha',
    'chai': 'vendor/chai/chai'
  },
  packages: [
    { name: 'events', location: '../vendor/events' },
    { name: 'ajax', location: '../vendor/ajax' },
    { name: 'bosh', location: '..' },
  ]
});

require(['require',
         'mocha',
         'chai'],
function(require, _mocha, _chai) {
  mocha.setup('bdd');

  require(['./suite'],
  function() {
    mocha.run();
  });
});
