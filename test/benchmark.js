/**
 * This simple benchmark is measuring nice-emitter against EventEmitter3 (EE3),
 * using a subset of EE3's own benchmark.
 * EventEmitter3 (Copyright (c) 2014 Arnout Kazemier) is one of the best version out there, IMHO.
 * It is also EventEmitter3 which implemented some of the features I wanted since so long,
 * for example the "context" object associated to each listener.
 */

var EventEmitter = require('../index.js');
var EventEmitter3 = require('eventemitter3');
var NiceEmitter03 = require('nice-emitter');

var STANDARD = 'std'; // test is complying 100% to Node.js API
var MIN_RUN_MS = 1000;

var testList = [];
var testMap = {};
var testOrder = null; // array of test "modes"
var refCode = '';
var refCountPerMsByTestName = {};

var ee, ee3, ne, qne;

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
function bar2() {
    if (arguments.length > 100) console.log('damn');
    return false;
}
function baz() {
    if (arguments.length > 100) console.log('damn');
    return true;
}
function baz2() {
    if (arguments.length > 100) console.log('damn');
    return true;
}

addTestStandard(function addRemove () {
    ee.on('foo', handle);
    ee.removeListener('foo', handle);
}, function setup (Constructor) {
    ee = new Constructor();
});
addTestNice('NE', function addRemove () {
    ne.on('foo', handle);
    ne.removeListener('foo', handle);
}, function setup (Constructor) {
    ne = new Constructor();
    ne.declareEvent('foo');
});

addTestStandard(function addRemoveThird () {
    ee.removeListener('foo', handle);
    ee.on('foo', handle);
}, function setup (Constructor) {
    ee = new Constructor();
    ee.on('foo', bar);
    ee.on('foo', baz);
    ee.on('foo', handle);
    ee.on('foo', bar2);
    ee.on('foo', baz2);
});
addTestNice('NE', function addRemoveThird () {
    ne.removeListener('foo', handle);
    ne.on('foo', handle);
}, function setup (Constructor) {
    ne = new Constructor();
    ne.declareEvent('foo');
    ne.setMaxListeners(5);
    ne.on('foo', bar);
    ne.on('foo', baz);
    ne.on('foo', handle);
    ne.on('foo', bar2);
    ne.on('foo', baz2);
});

// If emitter must respect subscribers order AND it uses an array (with "holes")
// then this test makes the array grow until a reorg (compact) operation is done.
addTestStandard(function addRemoveCrossed () {
    ee.on('foo', baz);
    ee.removeListener('foo', bar);
    ee.on('foo', bar);
    ee.removeListener('foo', baz);
}, function setup (Constructor) {
    ee = new Constructor();
    ee.on('foo', handle);
    ee.on('foo', bar);
});
addTestNice('NE', function addRemoveCrossed () {
    ne.on('foo', baz);
    ne.removeListener('foo', bar);
    ne.on('foo', bar);
    ne.removeListener('foo', baz);
}, function setup (Constructor) {
    ne = new Constructor();
    ne.declareEvent('foo');
    ne.setMaxListeners(3);
    ne.on('foo', handle);
    ne.on('foo', bar);
});

addTestStandard(function emit () {
    ee.emit('foo');
    ee.emit('foo', 'bar');
    ee.emit('foo', 'bar', 'baz');
    ee.emit('foo', 'bar', 'baz', 'boom');
}, function setup (Constructor) {
    ee = new Constructor();
    ee.on('foo', handle);
});
addTestNice('NE', function emit () {
    ne.emit('foo');
    ne.emit('foo', 'bar');
    ne.emit('foo', 'bar', 'baz');
    ne.emit('foo', 'bar', 'baz', 'boom');
}, function setup (Constructor) {
    ne = new Constructor();
    ne.declareEvent('foo');
    ne.on('foo', handle);
});
addTestNice('NEQ', function emit () {
    qne.emit0();
    qne.emit1('bar');
    qne.emit2('bar', 'baz');
    qne.emit3('bar', 'baz', 'boom');
}, function setup (Constructor) {
    ne = new Constructor();
    ne.declareEvent('foo');
    qne = ne.getQuickEmitter('foo');
    ne.on('foo', handle);
});

addTestStandard(function emitMultiListeners () {
    ee.emit('foo');
    ee.emit('foo', 'bar');
    ee.emit('foo', 'bar', 'baz');
    ee.emit('foo', 'bar', 'baz', 'boom');
}, function setup (Constructor) {
    ee = new Constructor();
    ee.on('foo', foo).on('foo', bar).on('foo', baz);
});
addTestNice('NE', function emitMultiListeners () {
    ne.emit('foo');
    ne.emit('foo', 'bar');
    ne.emit('foo', 'bar', 'baz');
    ne.emit('foo', 'bar', 'baz', 'boom');
}, function setup (Constructor) {
    ne = new Constructor();
    ne.setMaxListeners(3); // other way was: ne.on('foo', foo, 'a').on('foo', bar, 'b').on('foo', baz, 'c')
    ne.declareEvent('foo');
    ne.on('foo', foo).on('foo', bar).on('foo', baz);
});

addTestStandard(function context () {
    ee.emit('foo');
    ee.emit('foo', 'bar');
    ee.emit('foo', 'bar', 'baz');
    ee.emit('foo', 'bar', 'baz', 'boom');
}, function setup (Constructor) {
    ee = new Constructor();
    var ctx = { foo: 'bar' };
    ee.on('foo', handle, ctx);
});
addTestNice('NE', function context () {
    ne.emit('foo');
    ne.emit('foo', 'bar');
    ne.emit('foo', 'bar', 'baz');
    ne.emit('foo', 'bar', 'baz', 'boom');
}, function setup (Constructor) {
    ne = new Constructor();
    ne.declareEvent('foo');
    var ctx = { foo: 'bar' };
    ne.on('foo', handle, ctx);
});

addTestStandard(function hundreds () {
    for (var i = 0; i < 10; i++) {
        ee.emit('event:' + i);
    }
}, function setup (Constructor) {
    ee = new Constructor();
    for (var i = 0; i < 10; i++) {
        for (var j = 0; j < 10; j++) {
            ee.on('event:' + i, foo);
        }
    }
});
addTestNice('NE', function hundreds () {
    for (var i = 0; i < 10; i++) {
        ne.emit('event:' + i);
    }
}, function setup (Constructor) {
    ne = new Constructor();
    ne.setMaxListeners(10);
    for (var i = 0; i < 10; i++) {
        ne.declareEvent('event:' + i);
        for (var j = 0; j < 10; j++) {
            ne.on('event:' + i, foo);
        }
    }
});
addTestNice('NEQ', function hundreds () {
    for (var i = 0; i < 10; i++) {
        ne.quickEmits[i].emit0();
    }
}, function setup (Constructor) {
    ne = new Constructor();
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

function addTestStandard (testFn, setup) {
    var decl = { name: testFn.name, modes: {}};
    testMap[testFn.name] = decl;
    testList.push(decl);
    decl.modes[STANDARD] = new TestMode(decl, STANDARD, testFn, setup);
}

function addTestNice (mode, testFn, setup) {
    var decl = testMap[testFn.name];
    decl.modes[mode] = new TestMode(decl, mode, testFn, setup);
}

function TestMode (decl, code, testFn, setup, isRef) {
    this.decl = decl;
    this.code = code;
    this.testFn = testFn;
    this.setup = setup;
    this.isReference = isRef;
}

function initTestOrder (refCode, testName) {
    refCode = refCode || 'ee3';

    testOrder = [];
    var list = testList;
    if (testName) list = [testMap[testName]];

    for (var i = 0; i < list.length; i++) {
        var modes = list[i].modes;
        var modeRef, mode2, modeQ = modes['NEQ'], modeRefQ = null;
        if (modeQ) modeQ.code = 'NE Quick';

        switch (refCode) {
        case 'reg':
            mode2 = modes['NE'];
            modeRef = new TestMode(mode2.decl, 'NE0.3', mode2.testFn, mode2.setup, true);
            if (modeQ) modeRefQ = new TestMode(modeQ.decl, 'NE0.3 Quick', modeQ.testFn, modeQ.setup, true);
            break;
        case 'ee3':
            modeRef = modes[STANDARD];
            modeRef.code = 'EE3';
            modeRef.isReference = true;
            mode2 = modes['NE'];
            break;
        case 'ne':
            modeRef = modes['NE'];
            modeRef.isReference = true;
            break;
        case 'ne03':
            var mode = modes['NE'];
            modeRef = new TestMode(mode.decl, 'NE0.3', mode.testFn, mode.setup, true);
            break;
        default:
            throw new Error('Invalid ref code: ' + refCode);
        }

        for (var n = 0; n < 3; n++) {
            testOrder.push(modeRef);
            if (mode2) testOrder.push(mode2);
            if (modeRefQ) testOrder.push(modeRefQ);
            if (modeQ) testOrder.push(modeQ);
        }
    }
}

TestMode.prototype.runSetup = function (isProd) {
    var Constructor;

    if (this.code.startsWith('NE0.3')) {
        NiceEmitter03.setDebugLevel(isProd ? NiceEmitter03.NO_DEBUG : NiceEmitter03.DEBUG_THROW);
        Constructor = NiceEmitter03;
    } else if (this.code.startsWith('NE')) {
        Constructor = EventEmitter; // nice-emitter latest
        EventEmitter.setDebugLevel(isProd ? EventEmitter.NO_DEBUG : EventEmitter.DEBUG_THROW);
    } else if (this.code.startsWith('EE3')) {
        Constructor = EventEmitter3;
    } else {
        throw new Error('Invalid code: ' + this.code);
    }

    this.setup(Constructor);
};

function runAllBenchmark (isProd, refCode, testName) {
    initTestOrder(refCode, testName);
    for (var t = 0; t < testOrder.length; t++) {
        var result = runBenchmark(t, isProd);
        console.log(result.msg);
    }
}

/**
 * Runs one benchmark test
 *
 * @param {number} index - index of requested benchmark (0..n)
 * @param {boolean} isProd - true if PROD mode (no debug check) should be used
 * @param {string} [refCode] - default is "EE3"; "reg" to compare with NE0.3
 * @param {string} [testName] - if only this test should run
 * @returns {object|null} - null if index is out of range; otherwise results of test
 */
function runBenchmark (index, isProd, refCode, testName) {
    if (!testOrder) initTestOrder(refCode, testName);

    var mode = testOrder[index];
    if (!mode) return null;

    mode.runSetup(isProd);
    var result = runOneTest(mode.testFn);

    return logOneTest(mode, result, isProd);
}

function TestResult (count, duration) {
    this.count = count;
    this.duration = duration;
    this.factor = 0;
    this.msg = '';
}

function runOneTest (fn) {
    var t0 = Date.now();
    var count = 0, duration = 0;

    while (duration < MIN_RUN_MS) {
        for (var i = 0; i < 1000; i++) fn();
        count++;
        duration = Date.now() - t0;
    }

    return new TestResult(count, duration);
}

function logOneTest (mode, result, isProd) {
    var testName = mode.decl.name;
    var code = mode.code;
    var countPerMs = result.count / result.duration;
    var sufix = code, factorStr = '';
    if (mode.isReference) {
        refCountPerMsByTestName[testName] = countPerMs;
        result.factor = 0;
    } else {
        sufix += ' ' + (isProd ? 'PROD' : 'DEBUG');
        result.factor = countPerMs / refCountPerMsByTestName[testName];
        factorStr = '   [x ' + result.factor.toFixed(2) + ']';
    }
    var msg = testName + ' ' + sufix + ': ' + result.count + 'k runs in ' + result.duration + 'ms' + factorStr;
    result.msg = msg;
    return result;
}

if (typeof window === 'undefined') {
    runAllBenchmark(process.argv[2] !== 'DEBUG', process.argv[3], process.argv[4]);
} else {
    exports.runBenchmark = runBenchmark;
}
