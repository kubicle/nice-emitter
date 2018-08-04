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

function slowEmitErrorTest () {
    var signaler = new MySignaler();

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn)', function () {
        signaler.on('signalXXX', function () {});
    });
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn, Object)', function () {
        signaler.on('signalXXX', function () {}, {});
    });
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn, MySignaler)', function () {
        signaler.on('signalXXX', function () {}, signaler);
    });
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn, Abc)', function () {
        signaler.on('signalXXX', function () {}, 'Abc');
    });
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn, Number)', function () {
        signaler.on('signalXXX', function () {}, 123); // number is not really a correct context but...
    });

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_ERROR);
    signaler.on('signalXXX', function () {});
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn)');
    signaler.on('signalXXX', function () {}, {});
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn, Object)');
    signaler.on('signalXXX', function () {}, signaler);
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn, MySignaler)');
    signaler.on('signalXXX', function () {}, 'Abc');
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn, Abc)');
    signaler.on('signalXXX', function () {}, 123); // number is not really a correct context but...
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn, Number)');

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    checkException('Invalid parameters to emitter.on: \'signal1\', undefined, <default>', function () {
        signaler.on('signal1', undefined);
    });
    checkException('Invalid parameters to emitter.on: \'signal1\', object, Function', function () {
        signaler.on('signal1', signaler, function () {});
    });

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_ERROR);
    signaler.off('signalXXX', 'A');
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn, A)');
    signaler.off('signal1');
    checkConsole('Invalid parameter to emitter.off: \'signal1\', undefined');

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    signaler.setListenerMaxCount(2, 'A');
    signaler.on('signal1', function () {}, 'A');
    checkException('Listener listens twice: MySignaler.on(\'signal1\', fn, A)', function () {
        signaler.on('signal1', function () {}, 'A');
    });

    checkException('Undeclared event ID for MySignaler: undefined', function () {
        signaler.listenerCount();
    });
}

function slowEmitTest () {
    var signaler = new MySignaler();

    checkResult(0, signaler.listenerCount('signal1'));
    checkResult(false, signaler.emit('signal1'));
    checkResult(false, signaler.emit('signal1', 'p1'));
    checkResult(false, signaler.emit('signal1', 'p1', 'p2'));
    checkResult(false, signaler.emit('signal1', 'p1', 'p2', 'p3'));
    checkResult(false, signaler.emit('signal1', 'p1', 'p2', 'p3', 'p4'));

    var called = false;
    signaler.on('signal1', function () {
        checkResult(0, arguments.length);
        called = true;
    }, 'A');
    checkResult(true, signaler.emit('signal1'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1) {
        checkResult(1, arguments.length);
        checkResult('hello', p1);
        called = true;
    }, 'A');
    checkResult(true, signaler.emit('signal1', 'hello'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1, p2) {
        checkResult(2, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        called = true;
    }, 'A');
    checkResult(true, signaler.emit('signal1', 'hello', 'world'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1, p2, p3) {
        checkResult(3, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        checkResult('33', p3);
        called = true;
    }, 'A');
    checkResult(true, signaler.emit('signal1', 'hello', 'world', '33'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1, p2, p3, p4) {
        checkResult(4, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        checkResult('33', p3);
        checkResult('44', p4);
        called = true;
    }, 'A');
    checkResult(true, signaler.emit('signal1', 'hello', 'world', '33', '44'));
    checkResult(true, called);
    signaler.off('signal1', 'A')
}

function quickEmitErrorTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();

    checkException('Undeclared event ID for MySignaler: signalXXX', function () {
        signaler.getQuickEmitter('signalXXX');
    });
}

function quickEmitTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();
    var quickEmitterSignal1 = signaler.getQuickEmitter('signal1');
    checkResult('object', typeof quickEmitterSignal1);
    checkResult(quickEmitterSignal1, signaler.getQuickEmitter('signal1')); // returns same object

    checkResult(false, quickEmitterSignal1.emit0());
    checkResult(false, quickEmitterSignal1.emit1('p1'));
    checkResult(false, quickEmitterSignal1.emit2('p1', 'p2'));
    checkResult(false, quickEmitterSignal1.emit3('p1', 'p2', 'p3'));
    checkResult(false, quickEmitterSignal1.emitN('p1', 'p2', 'p3', 'p4'));

    quickEmitAll(signaler, quickEmitterSignal1);
    //...and same with more than 1 listener
    var count = 0;
    signaler.on('signal1', function () {
        count += arguments.length + 1;
    }, 'B');
    quickEmitAll(signaler, quickEmitterSignal1);
    signaler.forgetListener('B');
    checkResult(15, count); // 1 + 2 + 3 + 4 + 5
}

function quickEmitAll (signaler, quickEmitterSignal1) {
    var called = false;
    signaler.on('signal1', function () {
        checkResult(0, arguments.length);
        called = true;
    }, 'A');
    checkResult(true, quickEmitterSignal1.emit0());
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1) {
        checkResult(1, arguments.length);
        checkResult('hello', p1);
        called = true;
    }, 'A');
    checkResult(true, quickEmitterSignal1.emit1('hello'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1, p2) {
        checkResult(2, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        called = true;
    }, 'A');
    checkResult(true, quickEmitterSignal1.emit2('hello', 'world'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1, p2, p3) {
        checkResult(3, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        checkResult('33', p3);
        called = true;
    }, 'A');
    checkResult(true, quickEmitterSignal1.emit3('hello', 'world', '33'));
    checkResult(true, called);
    signaler.off('signal1', 'A')

    called = false;
    signaler.on('signal1', function (p1, p2, p3, p4) {
        checkResult(4, arguments.length);
        checkResult('hello', p1);
        checkResult('world', p2);
        checkResult('33', p3);
        checkResult('44', p4);
        called = true;
    }, 'A');
    checkResult(true, quickEmitterSignal1.emitN('hello', 'world', '33', '44'));
    checkResult(true, called);
    signaler.off('signal1', 'A')
}

function oldApiTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();
    var callCount = 0;
    var fn = function (p1) {
        checkResult('hi', p1);
        callCount++;
    };
    var fn2 = function () {};
    signaler.removeListener('signal1', fn); // no effect if never set
    signaler.addListener('signal1', fn); // synonym of "on"
    checkResult(true, signaler.emit('signal1', 'hi'));
    checkResult(1, callCount);
    signaler.removeListener('signal1', fn2); // no effect if never set (and another function is listening)
    signaler.removeListener('signal1', fn);
    signaler.removeListener('signal1', fn); // no effect if already removed
    signaler.off('signal1', fn); // off is equivalent (for coverage)
    checkResult(false, signaler.emit('signal1', 'hey'));
    checkResult(1, callCount);

    signaler.on('signal1', fn);
    checkException('Too many listeners: MySignaler.on(\'signal1\', fn). Use MySignaler.setMaxListeners(n) with n >= 2. Even better: specify your listeners when calling "on"',
        function () {
            signaler.on('signal1', fn2);
        });
    signaler.setMaxListeners(2);
    signaler.on('signal1', fn2); // when more than 1 fn an array is used
    signaler.off('signal1', fn2); // off here calls old API's removeListener
    signaler.off('signal1', fn);
    checkResult(false, signaler.emit('signal1'));

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_ERROR);
    signaler.removeListener('signalXXX', fn);
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn)');

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    checkException('Invalid event ID: MySignaler.on(\'signalXXX\', fn)', function () {
        signaler.removeListener('signalXXX', fn);
    });

    // setMaxListeners

    checkException('*setMaxListeners', function () { EventEmitter.setMaxListeners(); });
    checkException('Invalid parameters to emitter.setMaxListeners: 0', function () { signaler.setMaxListeners(0); });
    checkException('Invalid parameters to emitter.setMaxListeners: undefined', function () { signaler.setMaxListeners(undefined); });
    checkException('Invalid parameters to emitter.setMaxListeners: 1, extra', function () { signaler.setMaxListeners(1, 'extra'); });

    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    signaler.setMaxListeners(-1); // ignored because NO_DEBUG

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    signaler.setMaxListeners(2);
}

function setListenerMaxCountTest() {
    var signaler = new MySignaler();
    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    signaler.setListenerMaxCount(); // no effect if no debug
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    checkException('Invalid parameters to emitter.setListenerMaxCount: 10, undefined', function () {
        signaler.setListenerMaxCount(10);
    });
    function Ear() {}
    var ear1 = new Ear(), ear2 = new Ear(), ear3 = new Ear();
    signaler.setListenerMaxCount(2, ear1); // any Ear object is equivalent here
    signaler.on('signal1', function () {}, ear1);
    signaler.on('signal2', function () {}, ear1);
    signaler.on('signal1', function () {}, ear2);
    signaler.on('signal2', function () {}, ear2);
    checkException('Too many listeners: MySignaler.on(\'signal2\', fn, Ear). Use MySignaler.setListenerMaxCount(n, Ear) with n >= 3', function () {
        signaler.on('signal2', function () {}, ear3); // this is Ear #3 while we said only 2 can listen
    });
}

function nodebugTest () {
    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    var signaler = new MySignaler();

    signaler.emitEvent(-1);
    checkConsole('Undeclared event ID for MySignaler: non-declared');

    signaler.declareEvent('signal1');
    checkConsole('Event ID declared twice: MySignaler.on(\'signal1\', fn)');
}

/**
 * This test is here to see how we break when removing listeners during an emit on same event ID.
 * See longer comments elsewhere about why this is not supported.
 */
function offDuringEmitTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();
    function Ear () { this.count = 0; }
    var ear1 = new Ear(), ear2 = new Ear(), ear3 = new Ear();
    ear1.onSignal1 = function () {
        signaler.forgetListener(this);
    };
    ear2.onSignal1 = function () {
        this.count++;
    };
    ear3.onSignal1 = ear2.onSignal1;
    signaler.setListenerMaxCount(3, ear1);

    signaler.on('signal1', ear1.onSignal1, ear1);
    signaler.on('signal1', ear2.onSignal1, ear2);

    checkException('Removed listener during emit: MySignaler.on(\'signal1\', fn, Ear)', function () {
        signaler.emit('signal1');
    });
    // ear2 has NOT been notified because of exception during emit
    checkResult(0, ear2.count);
    // ear1 has been removed; ear2 is still listening
    checkResult(1, signaler.listenerCount('signal1'));
    checkResult(true, signaler.emit('signal1'));
    checkResult(1, ear2.count);
    signaler.off('signal1', ear2);
    checkResult(0, signaler.listenerCount('signal1'));

    // Try again but use no-throw mode now...

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_ERROR);
    ear2.count = ear3.count = 0;
    signaler.on('signal1', ear1.onSignal1, ear1);
    signaler.on('signal1', ear2.onSignal1, ear2);
    signaler.on('signal1', ear3.onSignal1, ear3);

    signaler.emit('signal1');
    checkConsole('Removed listener during emit: MySignaler.on(\'signal1\', fn, Ear)');

    // ear2 has NOT been notified because it was just after ear1 when ear1 got removed (not handled)
    checkResult(0, ear2.count);
    // ear3 HAS been notified
    checkResult(1, ear3.count);
    // ear1 has been removed; ear2 & ear3 are still listening
    checkResult(2, signaler.listenerCount('signal1'));
    ear2.count = ear3.count = 0;
    checkResult(true, signaler.emit('signal1'));
    checkResult(1, ear2.count);
    checkResult(1, ear3.count);
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

/**
 * Verifies that an exception is generated.
 * Throws if no exception or if exception message is not as expected.
 *
 * @param {string} expected - exact exception message OR "*subtext" to match any message which contains subtext
 * @param {function} testFn - test to run
 */
function checkException (expected, testFn) {
    var exc = '[no-exception]';
    try {
        testFn();
    } catch (e) {
        exc = e.message;
    }
    if (exc === expected) return;
    if (expected[0] === '*' && exc.indexOf(expected.substr(1)) !== -1) return;

    throw new Error('Expected exception:\n' + expected + '\nbut got:\n' + exc);
}

function checkResult (expected, result) {
    if (result !== expected) throw new Error('Wrong result:\n' + result + '\ninstead of:\n' + expected);
}

function runTest () {
    rerouteConsole();

    basicTest();

    slowEmitErrorTest();
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    slowEmitTest();
    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    slowEmitTest();

    quickEmitErrorTest();
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    quickEmitTest();
    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    quickEmitTest();

    oldApiTest();
    setListenerMaxCountTest();
    nodebugTest();
    offDuringEmitTest();

    checkConsole(undefined); // catch any missed console error here

    console.log('Emitter test completed.');
}

runTest();
