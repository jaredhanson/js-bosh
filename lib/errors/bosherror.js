define(function() {

  function BOSHError(message, condition) {
    this.name = 'BOSHError';
    this.message = message || 'BOSH error';
    this.condition = condition;
  }
  BOSHError.prototype = new Error();
  BOSHError.prototype.constructor = BOSHError;

  return BOSHError;
});
