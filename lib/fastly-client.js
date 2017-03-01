var CoreObject = require('core-object');
var Promise = require('ember-cli/lib/ext/promise');
var denodeify = require('rsvp').denodeify;
var request = require('request');

module.exports = CoreObject.extend({
  init: function(options) {
    this._super.apply(this, arguments);
    this._options = options;
    this._request = request.defaults({
      baseUrl: options.baseUrl || 'https://api.fastly.com/',
      headers: {
        'Accept': 'application/json',
        'Fastly-Key': options.fastlyAPIKey
      }
    });
  },

  // resolves a promise with the integer number of the active version
  getActiveVersionNumber: function() {
    var get = denodeify(this._request.get);

    var serviceId = this._options.serviceId;
    return get('/service/' + serviceId + '/version').then(function(response) {
      var results = JSON.parse(response.body);
      var activeResult = results.find(function(result) {
        return !!result.active;
      });

      return activeResult.number;
    });
  },

  upload: function(itemKey, itemValue, versionNumber, keyPrefix, revisionData) {
    var serviceId = this._options.serviceId;
    var dictionaryName = this._options.dictionaryName;

    var put = denodeify(this._request.put);
    var self = this;

    return this.getActiveVersionNumber().then(function(versionNumber) {
      return self.getDictionaryId(dictionaryName, versionNumber);
    }).then(function(dictionaryId) {
      return put({
        form: 'item_value=' + itemValue,
        uri: '/service/'+ serviceId + '/dictionary/' + dictionaryId + '/item/' + itemKey
      });
    }).then(function(response) {
      return itemKey;
    });
  },

  getDictionaryId: function(dictionaryName, versionNumber) {
    var serviceId = this._options.serviceId;

    var get = denodeify(this._request.get);
    var url = '/service/'+ serviceId + '/version/' + versionNumber + '/dictionary/' + dictionaryName;

    return get(url).then(function(response) {
      if (response.statusCode == 404) {
        throw new Error(
          "No database named " + dictionaryName + " found for service " + serviceId + " version " + versionNumber
        );
      } else if (response.statusCode >= 400) {
        throw new Error("getDictionaryId failed with status code " + response.statusCode);
      }

      return JSON.parse(response.body).id;
    });
  }
});
