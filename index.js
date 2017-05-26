/* jshint node: true */
'use strict';

var RSVP = require('rsvp');
var path = require('path');
var fs = require('fs');
var request = require('request');

// denodify wraps a node-style callback function so it returns a promise
var denodeify = require('rsvp').denodeify;
var readFile = denodeify(fs.readFile);

var DeployPluginBase = require('ember-cli-deploy-plugin');

function readFileContents(path) {
  return readFile(path)
    .then(function(buffer) {
      return buffer.toString();
    });
}

module.exports = {
  name: 'ember-cli-deploy-fastly-edge-dictionary',

  createDeployPlugin: function(options) {
    var FastlyClient = require('./lib/fastly-client');

    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      defaultConfig: {
        filePattern: 'index.html',
        maxRecentUploads: 10,
        distDir: function(context) {
          return context.distDir;
        },
        keyPrefix: function(context){
          return context.project.name() + ':index';
        },
        activationSuffix: 'current',
        activeContentSuffix: 'current-content',
        didDeployMessage: function(context) {
          var revisionKey = context.revisionData && context.revisionData.revisionKey;
          var activatedRevisionKey = context.revisionData && context.revisionData.activatedRevisionKey;
          if (revisionKey && !activatedRevisionKey) {
            return "Deployed but did not activate revision " + revisionKey + ". "
                 + "To activate, run: "
                 + "ember deploy:activate " + context.deployTarget + " --revision=" + revisionKey + "\n";
          }
        },
        revisionKey: function(context) {
          return context.commandOptions.revision || (context.revisionData && context.revisionData.revisionKey);
        },
        revisionData: function(context) {
          return context.revisionData;
        },
        fastlyConfigVersion: function(context, pluginHelper) {
          return pluginHelper.readConfig('fastlyClient').getCurrentVersion();
        },
        fastlyClient: function(context, pluginHelper) {
          var options = {
            dictionaryName: pluginHelper.readConfig('dictionaryName'),
            fastlyAPIKey: pluginHelper.readConfig('fastlyAPIKey'),
            serviceId: pluginHelper.readConfig('serviceId')
          };

          return new FastlyClient(options);
        }
      },

      upload: function(context) {
        var revisionKey       = this.readConfig('revisionKey');
        var distDir           = this.readConfig('distDir');
        var filePattern       = this.readConfig('filePattern');
        var keyPrefix         = this.readConfig('keyPrefix');
        var maxRecentUploads  = this.readConfig('maxRecentUploads');
        var filePath          = path.join(distDir, filePattern);
        var dictionaryName    = this.readConfig('dictionaryName');
        var _this = this;

        this.log('Inserting `' + filePath + '` into fastly edge dictionary key ' + keyPrefix, { verbose: true });

        return readFileContents(filePath)
          //.then(redisDeployClient.upload.bind(redisDeployClient, keyPrefix, revisionKey, this.readConfig('revisionData')))
          .then(function(fileContents) {
            return _this._insertIntoEdgeDictionary(fileContents, keyPrefix, revisionKey, _this.readConfig('revisionData'))
          }).then(function() {
            return _this._uploadSuccessMessage(keyPrefix);
          }).then(function(key) {
            return { redisKey: key };
          })
          .catch(this._errorMessage.bind(this));
      },

      _insertIntoEdgeDictionary: function(fileContents, keyPrefix, revisionKey, revisionData) {
        var fastlyClient = this.readConfig('fastlyClient');

        return fastlyClient.upload(keyPrefix, fileContents).then(function(key) {
          return fastlyClient.upload(keyPrefix + ':' + revisionKey, fileContents);
        });
      },

      _uploadSuccessMessage: function(key) {
        this.log('Inserted into fastly edge dictionary with key `' + key + '`', { verbose: true });
        return RSVP.Promise.resolve(key);
      },

      _errorMessage: function(error) {
        this.log(error, { color: 'red' });
        return RSVP.Promise.reject(error);
      }
    });

    //return new DeployPlugin();
    return new DeployPlugin();
  }
};
