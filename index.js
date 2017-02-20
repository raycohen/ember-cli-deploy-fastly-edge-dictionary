/* jshint node: true */
'use strict';

var Promise = require('ember-cli/lib/ext/promise');
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
    debugger;
    var FastlyClient = require('./lib/fastly-client');

    var DeployPlugin = DeployPluginBase.extend({
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
        didDeployMessage: function(context){
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
        fastlyClient: function(context, pluginHelper) {
          var options = {
            dictionaryId: pluginHelper.readConfig('dictionaryId'),
            fastlyAPIKey: pluginHelper.readConfig('fastlyAPIKey'),
            serviceId: pluginHelper.readConfig('serviceId')
          };

          return new FastlyClient(options);
        }
      },

      configure: function(context) {
        throw new Error('config failed!');
        // TODO make sure we have service id, api key, and dictionary name
      },

      upload: function(context) {
        throw new Error('upload failed!');
        var revisionKey       = this.readConfig('revisionKey');
        var distDir           = this.readConfig('distDir');
        var filePattern       = this.readConfig('filePattern');
        var keyPrefix         = this.readConfig('keyPrefix');
        var maxRecentUploads  = this.readConfig('maxRecentUploads');
        var filePath          = path.join(distDir, filePattern);
        var dictionaryName    = this.readConfig('dictionaryName');

        this.log('Inserting `' + filePath + '` into fastly edge dictionary', { verbose: true });

        return readFileContents(filePath)
          //.then(redisDeployClient.upload.bind(redisDeployClient, keyPrefix, revisionKey, this.readConfig('revisionData')))
          .then(function(fileContents) {
            return this._insertIntoEdgeDictionary.bind(this, fileContents, keyPrefix, revisionKey, this.readConfig('revisionData'))
          }).then(this._uploadSuccessMessage.bind(this))
          .then(function(key) {
            return { redisKey: key };
          })
          .catch(this._errorMessage.bind(this));
      },

      _insertIntoEdgeDictionary: function(fileContents, key, revisionKey, revisionData) {
        var fastlyClient = this.readConfig('fastlyClient');
        return fastlyClient.insert(key, fileContents);
      },

      _uploadSuccessMessage: function(key) {
        this.log('Inserted into fastly edge dictionary with key `' + key + '`', { verbose: true });
        return Promise.resolve(key);
      },

      _errorMessage: function(error) {
        this.log(error, { color: 'red' });
        return Promise.reject(error);
      }
    });

    //return new DeployPlugin();
    return new DeployPlugin();
  }
};
