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

//--- Multipurpose test listener

function Ear (id) {
    this.id = id;
    this.count = 0;
}

var hearingRecord = '';

Ear.prototype.onSignal1 = function () {
    this.count++;
    hearingRecord += '#' + this.id;
    if (arguments.length >= 1) {
        hearingRecord += '(' + Array.prototype.concat.apply([], arguments).join() + ')';
    }
};

function checkHearing (expected) {
    checkResult(expected, hearingRecord);
    hearingRecord = '';
}

//---

function basicTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
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
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();

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
    signaler.on('signal1', undefined);
    checkConsole('Invalid function parameter to emitter.on \'signal1\': undefined');
    signaler.on('signal1', signaler, function () {});
    checkConsole('Invalid listener parameter to emitter.on \'signal1\': function');
    signaler.on('signal1', function () {}, undefined);
    checkConsole('Invalid listener parameter to emitter.on \'signal1\': undefined');

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    checkException('Invalid function parameter to emitter.on \'signal1\': undefined', function () {
        signaler.on('signal1', undefined);
    });
    checkException('Invalid listener parameter to emitter.on \'signal1\': function', function () {
        signaler.on('signal1', signaler, function () {});
    });

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_ERROR);
    signaler.off('signalXXX', 'A');
    checkConsole('Invalid event ID: MySignaler.on(\'signalXXX\', fn, A)');
    signaler.off('signal1');
    checkConsole('Invalid parameter to emitter.off \'signal1\': undefined');

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
    signaler.on('signal1', fn); // on & addListener are synonyms
    signaler.removeListener('signal1', fn2); // coverage: remove unknow function when 1 listening function
    signaler.off('signal1', fn); // off & removeListener are synonyms; coverage: remove when 1 function
    signaler.addListener('signal1', fn); // synonym of "on"

    // listen twice is allowed if you don't use context and called setMaxListeners beforehand
    signaler.setMaxListeners(2);
    signaler.addListener('signal1', fn);
    checkResult(true, signaler.emit('signal1', 'hi'));
    checkResult(2, callCount);
    // Now call again - we have only 1 listener
    callCount = 0;
    signaler.removeListener('signal1', fn);
    checkResult(true, signaler.emit('signal1', 'hi'));
    checkResult(1, callCount);

    signaler.removeListener('signal1', fn2); // no effect if never set (and another function is listening)
    signaler.removeListener('signal1', fn);
    signaler.removeListener('signal1', fn); // no effect if already removed
    signaler.removeListener('signal1', fn);
    checkResult(false, signaler.emit('signal1', 'hey'));
    checkResult(1, callCount);

    signaler.setMaxListeners(1);
    signaler.on('signal1', fn);
    checkException('Too many listeners: MySignaler.on(\'signal1\', fn). Use MySignaler.setMaxListeners(n) with n >= 2. Even better: specify your listeners when calling "on"', function () {
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

    var ear1 = new Ear(1), ear2 = new Ear(2), ear3 = new Ear(3);
    signaler.setListenerMaxCount(2, ear1); // any Ear object is equivalent here
    signaler.on('signal1', function () {}, ear1);
    signaler.on('signal2', function () {}, ear1);
    signaler.on('signal1', function () {}, ear2);
    signaler.on('signal2', function () {}, ear2);
    checkException('Too many listeners: MySignaler.on(\'signal2\', fn, Ear). Use MySignaler.setListenerMaxCount(n, Ear) with n >= 3', function () {
        signaler.on('signal2', function () {}, ear3); // this is Ear #3 while we said only 2 can listen
    });
    signaler.forgetListener(ear1);
    signaler.forgetListener(ear2);
    signaler.forgetListener(ear3);
    signaler.on('signal1', function () {}, ear1);
    signaler.on('signal1', function () {}, ear2);
    signaler.off('signal1', ear2);
    signaler.on('signal1', function () {}, ear2);
    signaler.off('signal1', ear2);
    signaler.on('signal1', function () {}, ear2);
    checkException('Too many listeners: MySignaler.on(\'signal1\', fn, Ear). Use MySignaler.setListenerMaxCount(n, Ear) with n >= 3', function () {
        signaler.on('signal1', function () {}, ear3); // this is Ear #3 while we said only 2 can listen
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
 * What happens when adding/removing listeners during an emit on same event ID.
 */
function addRemoveDuringEmitTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();

    var ear1 = new Ear(1), ear2 = new Ear(2), ear3 = new Ear(3), ear4 = new Ear(4);

    ear1.onSignal1 = function () {
        signaler.forgetListener(this);
        signaler.on('signal1', Ear.prototype.onSignal1, ear3);
        signaler.off('signal1', ear4);
    };

    signaler.setListenerMaxCount(3, ear1);

    signaler.on('signal1', ear1.onSignal1, ear1);
    signaler.on('signal1', ear2.onSignal1, ear2);
    signaler.on('signal1', ear2.onSignal1, ear4);

    signaler.emit('signal1');
    // ear1 has been removed; ear2 is still listening; ear3 started listening; ear4 is gone
    // NB: depending on `respectSubscriberOrder` ear3 might be before (default) or after ear2 in listener list
    // This test does not care about this: see listenerOrderTest about that.
    checkResult(2, signaler.listenerCount('signal1'));

    // ear2 has been notified
    checkResult(1, ear2.count);
    // ear4 did not receive it because removed during emit on ear1; this behavior is a specification
    checkResult(0, ear4.count);

    var ear3count = ear3.count; // could be 0 or 1 since ear3 started listening during an "emit"

    // emit again and verify ear2 and ear3 are listening
    checkResult(true, signaler.emit('signal1'));
    checkResult(2, ear2.count);
    checkResult(ear3count + 1, ear3.count); // could be 1 or 2
}

function listenerOrderTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();

    signaler.setListenerMaxCount(10, new Ear());
    var ears = [];
    for (var i = 0; i < 10; i++) {
        ears.push(new Ear(i));
        signaler.on('signal1', Ear.prototype.onSignal1, ears[i]);
    }
    hearingRecord = ''; // clear previous tests
    signaler.emit('signal1');
    checkHearing('#0#1#2#3#4#5#6#7#8#9');

    EventEmitter.respectSubscriberOrder(true);

    signaler.forgetListener(ears[9]);
    signaler.forgetListener(ears[8]);
    signaler.forgetListener(ears[2]);
    signaler.emit('signal1');
    checkHearing('#0#1#3#4#5#6#7');

    signaler.on('signal1', Ear.prototype.onSignal1, ears[2]);
    signaler.on('signal1', Ear.prototype.onSignal1, ears[8]);
    signaler.on('signal1', Ear.prototype.onSignal1, ears[9]);
    signaler.emit('signal1');
    checkHearing('#0#1#3#4#5#6#7#2#8#9');

    EventEmitter.respectSubscriberOrder(false);

    signaler.forgetListener(ears[7]);
    signaler.on('signal1', Ear.prototype.onSignal1, ears[7]);
    signaler.emit('signal1');
    checkHearing('#0#1#7#3#4#5#6#2#8#9'); // Ear 7 took back the empty slot
}

function compactListTest () {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();

    signaler.setListenerMaxCount(6, new Ear());
    var ears = [];
    for (var i = 0; i < 6; i++) {
        ears.push(new Ear(i));
        signaler.on('signal1', Ear.prototype.onSignal1, ears[i]);
    }
    signaler.emit('signal1');
    checkHearing('#0#1#2#3#4#5');

    EventEmitter.respectSubscriberOrder(true);

    for (i = 0; i <= 4; i++) {
        signaler.forgetListener(ears[i]);
        signaler.on('signal1', Ear.prototype.onSignal1, ears[i]);
    }
    signaler.emit('signal1');
    checkHearing('#5#0#1#2#3#4');
    signaler.forgetListener(ears[0]);
    signaler.on('signal1', Ear.prototype.onSignal1, ears[0]);
    signaler.emit('signal1');
    checkHearing('#5#1#2#3#4#0');
    // "White box" test below to make sure we compacted the list of listeners
    // This is really implementation and settings dependent but I prefer checking it here
    checkResult(6, signaler._listenersPerEventId['signal1']._methods.length);

    EventEmitter.respectSubscriberOrder(false);
}

function onceTest (done) {
    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    var signaler = new MySignaler();
    var ear1 = new Ear(1), ear2 = new Ear(2), ear3 = new Ear(3);
    var fn2 = ear2.onSignal1.bind(ear2); // old style binding
    var fn3 = ear3.onSignal1.bind(ear3); // old style binding

    signaler.once('signal1', fn2);
    signaler.off('signal1', fn2); // coverage: removal of single function

    signaler.once('signal1', fn3);
    signaler.off('signal1', fn2); // coverage: removal of unknown function when 1 active
    signaler.off('signal1', fn3);
    signaler.off('signal1', fn3); // coverage: removal of unknown function when 0 active

    signaler.once('signal1', Ear.prototype.onSignal1, ear1);
    checkResult(true, signaler.emit('signal1', 'hi', 'ho'));
    checkResult(false, signaler.emit('signal1'));
    checkHearing('#1(hi,ho)');

    signaler.on('signal1', Ear.prototype.onSignal1, ear1);
    signaler.once('signal1', fn2);
    // ear3 below will be the 2nd Ear listening (Ear2 is listening through fn2 so signaler does not know Ear2)
    signaler.setListenerMaxCount(2, ear1);
    signaler.once('signal1', Ear.prototype.onSignal1, ear3);
    checkResult(true, signaler.emit('signal1', 'hi'));
    checkResult(true, signaler.emit('signal1'));
    checkHearing('#1(hi)#2(hi)#3(hi)#1');

    signaler.once('signal1', fn2);
    // This time we will have 2 functions listening to same eventId, so we need to increase the max for that:
    signaler.setMaxListeners(2);
    signaler.once('signal1', fn3);
    signaler.off('signal1', ear2); // does nothing of course
    checkResult(true, signaler.emit('signal1'));
    checkResult(true, signaler.emit('signal1'));
    checkHearing('#1#2#3#1');

    signaler.once('signal1', fn2);
    signaler.once('signal1', fn3);
    signaler.off('signal1', fn2);
    checkResult(true, signaler.emit('signal1'));
    checkResult(true, signaler.emit('signal1'));
    checkHearing('#1#3#1');
    signaler.off('signal1', fn2); // ignored: removed of already fired "once"

    signaler.once('signal1', Ear.prototype.onSignal1, ear2);
    setTimeout(function () {
        checkConsole('emitter.once \'signal1\' was not called before 5000ms timeout');
        done();
    }, 6000);
}


//---

var consoleErrors = [];

function rerouteConsoleError () {
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

function runSyncTests () {
    basicTest();
    slowEmitErrorTest();
    quickEmitErrorTest();
    oldApiTest();
    setListenerMaxCountTest();
    nodebugTest();
    addRemoveDuringEmitTest();
    listenerOrderTest();
    compactListTest();

    EventEmitter.setDebugLevel(EventEmitter.DEBUG_THROW);
    slowEmitTest();
    quickEmitTest();
    EventEmitter.setDebugLevel(EventEmitter.NO_DEBUG);
    slowEmitTest();
    quickEmitTest();
}

function runAsyncTests (done) {
    onceTest(done);
}

/**
 * Runs our tests (async)
 *
 * @param {function} done - called when tests finished with success
 */
function runTest (done) {
    rerouteConsoleError();

    runSyncTests();

    runAsyncTests(function finish () {
        checkConsole(undefined); // catch any missed console error here
        done();
    });
}

if (typeof window === 'undefined') {
    // Node.js (CLI, CI or coverage run)
    runTest(function done () {
        console.log('Emitter test completed.');
        process.exit(0);
    });
} else {
    // Run from browser
    exports.runTest = runTest;
}
