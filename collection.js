var EventEmitter = require('events').EventEmitter;
var url = require('url');
var util = require('util');
var rels = require('zetta-rels');

var EXCLUDED_EVENTS = [
    /^_peer\/.+/, // peer events
    /^logs$/ // logs topic is emitted for stdout on device transitions
];

var StatsCollector = module.exports = function(options) {
  options = options || {};
  this.includeServerEvents = !!(options.includeServerEvents);
  
  EventEmitter.call(this);
};
util.inherits(StatsCollector, EventEmitter);

StatsCollector.prototype.collect = function() {
  return this._collect.bind(this);
};

StatsCollector.prototype._collect = function(runtime) {
  var self = this;

  var peers = [];
  runtime.pubsub.subscribe('_peer/connect', function(ev, msg) {
    if (peers.indexOf(msg.peer.name) < 0) {
      msg.peer.subscribe('**');
      msg.peer.on('zetta-events', function(topic, data) {
        if (!self.includeServerEvents) {
          var found = EXCLUDED_EVENTS.some(function(regex) {
            return regex.test(topic);
          });
          
          if (found) {
            return;
          }
        }

        self.emit('event', data);
      });
      
      peers.push(msg.peer.name);
    }
  });
};
