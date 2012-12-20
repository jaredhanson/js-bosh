define(['bosh',
        'chai'],
function(bosh, chai) {
  var expect = chai.expect;

  describe("bosh", function() {

    it('shoud export createSession', function() {
      expect(bosh.createSession).to.exist;
      expect(bosh.createSession).to.be.a('function');
    });

  });

  return { name: "test.bosh" }
});
