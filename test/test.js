var EventEmitter = require('../index.js');
var inherits = require('util').inherits;


function MySignaler () {
    EventEmitter.call(this);
    this.declareEvent('signal1');
    this.declareEvent('signal2');
    this.declareEvent('signal3');
    this.declareEvent('signal4');
}
inherits(MySignaler, EventEmitter);


MySignaler.prototype.emitEvent = function (eventId) {
    switch (eventId) {
    case 1: this.emit('signal1', 1, 2); break;
    case 2: this.emit('signal2', 'a', 'b'); break;
    case 3: this.emit('signal3', 11, '22', 1); break;
    case 4: this.emit('signal4', 11, '22', 33, 1); break;
    default: this.emit('non-declared');
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


function runTest () {
    var signaler = new MySignaler();
    var a = new MyListener(signaler, 'A');
    var b = new MyListener(signaler, 'B');
    var c = new AnotherListener(signaler);

    signaler.emitEvent(4);
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

    var exc;
    try {
        signaler.emitEvent(-1);
    } catch (e) {
        exc = e.message;
    }
    var expectedExc = 'Undeclared event ID for MySignaler: non-declared';
    if (exc !== expectedExc) throw new Error('Expected exception:\n' + expectedExc + '\nbut got:\n' + exc);

    console.log('Emitter test completed.');
}

runTest();
