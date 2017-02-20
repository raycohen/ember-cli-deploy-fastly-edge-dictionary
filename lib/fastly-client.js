var CoreObject = require('core-object');
var Promise = require('ember-cli/lib/ext/promise');
var denodify = require('rsvp').denodify;
var request = require('request');

module.exports = CoreObject.extend({
  init: function(options) {
    this._super.apply(this, arguments);
    this._options = options;
    this._request = request.defaults({
      baseUrl: options.baseUrl || 'https://api.fastly.com/',
      headers: {
        'Fastly-Key': options.fastlyAPIKey
      }
    });
  },

  insert: function(itemKey, itemValue) {
    var serviceId = this._options.serviceId;
    var dictionaryId = this._options.dictionaryId;

    var put = denodify(this._request.put);

    return put({
      body: 'item_value=' + itemValue,
      headers: {},
      uri: '/service/'+ serviceId + '/dictionary/' + dictionaryId + '/item/' + itemKey
    });
  }
});
