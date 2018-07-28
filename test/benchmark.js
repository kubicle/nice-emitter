/**
 * This simple benchmark is measuring nice-emitter against EventEmitter3 (EE3),
 * using a subset of EE3's own benchmark.
 * EventEmitter3 (Copyright (c) 2014 Arnout Kazemier) is one of the best version out there, IMHO.
 * It is also EventEmitter3 which implemented some of the features I wanted since so long,
 * for example the "context" object associated to each listener.
 */

var EventEmitter = require('../index.js');
var EE3 = require('eventemitter3');

var tests = [];

var ee3, ne;

function handle() {
    if (arguments.length > 100) console.log('damn');
}

function foo() {
    if (arguments.length > 100) console.log('damn');
    return 1;
}

function bar() {
    if (arguments.length > 100) console.log('damn');
    return false;
}

function baz() {
    if (arguments.length > 100) console.log('damn');
    return true;
}

addTest('EE3', function addRemove () {
    ee3.on('foo', handle);
    ee3.removeListener('foo', handle);
}, function setup () {
    ee3 = new EE3();
});
addTest('NE', function addRemove () {
    ne.on('foo', handle);
    ne.removeListener('foo', handle);
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
});

addTest('EE3', function emit () {
    ee3.emit('foo');
    ee3.emit('foo', 'bar');
    ee3.emit('foo', 'bar', 'baz');
    ee3.emit('foo', 'bar', 'baz', 'boom');
}, function setup () {
    ee3 = new EE3();
    ee3.on('foo', handle);
});
addTest('NE', function emit () {
    ne.emit('foo');
    ne.emit('foo', 'bar');
    ne.emit('foo', 'bar', 'baz');
    ne.emit('foo', 'bar', 'baz', 'boom');
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
    ne.on('foo', handle);
});
addTest('NE quickEmit', function emit () {
    ne.emit_foo();
    ne.emit_foo('bar');
    ne.emit_foo('bar', 'baz');
    ne.emit_foo('bar', 'baz', 'boom');
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
    ne.makeQuickEmitFunction('foo');
    ne.on('foo', handle);
});

addTest('EE3', function emitMultiListeners () {
    ee3.emit('foo');
    ee3.emit('foo', 'bar');
    ee3.emit('foo', 'bar', 'baz');
    ee3.emit('foo', 'bar', 'baz', 'boom');
}, function setup () {
    ee3 = new EE3();
    ee3.on('foo', foo).on('foo', bar).on('foo', baz);
});
addTest('NE', function emitMultiListeners () {
    ne.emit('foo');
    ne.emit('foo', 'bar');
    ne.emit('foo', 'bar', 'baz');
    ne.emit('foo', 'bar', 'baz', 'boom');
}, function setup () {
    ne = new EventEmitter();
    ne.setListenerMaxCount(3); // other way was: ne.on('foo', foo, 'a').on('foo', bar, 'b').on('foo', baz, 'c')
    ne.declareEvent('foo');
    ne.on('foo', foo).on('foo', bar).on('foo', baz);
});

addTest('EE3', function context () {
    ee3.emit('foo');
    ee3.emit('foo', 'bar');
    ee3.emit('foo', 'bar', 'baz');
    ee3.emit('foo', 'bar', 'baz', 'boom');
}, function setup () {
    ee3 = new EE3();
    var ctx = { foo: 'bar' };
    ee3.on('foo', handle, ctx);
});
addTest('NE', function context () {
    ne.emit('foo');
    ne.emit('foo', 'bar');
    ne.emit('foo', 'bar', 'baz');
    ne.emit('foo', 'bar', 'baz', 'boom');
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
    var ctx = { foo: 'bar' };
    ne.on('foo', handle, ctx);
});

addTest('EE3', function hundreds () {
    for (var i = 0; i < 10; i++) {
        ee3.emit('event:' + i);
    }
}, function setup () {
    ee3 = new EE3();
    for (var i = 0; i < 10; i++) {
        for (var j = 0; j < 10; j++) {
            ee3.on('event:' + i, foo);
        }
    }
});
addTest('NE', function hundreds () {
    for (var i = 0; i < 10; i++) {
        ne.emit('event:' + i);
    }
}, function setup () {
    ne = new EventEmitter();
    ne.setMaxListeners(10);
    for (var i = 0; i < 10; i++) {
        ne.declareEvent('event:' + i);
        for (var j = 0; j < 10; j++) {
            ne.on('event:' + i, foo);
        }
    }
});
addTest('NE quickEmit', function hundreds () {
    for (var i = 0; i < 10; i++) {
        ne.quickEmits[i]();
    }
}, function setup () {
    ne = new EventEmitter();
    ne.setMaxListeners(10);
    ne.quickEmits = [];
    for (var i = 0; i < 10; i++) {
        ne.declareEvent('event:' + i);
        ne.quickEmits[i] = ne.makeQuickEmitFunction('event:' + i);
        for (var j = 0; j < 10; j++) {
            ne.on('event:' + i, foo);
        }
    }
});

var MIN_RUN_MS = 1000;

function addTest (mode, test, setup) {
    tests.push({ mode: mode, test: test, setup: setup });
}

var TEST_PROD = true;

function runBenchmark () {
    var neMode;
    if (TEST_PROD) {
        EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
        neMode = 'PROD';
    } else {
        neMode = 'DEBUG';
    }

    for (var t = 0; t < tests.length; t++) {
        var decl = tests[t];
        if (decl.setup) {
            decl.setup();
        }

        var sufix = decl.mode === 'NE' ? 'NE ' + neMode : decl.mode;
        console.log(runOneTest(decl, sufix));
    }
}

function runOneTest (decl, sufix) {
    var fn = decl.test;
    var testName = fn.name + (sufix ? ' ' + sufix : '');

    var t0 = Date.now();
    var count = 0, duration = 0;
    while (duration < MIN_RUN_MS) {
        for (var i = 0; i < 1000; i++) fn();
        count++;
        duration = Date.now() - t0;
    }

    return testName + ': ' + count + 'k runs in ' + duration + 'ms';
}

runBenchmark();
