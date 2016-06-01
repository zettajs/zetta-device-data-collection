var EventEmitter = require('events').EventEmitter;
var url = require('url');
var util = require('util');
var rels = require('zetta-rels');

var StatsCollector = module.exports = function() {
  EventEmitter.call(this);
};
util.inherits(StatsCollector, EventEmitter);

StatsCollector.prototype.collect = function() {
  return this._collect.bind(this);
};

StatsCollector.prototype._collect = function(runtime) {
  var self = this;

  runtime.pubsub.subscribe('_peer/connect', function(ev, msg) {
    var topic = 'query:collector+' + msg.peer.name + '/where type is not missing';

    if (Object.keys(msg.peer.subscriptions).indexOf(encodeURIComponent(topic)) !== -1) {
      return;
    }

    msg.peer.on(topic, function(device) {
      var links = device.links.filter(function(link) {
        if (link.rel.indexOf(rels.objectStream) !== -1
          || link.rel.indexOf(rels.binaryStream) !== -1) {
          return link;
        }
      });

      if (links.length === 0) {
        return;
      }

      var topics = links.map(function(link) {
        var querystring = url.parse(link.href, true);
        return querystring.query.topic;
      });

      if (topics.length === 0) {
        return;
      }

      topics.forEach(function(topic) {
        if (Object.keys(msg.peer.subscriptions).indexOf(topic) !== -1) {
          return;
        }

        msg.peer.on(topic, function(deviceMessage) {
          self.emit('event', deviceMessage);
        });
        msg.peer.subscribe(topic);
      });
    });
    msg.peer.subscribe(encodeURIComponent(topic));
  });
};
