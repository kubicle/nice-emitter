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

var ee3, ne, qne;

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

addTest('EE3', function addRemoveThird () {
    ee3.on('foo', handle);
    ee3.removeListener('foo', handle);
}, function setup () {
    ee3 = new EE3();
    ee3.on('foo', bar);
    ee3.on('foo', baz);
});
addTest('NE', function addRemoveThird () {
    ne.on('foo', handle);
    ne.removeListener('foo', handle);
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
    ne.setMaxListeners(3);
    ne.on('foo', bar);
    ne.on('foo', baz);
});

addTest('EE3', function addRemoveCrossed () {
    ee3.on('foo', baz);
    ee3.removeListener('foo', bar);
    ee3.on('foo', bar);
    ee3.removeListener('foo', baz);
}, function setup () {
    ee3 = new EE3();
    ee3.on('foo', handle);
    ee3.on('foo', bar);
});
addTest('NE', function addRemoveCrossed () {
    ne.on('foo', baz);
    ne.removeListener('foo', bar);
    ne.on('foo', bar);
    ne.removeListener('foo', baz);
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
    ne.setMaxListeners(3);
    ne.on('foo', handle);
    ne.on('foo', bar);
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
    qne.emit0();
    qne.emit1('bar');
    qne.emit2('bar', 'baz');
    qne.emit3('bar', 'baz', 'boom');
}, function setup () {
    ne = new EventEmitter();
    ne.declareEvent('foo');
    qne = ne.getQuickEmitter('foo');
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
    ne.setMaxListeners(3); // other way was: ne.on('foo', foo, 'a').on('foo', bar, 'b').on('foo', baz, 'c')
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
        ne.quickEmits[i].emit0();
    }
}, function setup () {
    ne = new EventEmitter();
    ne.setMaxListeners(10);
    ne.quickEmits = [];
    for (var i = 0; i < 10; i++) {
        ne.declareEvent('event:' + i);
        ne.quickEmits[i] = ne.getQuickEmitter('event:' + i);
        for (var j = 0; j < 10; j++) {
            ne.on('event:' + i, foo);
        }
    }
});

//---

var MIN_RUN_MS = 1000;

function addTest (mode, test, setup) {
    tests.push({ mode: mode, test: test, setup: setup });
}

var refCountPerMsByTestName = {};

function runAllBenchmark (isProd) {
    for (var t = 0; t < tests.length; t++) {
        var result = runBenchmark(t, isProd);
        console.log(result.msg);
    }
}

/**
 * Runs one benchmark test
 *
 * @param {number} index - index of requested benchmark
 * @param {boolean} isProd - true if PROD mode (no debug check) should be used
 * @returns {number|null} - null if index is out of range; otherwise ratio compared to ref (-1 if this was ref)
 */
function runBenchmark (index, isProd) {
    EventEmitter.setDebugLevel(isProd ? EventEmitter.NO_DEBUG : EventEmitter.DEBUG_THROW);

    var decl = tests[index];
    if (!decl) return null;
    if (decl.setup) {
        decl.setup();
    }

    return logOneTest(runOneTest(decl), isProd);
}

function runOneTest (decl) {
    var fn = decl.test;
    var t0 = Date.now();
    var count = 0, duration = 0;

    while (duration < MIN_RUN_MS) {
        for (var i = 0; i < 1000; i++) fn();
        count++;
        duration = Date.now() - t0;
    }

    return { decl: decl, count: count, duration: duration };
}

function logOneTest (result, isProd) {
    var testName = result.decl.test.name;
    var mode = result.decl.mode;
    var countPerMs = result.count / result.duration;
    var sufix = mode, factorStr = '';
    if (mode === 'EE3') {
        refCountPerMsByTestName[testName] = countPerMs;
        result.factor = 0;
    } else if (mode.startsWith('NE')) {
        sufix += ' ' + (isProd ? 'PROD' : 'DEBUG');
        result.factor = countPerMs / refCountPerMsByTestName[testName];
        factorStr = '   [x ' + result.factor.toFixed(2) + ']';
    }
    var msg = testName + ' ' + sufix + ': ' + result.count + 'k runs in ' + result.duration + 'ms' + factorStr;
    result.msg = msg;
    return result;
}

if (typeof window === 'undefined') {
    runAllBenchmark(process.argv[2] !== 'DEBUG');
} else {
    exports.runBenchmark = runBenchmark;
}
