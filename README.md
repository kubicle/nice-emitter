# nice-emitter
[![Version npm](https://img.shields.io/npm/v/nice-emitter.svg?style=flat-square)](https://www.npmjs.com/package/nice-emitter)[![Build Status](https://travis-ci.org/kubicle/nice-emitter.svg?branch=master)](https://travis-ci.org/kubicle/nice-emitter)

Finally an EventEmitter that does what I want... and maybe what *you* want too...

- often faster than many existing event emitters: benchmarked against [EventEmitter3](https://github.com/primus/eventemitter3), one of the fastest. Try it [in your browser](https://rawgit.com/kubicle/nice-emitter/master/test/index.html)!
- more object-friendly: listeners can be objects - no need to "bind" on listening methods anymore.
- you can stop listening "per listener": no more need to store each listener function so you can remove it later.
- helps you find leaks: debug counting allows each "class" of listeners to set its own maximum number.
- helps you avoid listening to inexistant events: emitter must declare which events it can emit, hence it can generate an error as soon as you try to listen to an invalid event.

Read below for more details about these...

## How nice-emitter will help you
Besides for its [speed](https://rawgit.com/kubicle/nice-emitter/master/test/index.html), why would you use nice-emitter?

### Context-passing and listener removal
How many times did you want to get a method to be called on a specific event, and had to "bind" for that?
```JavaScript
emitter.on('tap', this.myMethod.bind(this));
```
Cost:
- extra memory: for the binding function
- extra CPU: to create/compile the binding function, then to run it each time the event is emitted

To avoid some of the costs of "bind" you could also use a (rather ugly) `self` variable:
```JavaScript
var self = this;
emitter.on('tap', function () { self.myMethod(); });
```
Or with ES6:
```JavaScript
emitter.on('tap', () => this.myMethod());
```
...and this worked fine until you need to *remove* this listening function: to be able to remove it, you had to keep it *somewhere* from the start. So you ended-up doing:
```JavaScript
this.myListeningFunction = function () { self.myMethod(); };
emitter.on('tap', this.myListeningFunction);
...
emitter.off('tap', this.myListeningFunction); // off and removeListener are synonyms
```
When you had more than one listening function, it could quickly become cumbersome...

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
NB: the context-passing feature is also provided by EventEmitter3 (but not the extra APIs for removal).

### Easier debugging of your event emitting code

`nice-emitter` will help you find leaks by allowing each "class" of listeners to set its own maximum number.

Ever wondered why Node.js EventEmitter sets its "leak warning" limit to 10 by default?
This could be because this counting was designed wrong from the start.
In most systems, there will be 0 or 1 listener to a given type of events (2 would mean a leak), or a dozen listeners like when UI components listen to one of them (the limit to decide a leak would vary a lot).
What seems to be true for most systems is: *it is always easier to decide the right limit at listener-level than emitter-level*.
Hence, `nice-emitter` allows to set the limit "per listener class".
```JavaScript
emitter.setListenerMaxCount(5, this); // "this" or any instance of listener's class
```
Because this way of counting is more flexible, we can now set the default limit to `1`. This means you can detect leaks much earlier: back then you might have to run through faulty code 10 times to see the warning.

And for cases where you need `n` listeners of the same class `A`, you can call `emitter.setListenerMaxCount(n, new A())` and you will know as soon as `n + 1` listeners of class `A` are set. In the meantime, the limit remains 1 for your class `B` (imagine you have a singleton `B`).

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
Several of these are also not handled by [EventEmitter3](https://github.com/primus/eventemitter3).

In alphabetical order:
- `defaultMaxListeners`: this "max listeners" counting system is one of the reason why Node's EventEmitter is so clumsy to detect leaks. See how our `setListenerMaxCount` is making this easier.
- `getMaxListeners`: let me know why you need this.
- `listeners`: curious to see who used this and why... Maybe internal API for Node.js?
- `prependListener`: this API *could be* implemented, however... (a) relying on listener subscribing order is not a sign of a good design for your code, and (b) while you are relying on this order, starting to set one listener at beginning of the line seems like looking for more trouble. Maybe you need another way to manage the order of actions, a component dedicated to this goal (which is definitely not what event emitters were created for).
- `prependOnceListener`: such an interesting animal, combining my worries about both ordering and `once`...
- `rawListeners`: same remark as for `listeners` above.

Special events:
- Error handling by listening to `error` events: making sense in Node.js in some server applications, not for most other cases.
- Events `newListener` and `removeListener`: rarely needed.

### What is different
- `eventNames`: a bit too "dynamic"? You can use `listenerCount(eventId)` to see how many listeners for a given eventId. If you don't know which eventId you are interested in, you are probably in a kind of trouble already.
- `once`: since version 0.5, `nice-emitter` implements a `once` [API](#once-api) that tries to mitigate the issue of unexpected delay or missing notification. Why only worry about it for `once` and not for `on`? Read more about it [below](#once-is-not-wait)...
- `removeAllListeners`: who was supposed to call this API anyway? It looks more like a termination/cleanup method, to remove all dependencies before shutting down your app/system. If implemented later, should probably be named differently.
- Order of event reception by listeners: Node.js guarantees that your listeners will receive events in the order in which they started listening. This is also true for `nice-emitter`, until you remove some of them and add others (or add them back). If you really need this order, now is a good time to ask yourself why, because your design should normally not rely on that. If you still want it this way, call `EventEmitter.respectSubscriberOrder(true)` and order will be kept, at the expense of a bit more CPU and memory.

<a name="once-is-not-wait"></a>
### "Once is not your friend"
I believe that `once` is an anti-pattern. I could not find good article explaining this so here are my 2 cents: if you wanted *just to be notified once* then you could use the regular `on` and unsubscribe when your listener is called. I think the problem is more subtle and perhaps due in part to the English second meaning of the word "once": "as soon as". This encourages developers to use `once` as a way to *wait* for a given condition. From this misuse come all the issues I have seen so far:
- The original `once` API does not let you set a timeout, so you rarely find out when it took very long for your listener to be notified, or when this notification never came.
- If your app does not break from a missing notification, you can also end-up setting up a duplicate `once` listener later, and then good luck when the event comes...
- When you wait for something important, instead of a timeout, you might also need an "error callback" so you can be notified that whatever you are waiting for failed for good.

What should be done, in short? Instead of using `once` to react to the readiness of a service, or similar event with variable delay and outcome, we should use a specific API/component. Event emitters are not designed for this at the moment, at least not with the current specification.

### New API
See sample (above) and `test/test.js` for examples of how these are used.

#### declareEvent (eventId)
Declares an event for this emitter.
Event must be declared before `emit`, `on`, or any other event-related method is called for this event. This brings extra error checking and runtime efficiency.

#### getQuickEmitter (eventId)
Returns a "quick emitter" for a given event ID of this EventEmitter.
Using a quick emitter to emit is quite faster (if you are chasing fractions of milliseconds).
Returned object has methods `emit0`, `emit1`, `emit2`, `emit3` and `emitN`. You should call `quickEmitter.emit0()` if you have 0 extra parameters, and so on up to 3. If you have 4 or more parameters, you should call `emitN(...)` to which you can pass a random number of parameters (but note that this is obviously less efficient).

#### on (eventId, method, listener)
Similar to Node.js API except when optional third parameter is used.
If `listener` is passed, it will be passed as context (`this`) to the listening function when the event is emitted.
This same context can also be used later to remove listeners with `off` (see below).
Specifying your context when calling "on" is often much easier than having to track/store which functions you use to subscribe.
If you pass a context, `nice-emitter` also checks that the same event ID is not already subscribed to with same context.
Note that if `listener` is omitted, the context (`this`) passed to your listening function will be the EventEmitter (same as in Node.js).

<a name="once-api"></a>
#### once (eventId, method, listener, timeout)
Similar to Node.js API expect there is ALWAYS a timeout. The default timeout is set to a "human-scale" duration to help you debug your code when broken, hence a few seconds only.
If you are setting a "once" listener for an event that may-or-may-not come, you probably could use `on` without much trouble.
Expiration of the timeout just logs a `console.error`, so in a way one could wonder what big difference it makes. Well, having to think each time about *"How long should it wait?"* and *"What happens when it does not come on time?"* will probably help you designing a more robust logic.
The optional `listener` parameter works the same as in `on` (see above). If you really want the Node.js way, you should pass `undefined` here.
See also my rant about why [once is not your friend](#once-is-not-wait).

#### off (eventId, listener)
Similar to Node.js API except that if second parameter is not a function, it must be the "context" or listener used when you called `on`.

#### forgetListener (listener)
Unsubscribes the given listener (context) from all events of this emitter.

#### setListenerMaxCount (maxCount, listener)
Sets the limit listener count for *this* emitter and *listener class* objects.
Default is 1 for all classes when this API is not called.
If the limit is passed, an error is thrown or logged, unless debug level is set to `NO_DEBUG` (see `setDebugLevel` below).
NB: you can pass any instance of listener's class.

#### EventEmitter.setDebugLevel (level)
Sets debug level. `level` must be one of:
- `EventEmitter.DEBUG_THROW`: Debug checks & counting. Errors are thrown. Helps you debug your code by crashing early. This is the default level, except if code is minified.
- `EventEmitter.DEBUG_ERROR`: Debug checks & counting. Errors go to `console.error` but execution continues as normally as possible.
- `EventEmitter.NO_DEBUG`: No counting, no checks except those that avoid crashes. The fastest level, with minimum memory usage. If your code is minified, NO_DEBUG is automatically the default (no need to call `setDebugLevel`).
