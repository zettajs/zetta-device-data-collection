var EventEmitter = require('events').EventEmitter;

var StatsCollector = module.exports = function() {
  this.emitter = new EventEmitter();
  this.server = null;
};

StatsCollector.prototype.on = function() {
  this.emitter.on.apply(this.emitter, arguments);
};

StatsCollector.prototype.collect = function() {
  return this._collect.bind(this);
};
StatsCollector.prototype._collect = function(server) {
  var self = this;
  this.server = server;

  var servers = []; // keep a list of peers subscribed to, to filter duplicates
  server.pubsub.subscribe('_peer/connect', function(e, msg) {
    if (servers.indexOf(msg.peer.name) > -1) {
      return;
    }
    servers.push(msg.peer.name); // _peer/connect is called on reconnect, must filter

    var query = server.from(msg.peer.name).ql('where type is not missing');
    server.observe(query, function(device) {
      Object.keys(device.streams).forEach(function(name) {

        if (name === 'logs') {
          return;
        }
        
        var stream = device.createReadStream(name);
        stream.on('readable', function() {
          var chunk;
          while (null !== (chunk = stream.read())) {

            var data = {
              name: 'devicedata.' + device.type + '.' + name,
              timestamp: chunk.timestamp,
              value: chunk.data,
              tags: {
                hub: msg.peer.name,
                device: device.id,
                deviceType: device.type,
                stream: name
              }
            };

            var filteredHeaders = ['connection', 'upgrade', 'sec-websocket-key', 'authorization', 'sec-websocket-version'];
            Object.keys(msg.peer.ws.upgradeReq.headers).forEach(function(header) {
              if (filteredHeaders.indexOf(header) === -1) {
                data.tags['req-header-' + header] = msg.peer.ws.upgradeReq.headers[header];
              }
            });

            self.emitter.emit('event', data);
          }
        });
      });
    });
  });
};
