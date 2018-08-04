# nice-emitter

[![Build Status](https://travis-ci.org/kubicle/nice-emitter.svg?branch=master)](https://travis-ci.org/kubicle/nice-emitter)<a href="https://codeclimate.com/github/kubicle/nice-emitter/test_coverage"><img src="https://api.codeclimate.com/v1/badges/45b1a8464d385e78e6a6/test_coverage" /></a>

Finally an EventEmitter that does what I want... and maybe what *you* want too...

- more object-friendly: listeners can be objects - no need to "bind" on listening methods anymore.
- helps you find leaks: debug counting allows each "class" of listeners to set its own maximum number.
- stop listening "per listener": no more need to keep each listener function so you can remove it later.
- helps you avoid listening to inexistant events: emitter MUST declare which events it can emit.
- often faster than many existing event emitters: benchmarked against [EventEmitter3](https://github.com/primus/eventemitter3), one of the fastest.

## Sample
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

## Comparison with Node.js EventEmitter
(as of Node V10.8.0; doc found at https://nodejs.org/api/events.html)

### What is not implemented
- Error handling by listening to `error` events: making sense in Node.js in some server applications, not for most other cases.
- Events `newListener` and `removeListener`: as [EventEmitter3](https://github.com/primus/eventemitter3)'s developer pointed out, these are rarely used.
- `defaultMaxListeners`: this "max listeners" counting system is one of the reason why Node's EventEmitter is so clumsy to detect leaks. See how our `setListenerMaxCount` is making this easier.
- `getMaxListeners`: let me know why you need this.
- `listeners`: curious to see who used this and why... Maybe internal API for Node.js?
- `once`: I believe it `once` is an anti-pattern. I will try to find links about this and post them, or write myself why I think so.
- `prependListener`: oops, I did not know this exists before reading the doc again in details... If someone out there really needs it, it can be added without much effort.
- `prependOnceListener`: see paragraph about `once` above.
- `rawListeners`: same remark as for `listeners` above.

### What is different
- `eventNames`: a bit too "dynamic"? You can use `listenerCount(eventId)` to see how many listeners for a given eventId. If you don't know which eventId you are interested in, you are probably in a kind of trouble already.
- `removeAllListeners`: who was supposed to call this API anyway? It looks more like a termination/cleanup method, to remove all dependencies before shutting down your app/system. If implemented later, should probably be named differently.
- `removeListener`: `nice-emitter` does not allow removing while the same event is being emitted. The effort done in Node.js to obtain a "defined behavior" is respectable, but for common humans (aka coders...) there must be very few cases in which you want your system to juggle with this kind of complexity.
