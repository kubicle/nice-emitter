# nice-emitter
Finally an EventEmitter that does what I want... and maybe what *you* want too...

- more object-friendly: listeners can be objects - no need to "bind" on listening methods anymore.
- helps you find leaks: debug counting allows each "class" of listeners to set its own maximum number.
- stop listening "per listener": no more need to keep each listener function so you can remove it later.
- helps you avoid listening to inexistant events: emitter MUST declare which events it can emit.
- often faster than many existing event emitters: benchmarked against EventEmitter3, one of the fastest.

Sample:
```JS
var EventEmitter = require('nice-emitter');
var inherits = require('util').inherits;

/**
 * A class that inherits from EventEmitter
 * and emits 2 events: 'signal1' and 'signal2'
 **/
function MySignaler () {
    EventEmitter.call(this);
    this.declareEvent('signal1');
    this.declareEvent('signal2');
}
inherits(MySignaler, EventEmitter);

MySignaler.prototype.methodWhichEmits = function () {
    this.emit('signal1', someParameter);
};

MySignaler.prototype.otherMethodWhichEmits = function () {
    this.emit('signal2');
};

...

var signaler = new MySignaler();


//--- Somewhere else, a listener...

MyListener.prototype.startListening = function () {
    signaler.on('signal1', this.method1, this);
    signaler.on('signal2', this.method2, this);
};

MyListener.prototype.stopListening = function () {
    signaler.forgetListener(this);
};

MyListener.prototype.method1 = function (someParameter) {
    ...
};

MyListener.prototype.method2 = function () {
    ...
};
```
