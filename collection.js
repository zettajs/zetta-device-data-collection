var EventEmitter = require('events').EventEmitter;
var url = require('url');
var util = require('util');
var rels = require('zetta-rels');

var EXCLUDED_EVENTS = [
    /^_peer\/.+/, // peer events
    /^logs$/ // logs topic is emitted for stdout on device transitions
];

var FILTERED_HEADERS = [
  'connection',
  'upgrade',
  'sec-websocket-key',
  'authorization',
  'sec-websocket-version'
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


        var split = data.topic.split('/');

        // Only publish device data events that conform to {type}/{id}/{stream}
        if (split.length === 3) {
          var formatedData = {
            name: 'devicedata.' + split[0] + '.' + split[2],
            timestamp: data.timestamp,
            value: data.data,
            tags: {
              hub: msg.peer.name,
              device: split[1],
              deviceType: split[1],
              stream: split[2]
            }
          };

          Object.keys(msg.peer.ws.upgradeReq.headers).forEach(function(header) {
            if (FILTERED_HEADERS.indexOf(header) === -1) {
              formatedData.tags['req-header-' + header] = msg.peer.ws.upgradeReq.headers[header];
            }
          });
          
          self.emit('event', formatedData);
        } else {
          return;
        }
      });
      
      peers.push(msg.peer.name);
    }
  });
};
