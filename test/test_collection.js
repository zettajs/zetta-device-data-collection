var assert = require('assert');
var zetta = require('zetta');
var zettacluster = require('zetta-cluster');

var Photocell = require('zetta-photocell-mock-driver');
var StatsCollector = require('../');

describe('StatsCollector', function() {
  
  it('receives data from devices', function(done) {
    var collector = new StatsCollector();

    var cluster = zettacluster({ zetta: zetta })
      .server('cloud', [collector.collect()])
      .server('test1', [Photocell], ['cloud']);

    cluster.on('ready', function() {
      collector.once('event', function(msg) {
        assert(!!msg.data);
        cluster.stop();
        setTimeout(done, 10);
      });
    });

    cluster.run(function(err) {
      if (err) {
        done(err);
      }
    });
  });

  it('only stores one query subscription per stream per peer', function(done) {
    var collector = new StatsCollector();

    var c1 = zettacluster({ zetta: zetta })
      .server('cloud', [collector.collect()])
      .server('test1', [Photocell], ['cloud']);

    var cloudRuntime = c1.servers['cloud'];
    var test1Runtime = c1.servers['test1'];

    var connectCount = 0;
    test1Runtime.pubsub.subscribe('_peer/connect', function(ev, msg) {
      connectCount++;
      if (connectCount === 1) {
        setTimeout(function() {
          msg.peer.ws.close();
        }, 10);
        return;
      } else if (connectCount === 2) {
        var peer = cloudRuntime.httpServer.peers['test1'];
        var queryKeys = Object.keys(peer.subscriptions)
            .filter(function(key) {
              if (key === '**') {
                return key;
              }
            });
        var subscriptionCount = queryKeys.length;
        assert.equal(subscriptionCount, 1);

        var queryKey = queryKeys[0];
        assert.equal(peer.subscriptions[queryKey], 1);

        c1.stop();
        setTimeout(done, 10);
      }
    });

    c1.run(function(err) {
      if (err) {
        done(err);
      }
    });
  });
});
