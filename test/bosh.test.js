define(['bosh'],
function(bosh) {
  
  describe("bosh", function() {

    it('should export createStream', function() {
      expect(bosh.createStream).to.exist;
      expect(bosh.createStream).to.be.a('function');
    });

  });

  return { name: "test.bosh" }
});
