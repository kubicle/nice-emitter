# nice-emitter
[![Version npm](https://img.shields.io/npm/v/nice-emitter.svg?style=flat-square)](https://www.npmjs.com/package/nice-emitter)[![Build Status](https://travis-ci.org/kubicle/nice-emitter.svg?branch=master)](https://travis-ci.org/kubicle/nice-emitter)[![Dependencies](https://img.shields.io/david/kubicle/nice-emitter.svg)](https://david-dm.org/kubicle/nice-emitter)<a href="https://codeclimate.com/github/kubicle/nice-emitter/test_coverage"><img src="https://api.codeclimate.com/v1/badges/45b1a8464d385e78e6a6/test_coverage" /></a>

Finally an EventEmitter that does what I want... and maybe what *you* want too...

- often faster than many existing event emitters: benchmarked against [EventEmitter3](https://github.com/primus/eventemitter3), one of the fastest.
- more object-friendly: listeners can be objects - no need to "bind" on listening methods anymore.
- stop listening "per listener": no more need to keep each listener function so you can remove it later.
- helps you find leaks: debug counting allows each "class" of listeners to set its own maximum number.
- helps you avoid listening to inexistant events: emitter MUST declare which events it can emit.

Read below for more details about these...

## How nice-emitter will help you
Besides for its speed, why would you use nice-emitter?

### Context-passing and listener removal
How many times did you want to get a method to be called on a specific event, and had to "bind" for that?
```JavaScript
emitter.on('tap', this.myMethod.bind(this));
```
Cost:
- extra memory: for the binding function
- extra CPU: to create/compile the binding function, then to run it each time the event is emitted

To avoid some of the costs of "bind" you could also use a pretty ugly "self" variable:
```JavaScript
var self = this;
emitter.on('tap', function () { self.myMethod(); });
```
Or with ES6:
```JavaScript
emitter.on('tap', () => this.myMethod());
```
...and this worked fine until you needed to *remove* this listening function.
To be able to remove a listening function, you had to keep it *somewhere* from the start. So you ended-up doing:
```JavaScript
this.myListeningFunction = function () { self.myMethod(); };
emitter.on('tap', this.myListeningFunction);
...
emitter.off('tap', this.myListeningFunction); // off and removeListener are synonyms
```
When you had more than one listening functions it could quickly become verbose...

#### With `nice-emitter` you simply can do:
```JavaScript
emitter.on('tap', this.myMethod, this); // "this" will be passed as context to myMethod
...
emitter.off('tap', this.myMethod);
```
Actually you have 2 more ways to stop listening:
```JavaScript
emitter.off('tap', this); // by passing the same context ("this") given to "on" earlier
```
```JavaScript
emitter.forgetListener(this); // accross ALL events for "this" context
```
NB: the context-passing feature is also provided by EventEmitter3 (but not the extra API for removal).

### Easier debugging of your event emitting code

`nice-emitter` will help you find leaks by allowing each "class" of listeners to set its own maximum number.

Ever wondered why Node.js EventEmitter sets its "leak warning" limit to 10 by default?
This could be because this counting was designed wrongly from the start.
In most systems, there will be 0 or 1 listener to a given type of events (2 would mean a leak), or a dozen listeners like when UI components listen to one of them (the limit to decide a leak would varry a lot).
What seems to be true for most systems is: it is always easier to decide the right limit at listener level than emitter level.
Hence, `nice-emitter` allows to set the limit "per listener" class.
```JavaScript
emitter.setListenerMaxCount(5, this); // "this" or any instance of listener's class
```
Because we can now be as granular as needed, default limit is set to `1`. This means you only have to run a given code twice to detect a leak.

#### No more listening to nonexistent events
With all EventEmitter implementations I have seen so far, you can listen to an *inexistant* event forever. Nothing will happen until you find your bug. This is surprising because there was a very cheap way for doing this at EventEmitter's level: simply by having each legit event *declared*.
And yes, if you work on one of these codebases where dynamicaly generated event names are used as a kind of "late-binding", you are in trouble anyway, sorry.


## Sample
```JavaScript
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
    ... // signaler will pass "this" as expected
};

MyListener.prototype.method2 = function () {
    ... // signaler will pass "this" as expected
};
```

## Comparison with Node.js EventEmitter
(as of Node V10.8.0; doc found at https://nodejs.org/api/events.html)
The paragraphs below should help you answer the question:

*"I am already using an EventEmitter in my project; can I use nice-emitter instead?"*

In most cases the answer should be "YES!" and I believe you will not regret this change.

### What is not implemented
Several of these are also not handled by [EventEmitter3](https://github.com/primus/eventemitter3). The most important one is maybe `once`, which was left-out voluntarily.

In alphabetical order:
- `defaultMaxListeners`: this "max listeners" counting system is one of the reason why Node's EventEmitter is so clumsy to detect leaks. See how our `setListenerMaxCount` is making this easier.
- `getMaxListeners`: let me know why you need this.
- `listeners`: curious to see who used this and why... Maybe internal API for Node.js?
- `once`: I believe it `once` is an anti-pattern. I will try to find links about this and post them, or write myself why I think so.
- `prependListener`: oops, I did not know this exists before reading the doc again in details... If someone out there really needs it, it can be added without much effort.
- `prependOnceListener`: see paragraph about `once` above.
- `rawListeners`: same remark as for `listeners` above.

Special events:
- Error handling by listening to `error` events: making sense in Node.js in some server applications, not for most other cases.
- Events `newListener` and `removeListener`: rarely needed.

### What is different
- `eventNames`: a bit too "dynamic"? You can use `listenerCount(eventId)` to see how many listeners for a given eventId. If you don't know which eventId you are interested in, you are probably in a kind of trouble already.
- `removeAllListeners`: who was supposed to call this API anyway? It looks more like a termination/cleanup method, to remove all dependencies before shutting down your app/system. If implemented later, should probably be named differently.
- `removeListener`: `nice-emitter` does not allow removing while the same event is being emitted. The effort done in Node.js to obtain a "defined behavior" is respectable, but for common humans (aka coders...) there must be very few cases in which you want your system to juggle with this kind of complexity.
