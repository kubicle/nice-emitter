var EventEmitter = require('../index.js');
var inherits = require('util').inherits;


function MySignaler () {
    EventEmitter.call(this);
    this.declareEvent('signal1');
    this.declareEvent('signal2');
    this.declareEvent('signal3');
    this.declareEvent('signal4');
    this.declareEvent('signal5');
}
inherits(MySignaler, EventEmitter);


MySignaler.prototype.emitEvent = function (eventId) {
    switch (eventId) {
    case 1: return this.emit('signal1', 1, 2);
    case 2: return this.emit('signal2', 'a', 'b');
    case 3: return this.emit('signal3', 11, '22', 1);
    case 4: return this.emit('signal4', 11, '22', 33, 1);
    case 5: return this.emit('signal5');
    default: return this.emit('non-declared');
    }
};

function MyListener (signaler, name) {
    this._signaler = signaler;
    this._name = name;
    this._received = '';
    this._receivedCount = 0;

    signaler.setListenerMaxCount(2, this);
    this.startListening();
}

MyListener.prototype.startListening = function () {
    this._signaler.on('signal1', this._handlerSignal1, this);
    this._signaler.on('signal2', this._handlerSignal2, this);
    this._signaler.on('signal3', this._handlerSignal3, this);
};

MyListener.prototype.stopListening = function () {
    this._signaler.forgetListener(this);
};

MyListener.prototype._handlerSignal1 = function (arg1, arg2) {
    this._received += '1: ' + arg1 + ',' + arg2 + '\n';
};

MyListener.prototype._handlerSignal2 = function (arg1, arg2) {
    this._received += '2: ' + arg1 + ',' + arg2 + '\n';
};

MyListener.prototype._handlerSignal3 = function (arg1, arg2, count) {
    this._receivedCount += count;
};

MyListener.prototype.checkReceived = function (expected) {
    if (this._received !== expected) {
        throw new Error('Expected: \n' + expected + '\nReceived: \n' + this._received);
    }
};

function AnotherListener (signaler) {
    this._received = '';
    this._receivedCount = 0;

    signaler.on('signal1', function (arg1, arg2) {
        this._received += '1: ' + arg1 + ',' + arg2 + '\n';
    }, this);
    signaler.on('signal3', function (arg1, arg2, count) {
        this._receivedCount += count;
    }, this);
    signaler.on('signal4', function (arg1, arg2, arg3, arg4) {
        this._receivedCount += arg4;
    }, this);
}

AnotherListener.prototype.checkReceived = function (expected) {
    if (this._received !== expected) {
        throw new Error('Expected: \n' + expected + '\nReceived: \n' + this._received);
    }
};

AnotherListener.prototype.checkReceivedCount = function (expected) {
    if (this._receivedCount !== expected) {
        throw new Error('Expected: \n' + expected + '\nReceivedCount: \n' + this._receivedCount);
    }
};


function basicTest () {
    var signaler = new MySignaler();
    var a = new MyListener(signaler, 'A');
    var b = new MyListener(signaler, 'B');
    var c = new AnotherListener(signaler);

    checkResult(false, signaler.emitEvent(5)); // false since no listener

    checkResult(true, signaler.emitEvent(4));
    c.checkReceivedCount(1);

    signaler.emitEvent(1);

    a.checkReceived('1: 1,2\n');
    b.checkReceived('1: 1,2\n');
    c.checkReceived('1: 1,2\n');

    signaler.emitEvent(2);

    a.checkReceived('1: 1,2\n2: a,b\n');
    b.checkReceived('1: 1,2\n2: a,b\n');
    c.checkReceived('1: 1,2\n');

    a.stopListening();
    signaler.emitEvent(1);
    a.checkReceived('1: 1,2\n2: a,b\n');
    b.checkReceived('1: 1,2\n2: a,b\n1: 1,2\n');
    c.checkReceived('1: 1,2\n1: 1,2\n');

    a.startListening();
    signaler.emitEvent(1);
    a.checkReceived('1: 1,2\n2: a,b\n1: 1,2\n');

    checkException('Undeclared event ID for MySignaler: non-declared', function () {
        signaler.emitEvent(-1);
    });
}

function quickEmitTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();

    checkException('Undeclared event ID for MySignaler: signalXXX', function () {
        signaler.makeQuickEmitFunction('signalXXX');
    });
    var fn = signaler.makeQuickEmitFunction('signal1');
    checkResult(fn, signaler.emit_signal1);
    checkResult(fn, signaler.makeQuickEmitFunction('signal1')); // returns same function

    checkResult(false, signaler.emit_signal1('hello'));

    signaler.on('signal1', function () {
        checkResult(0, arguments.length);
    }, 'A');
    checkResult(true, signaler.emit_signal1());
    signaler.off('signal1', 'A')

    signaler.on('signal1', function (p1) {
        checkResult(1, arguments.length);
        checkResult('hello', p1);
    }, 'A');
    checkResult(true, signaler.emit_signal1('hello'));
    signaler.off('signal1', 'A')

    signaler.on('signal1', function (p1, p2) {
        checkResult(2, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
    }, 'A');
    checkResult(true, signaler.emit_signal1('hello', 'world'));
    signaler.off('signal1', 'A')

    signaler.on('signal1', function (p1, p2, p3) {
        checkResult(3, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        checkResult('33', p3);
    }, 'A');
    checkResult(true, signaler.emit_signal1('hello', 'world', '33'));
    signaler.off('signal1', 'A')

    signaler.on('signal1', function (p1, p2, p3, p4) {
        checkResult(4, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        checkResult('33', p3);
        checkResult('44', p4);
    }, 'A');
    checkResult(true, signaler.emit_signal1('hello', 'world', '33', '44'));
    signaler.off('signal1', 'A')
}

function oldApiTest () {
    var signaler = new MySignaler();
    var callCount = 0;
    var fn = function (p1) {
        checkResult('hi', p1);
        callCount++;
    };
    signaler.on('signal1', fn);
    checkResult(true, signaler.emit('signal1', 'hi'));
    checkResult(1, callCount);
    signaler.removeListener('signal1', fn);
    checkResult(false, signaler.emit('signal1', 'hey'));
    checkResult(1, callCount);

    var fn2 = function () {};
    signaler.on('signal1', fn);
    checkException('Too many listeners: MySignaler.on(\'signal1\', fn). Use MySignaler.setMaxListeners(n) with n >= 2. Even better: specify your listeners when calling "on"',
        function () {
            signaler.on('signal1', fn2);
        });
    signaler.setMaxListeners(2);
    signaler.on('signal1', fn2); // when more than 1 fn an array is used
    signaler.removeListener('signal1', fn2);
    signaler.removeListener('signal1', fn);

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_ERROR);
    signaler.removeListener('signalXXX', fn);
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn)');

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn)', function () {
        signaler.removeListener('signalXXX', fn);
    });
    signaler.removeListener('signal5', fn); // no exception if valid event ID, even if no listener set

    // setMaxListeners

    checkException('EventEmitter.setMaxListeners is not a function', function () { EventEmitter.setMaxListeners(); });
    checkException('Invalid parameters to emitter.setMaxListeners: 0', function () { signaler.setMaxListeners(0); });
    checkException('Invalid parameters to emitter.setMaxListeners: undefined', function () { signaler.setMaxListeners(undefined); });
    checkException('Invalid parameters to emitter.setMaxListeners: 1, extra', function () { signaler.setMaxListeners(1, 'extra'); });

    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    signaler.setMaxListeners(-1); // ignored because NO_DEBUG

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    signaler.setMaxListeners(2);
}

function nodebugTest () {
    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    var signaler = new MySignaler();

    signaler.emitEvent(-1);
    checkConsole('Undeclared event ID for MySignaler: non-declared');

    signaler.declareEvent('signal1');
    checkConsole('Event ID declared twice: MySignaler.on(\'signal1\', fn)');
}

//---

var consoleErrors = [];

function rerouteConsole () {
    console.error = function () {
        var msg = '';
        for (var i = 0; i < arguments.length; i++) {
            msg += arguments[i].toString();
        }
        consoleErrors.push(msg);
    };
}

function checkConsole (expected) {
    var msg = consoleErrors.pop();
    if (msg !== expected) throw new Error('Wrong console.error:\n' + msg + '\ninstead of:\n' + expected);
    if (consoleErrors.length > 0) throw new Error('Unexpected console.error: ' + consoleErrors[0]);
}

function checkException (expected, testFn) {
    var exc = '[no-exception]';
    try {
        testFn();
    } catch (e) {
        exc = e.message;
    }
    if (exc !== expected) {
        throw new Error('Expected exception:\n' + expected + '\nbut got:\n' + exc);
    }
}

function checkResult (expected, result) {
    if (result !== expected) throw new Error('Wrong result:\n' + result + '\ninstead of:\n' + expected);
}

function runTest () {
    rerouteConsole();
    basicTest();
    quickEmitTest();
    oldApiTest();
    nodebugTest();

    console.log('Emitter test completed.');
}

runTest();
