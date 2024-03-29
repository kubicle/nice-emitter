(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

/**
 * Nice EventEmitter
 * - more object-friendly: listeners can be objects (i.e. no need to "bind" on listening methods)
 * - easier to find leaks: debug counting allows each "class" of listeners to set its own maximum number
 * - easier to stop listening: per listener (i.e. no need to keep track of each "on" so you can "remove" later)
 * - easier to avoid mistake of listening to inexistant event: emitter MUST declare which events it can emit
 * - often faster than many existing event emitters
 */
function EventEmitter () {
    this._listenersPerEventId = {};

    if (debugLevel > 0) {
        this._maxCountPerListenerKey = {};
    }
}
module.exports = EventEmitter;


// Debug levels

/**
 * Debug checks & counting. Errors are thrown. Helps you debug your code by crashing early.
 * This is the default level, except if code is minified.
 */
EventEmitter.DEBUG_THROW = 2;

/**
 * Debug checks & counting. Errors go to `console.error` but execution continues as normally as possible.
 */
EventEmitter.DEBUG_ERROR = 1;

/**
 * No counting, no checks except those that avoid crashes.
 * The fastest level, with minimum memory usage.
 * If your code is minified, NO_DEBUG is automatically the default (no need to call `setDebugLevel`).
 * NB: counting based on class names would have issues when 2 minified classes end-up with the same name.
 */
EventEmitter.NO_DEBUG = 0;


// Set default. NO_DEBUG if minified, DEBUG_THROW otherwise. (see above)
var debugLevel = getObjectClassname(new EventEmitter()) !== 'EventEmitter'
    ? EventEmitter.NO_DEBUG
    : EventEmitter.DEBUG_THROW;

/**
 * Sets debug level. See comments about debug levels.
 *
 * @param {number} level - EventEmitter.NO_DEBUG, EventEmitter.DEBUG_ERROR, or EventEmitter.DEBUG_THROW
 */
EventEmitter.setDebugLevel = function (level) {
    debugLevel = level;
};

var respectSubscriberOrder = false;

/**
 * Forces listener to be notified in the order in which they subscribed, at the expense of a bit more CPU and memory.
 * By default his order is not guaranteed.
 *
 * @param {boolean} shouldRespect
 */
EventEmitter.respectSubscriberOrder = function (shouldRespect) {
    respectSubscriberOrder = shouldRespect;
};


//--- Emitter side

/**
 * Declares an event for this emitter.
 * Event must be declared before `emit`, `on`, or other method is called for this event ID.
 *
 * @param {string} eventId
 */
EventEmitter.prototype.declareEvent = function (eventId) {
    if (this._listenersPerEventId[eventId] !== undefined) {
        return throwOrConsole('Event ID declared twice: ', getAsText(this, eventId));
    }

    this._listenersPerEventId[eventId] = new ListenerList(this, eventId);
};

/**
 * Notifies each listener which subscribed to given eventId.
 * Optional parameters are passed.
 *
 * @param {string} eventId
 * @param {*} [p1]
 * @param {*} [p2]
 * @param {*} [p3] - there can be more than 3 parameters
 * @returns {boolean} false if no listeners are registered.
 */
EventEmitter.prototype.emit = function (eventId, p1, p2, p3) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
        return false;
    }

    switch (arguments.length) {
    case 1: return listenerList.emit0();
    case 2: return listenerList.emit1(p1);
    case 3: return listenerList.emit2(p1, p2);
    case 4: return listenerList.emit3(p1, p2, p3);
    default: return listenerList.emitN.apply(listenerList, [].slice.call(arguments, 1));
    }
};

/**
 * Returns a "quick emitter" for a given event ID of this EventEmitter.
 * Using a quick emitter to emit is quite faster (if you are chasing fractions of milliseconds).
 *
 * @param {string} eventId - declared event ID for which you want to "quick emit"
 * @returns {QuickEmitter} - an object with methods emit0, emit1, emit2, emit3 and emitN
 */
EventEmitter.prototype.getQuickEmitter = function (eventId) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        return throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
    }
    return listenerList;
};

/**
 * Tells how many listeners are currently subscribed to given event ID.
 *
 * @param {string} eventId
 * @returns {number} number of listeners on this specific event
 */
EventEmitter.prototype.listenerCount = function (eventId) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        return throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
    }
    return listenerList._count;
};


//--- Listener side

/**
 * Subscribes to an event.
 *
 * @param {string} eventId
 * @param {function} method - can be a simple function too
 * @param {object|string|undefined} listener - if not passed, emitter will be passed as context when event occurs
 * @returns {EventEmitter} this
 */
EventEmitter.prototype.on = function (eventId, method, listener) {
    var listenerList = this._listenersPerEventId[eventId];
    if (!listenerList) return throwOrConsole('Invalid event ID: ', getAsText(this, eventId, listener)), this;

    if (debugLevel > 0) {
        if (arguments.length >= 3 && (!listener || typeof listener === 'function')) {
            return throwOrConsole('Invalid listener parameter to emitter.on \'' + eventId + '\': ', typeof listener), this;
        }
        if (typeof method !== 'function') {
            return throwOrConsole('Invalid function parameter to emitter.on \'' + eventId + '\': ', typeof method), this;
        }
        listenerList._countListener(listener || this, listener || null);
    }
    listenerList._addListener(listener || this, method);
    return this;
};
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

/**
 * Unsubscribes from an event.
 * Specifying your listeners when calling "on" is often much easier
 * than having to track/store which functions you passed when subscribing.
 *
 * @param {string} eventId
 * @param {object|string|function} listener - same "listener" you passed when you called "on"
 */
EventEmitter.prototype.off = function (eventId, listener) {
    var listenerList = this._listenersPerEventId[eventId];
    if (!listenerList) return throwOrConsole('Invalid event ID: ', getAsText(this, eventId, listener));

    if (typeof listener === 'function') {
        // Old API compatibility
        var indexFn = listenerList._findMethod(listener);
        if (indexFn !== -1) {
            listenerList._removeListener(indexFn, null);
        } else if (listener._hasNiceEmitterOnce) {
            this._removeOnceListener(listenerList, listener);
        }
    } else {
        var index = listenerList._findListener(listener);
        if (index !== -1) {
            listenerList._removeListener(index, listener);
        } else if (debugLevel > 0 && !listener) {
            return throwOrConsole('Invalid parameter to emitter.off \'' + eventId + '\': ', listener);
        }
    }
};
EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

/**
 * Old API compatibility
 * @deprecated `once` is not your friend.
 * @param {string} eventId
 * @param {function} method - can be a simple function too
 * @param {object|string|undefined} listener - if not passed, emitter will be passed as context when event occurs
 * @param {number} [timeoutMs] - if not passed, a "human-debugging" value of 5 seconds will be used.
 *                               If timeout expires before the event occurs, a simple console.error is logged.
 */
EventEmitter.prototype.once = function (eventId, method, listener, timeoutMs) {
    method._hasNiceEmitterOnce = true;

    timeoutMs = timeoutMs || 5000;
    var timeout = setTimeout(function () {
        console.error('emitter.once \'' + eventId + '\' was not called before ' + timeoutMs + 'ms timeout');
    }, timeoutMs);

    var emitter = this;
    function hopFunc () {
        if (listener) {
            emitter.off(eventId, listener);
        } else {
            emitter.off(eventId, hopFunc);
        }
        clearTimeout(timeout);

        method.apply(this, arguments); // "this" and arguments will be passed correctly by emitter
    }
    hopFunc._timeout = timeout;
    hopFunc._method = method;

    if (listener) {
        this.on(eventId, hopFunc, listener);
    } else {
        this.on(eventId, hopFunc);
    }
};

// Only used when caller does `emitter.off(eventId, func)` of a previously `emitter.once(eventId, func)`
EventEmitter.prototype._removeOnceListener = function (listenerList, method) {
    var hopFunc, indexFn = -1;
    var methods = listenerList._methods;
    if (methods === null) return; // not listening; safe to ignore
    if (typeof methods === 'function') {
        if (methods._method === method) hopFunc = methods; // indexFn not needed here
    } else {
        for (var i = 0; i < methods.length; i++) {
            var m = methods[i];
            if (m && m._method === method) {
                hopFunc = m;
                indexFn = i;
                break;
            }
        }
    }
    if (!hopFunc) return; // happens if "once" has already fired before being removed; safe to ignore
    listenerList._removeListener(indexFn, null);
    clearTimeout(hopFunc._timeout);
}

/**
 * Unsubscribes the given listener (context) from all events of this emitter
 *
 * @param {object|string} listener
 */
EventEmitter.prototype.forgetListener = function (listener) {
    for (var eventId in this._listenersPerEventId) {
        this.off(eventId, listener);
    }
};

/**
 * Sets the limit per event ID of listeners for this emitter and listener class objects.
 * Default is 1 for all classes when this API is not called.
 * If the maximum is reached, an error is thrown or logged.
 * Does nothing if debug level is NO_DEBUG.
 *
 * @param {number} maxCount
 * @param {object|string} listener
 */
EventEmitter.prototype.setListenerMaxCount = function (maxCount, listener) {
    if (debugLevel === 0) return;
    if (!(maxCount > 0) || !listener) {
        return throwOrConsole('Invalid parameters to emitter.setListenerMaxCount: ', maxCount + ', ' + listener);
    }
    this._maxCountPerListenerKey[getObjectClassname(listener)] = maxCount;
};

/**
 * Old API compatibility.
 * Sets a maximum count (default is 1) of listeners that can subscribe to 1 event ID.
 * This limit applies when `on` or `addListener` are called without `listener` parameter.
 * If the maximum is reached, an error is thrown or logged.
 * Does nothing if debug level is NO_DEBUG.
 *
 * @param {number} maxCount
 */
EventEmitter.prototype.setMaxListeners = function (maxCount) {
    if (debugLevel === 0) return;
    if (!(maxCount > 0) || arguments.length > 1) {
        return throwOrConsole('Invalid parameters to emitter.setMaxListeners: ', maxCount + (arguments[1] !== undefined ? ', ' + arguments[1] : ''));
    }
    this._maxCountPerListenerKey[DEFAULT_LISTENER] = maxCount;
};


//--- Private helpers

/**
 * Internal implementation of a "single eventID" emitter to a list of listeners.
 * A ListenerList can be returned to outside world for "quick emit" purpose.
 *
 * @param {EventEmitter} emitter
 * @param {string} eventId
 */
function ListenerList (emitter, eventId) {
    this._count = 0; // count of "listeners"
    this._methods = null; // null, function, or array of functions
    this._objects = null; // null, context, or array of contexts

    if (debugLevel > 0) {
        this._emitter = emitter; // our parent EventEmitter
        this._eventId = eventId;
        this._counterMap = null; // key: listenerKey, value: count of listeners with same listenerKey
    }
}

ListenerList.prototype._addListener = function (context, method) {
    if (this._methods === null) {
        // 0 -> 1
        this._count = 1;
        this._methods = method;
        this._objects = context;
    } else if (typeof this._methods !== 'function') {
        // n -> n+1 (n >= 0) # Array already exists
        var index = this._methods.length;
        if (index !== this._count) {
            if (index > 5 && index > this._count * 2) {
                this._compactList(this._count + 1);
                index = this._count;
            } else if (respectSubscriberOrder) {
                while (index >= 1 && !this._methods[index - 1]) index--;
            } else {
                for (index = 0; this._methods[index]; index++) ; // this._methods.indexOf(null) seems slower
            }
        }
        this._methods[index] = method;
        this._objects[index] = context;
        this._count++;
    } else {
        // 1 -> 2 # Array creation
        this._count = 2;
        this._methods = [this._methods, method];
        this._objects = [this._objects, context];
    }
};

ListenerList.prototype._compactList = function (size) {
    var methods = new Array(size), objects = new Array(size);
    for (var i = 0, j = 0; j < this._count; i++) {
        if (this._methods[i]) {
            methods[j] = this._methods[i];
            objects[j++] = this._objects[i];
        }
    }
    this._methods = methods;
    this._objects = objects;
};

ListenerList.prototype._findListener = function (listener) {
    if (typeof this._methods === 'function') {
        return this._objects === listener ? 0 : -1;
    } else {
        return this._objects !== null ? this._objects.indexOf(listener) : -1;
    }
};

ListenerList.prototype._findMethod = function (method) {
    if (typeof this._methods === 'function') {
        return this._methods === method ? 0 : -1;
    } else {
        return this._methods !== null ? this._methods.indexOf(method) : -1;
    }
};

ListenerList.prototype._removeListener = function (index, listener) {
    this._count--;
    if (typeof this._methods === 'function') {
        this._methods = null;
        this._objects = null;
    } else {
        this._methods[index] = null;
        this._objects[index] = null;
    }

    if (debugLevel > 0) {
        var listenerKey = getObjectClassname(listener);
        this._counterMap[listenerKey]--;
    }
};

// Only used if debugLevel > 0
ListenerList.prototype._countListener = function (context, listener) {
    var listenerKey = getObjectClassname(listener);

    var currentCount;
    if (!this._counterMap) {
        this._counterMap = { 0: 0 };
        currentCount = 1;
    } else {
        currentCount = (this._counterMap[listenerKey] || 0) + 1
    }

    var maxListenerCount = this._emitter._maxCountPerListenerKey[listenerKey] || 1;
    if (currentCount > maxListenerCount) {
        var msg = 'Too many listeners: ' + getAsText(this._emitter, this._eventId, listener) + '. ';
        var advice = listener
            ? 'Use ' + getObjectClassname(this._emitter) + '.setListenerMaxCount(n, ' + listenerKey + ') with n >= ' + currentCount
            : 'Use ' + getObjectClassname(this._emitter) + '.setMaxListeners(n) with n >= ' + currentCount + '. Even better: specify your listeners when calling "on"';
        throwOrConsole(msg, advice); // if console we can continue below
    }
    this._counterMap[listenerKey] = currentCount; // not done if exception above
    // Same listener should not listen twice to same event ID (does not apply to "undefined" listener)
    // NB: this._count is not yet updated at this point, hence this._count >= 1 below (instead of 2)
    if (currentCount >= 2 && this._count >= 1 && context === listener && this._findListener(listener) !== -1) {
        throwOrConsole('Listener listens twice: ', getAsText(this._emitter, this._eventId, listener));
    }
};

ListenerList.prototype.emit0 = function () {
    if (this._count === 0) return false; // 0 listeners

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects);
    } else {
        var methods = this._methods, objects = this._objects, len = this._methods.length;
        for (var i = 0; i < len; i++) { var m = methods[i]; m && m.call(objects[i]); }
    }

    return true;
};

ListenerList.prototype.emit1 = function (arg1) {
    if (this._count === 0) return false; // 0 listeners

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects, arg1);
    } else {
        var methods = this._methods, objects = this._objects, len = this._methods.length;
        for (var i = 0; i < len; i++) { var m = methods[i]; m && m.call(objects[i], arg1); }
    }

    return true;
};

ListenerList.prototype.emit2 = function (arg1, arg2) {
    if (this._count === 0) return false; // 0 listeners

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects, arg1, arg2);
    } else {
        var methods = this._methods, objects = this._objects, len = this._methods.length;
        for (var i = 0; i < len; i++) { var m = methods[i]; m && m.call(objects[i], arg1, arg2); }
    }

    return true;
};

ListenerList.prototype.emit3 = function (arg1, arg2, arg3) {
    if (this._count === 0) return false; // 0 listeners

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects, arg1, arg2, arg3);
    } else {
        var methods = this._methods, objects = this._objects, len = this._methods.length;
        for (var i = 0; i < len; i++) { var m = methods[i]; m && m.call(objects[i], arg1, arg2, arg3); }
    }

    return true;
};

ListenerList.prototype.emitN = function () {
    if (this._count === 0) return false; // 0 listeners

    if (typeof this._methods === 'function') {
        this._methods.apply(this._objects, arguments);
    } else {
        var methods = this._methods, objects = this._objects, len = this._methods.length;
        for (var i = 0; i < len; i++) { var m = methods[i]; m && m.apply(objects[i], arguments); }
    }

    return true;
};

//---

/* eslint no-console: 0 */

function throwOrConsole (msg, info) {
    if (debugLevel >= EventEmitter.DEBUG_THROW) throw new Error(msg + info);
    console.error(msg + info);
}

var DEFAULT_LISTENER = 0; // Using 0 is a bit faster for old API when in debug mode

function getObjectClassname (listener) {
    if (!listener) return DEFAULT_LISTENER;
    if (typeof listener === 'string') return listener;
    var constr = listener.constructor;
    return constr.name || constr.toString().split(/ |\(/, 2)[1];
}

function getAsText (emitter, eventId, listener) {
    if (!listener || typeof listener === 'function') {
        return getObjectClassname(emitter) + '.on(\'' + eventId + '\', fn)';
    } else {
        return getObjectClassname(emitter) + '.on(\'' + eventId + '\', fn, ' + getObjectClassname(listener) + ')';
    }
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"_process":3,"inherits":2}],6:[function(require,module,exports){
(function (process){(function (){
/**
 * This simple benchmark is measuring nice-emitter against EventEmitter3 (EE3),
 * using a subset of EE3's own benchmark.
 * EventEmitter3 (Copyright (c) 2014 Arnout Kazemier) is one of the best version out there, IMHO.
 * It is also EventEmitter3 which implemented some of the features I wanted since so long,
 * for example the "context" object associated to each listener.
 */

 'use strict';
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

}).call(this)}).call(this,require('_process'))
},{"../index.js":1,"_process":3,"eventemitter3":8,"nice-emitter":9}],7:[function(require,module,exports){
'use strict';

var runBenchmark = require('./benchmark').runBenchmark;
var runTest = require('./test').runTest;

var logDiv;


function createDom() {
    setMeta('viewport', 'width=device-width, initial-scale=1');

    createDiv(document.body, 'title', 'nice-emitter Benchmark');
    createDiv(document.body, 'infos', 'EE3 = EventEmitter3');
    createDiv(document.body, 'infos', 'NE = nice-emitter (Quick = using a quick emitter)');
    createDiv(document.body, 'infos', 'Each test runs 3 times.');

    logDiv = createDiv(document.body, 'logDiv');

    var usedHeight = document.body.clientHeight;
    var viewportHeight = document.documentElement.clientHeight;
    logDiv.style.height = (viewportHeight - usedHeight - 32) + 'px';
}

function setMeta (name, content) {
    var meta = document.head.getElementsByTagName('meta')[name];
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
}

function createDiv (parent, className, txt) {
    var div = document.createElement('div');
    div.className = className;
    parent.appendChild(div);
    if (txt) div.innerText = txt;
    return div;
}

function logLine (msg) {
    console.log(msg);

    var div = createDiv(logDiv, 'logLine', msg);
    scrollToBottom();
    return div;
}

function logSection (title) {
    createDiv(logDiv, 'section', title);
    scrollToBottom();
}

function logResult (result) {
    var line = logLine(result.msg);
    var className;
    if (result.factor === 0) { // factor is 0 for EE3
        className = 'ref';
    } else if (result.factor < 1) {
        className = 'warning';
    } else if (result.factor >= 1.5) {
        className = 'super';
    } else {
        className = 'better';
    }
    line.className += ' ' + className;
}

function logError (e) {
    var msg = '' + e;
    var stack = (e && e.stack) || '';
    var stackLines = stack.split(/\n|\r\n/);

    console.error(msg);
    console.error(stack);

    createDiv(logDiv, 'logLine error', msg);
    for (var i = 0; i <= 3; i++) {
        createDiv(logDiv, 'logLine', stackLines[i]);
    }
    scrollToBottom();
}

function scrollToBottom () {
    logDiv.scrollTop = logDiv.scrollHeight;
};

function runItAll () {
    createDom();

    // NB: code in test.js will for sure de-optimize nice-emitter, so we MUST run benchmark.js first
    setTimeout(runOneStep, 100);
}

var stepNames = ['Benchmark DEBUG', 'Benchmark PROD', 'Test / coverage']
var step = 0;
var subStep = 0;

function runOneStep () {
    try {
        if (subStep === 0) logSection(stepNames[step]);
        var result = null;

        switch (step) {
        case 0:
            result = runBenchmark(subStep++, /*isProd=*/false);
            break;
        case 1:
            result = runBenchmark(subStep++, /*isProd=*/true);
            break;
        case 2:
            runTest(function done () {
                logLine('Completed.')
            });
            return; // last step => nothing else to schedule
        }

        if (result !== null) {
            logResult(result);
        } else {
            step++;
            subStep = 0;
        }
        setTimeout(runOneStep, 50);
    } catch (e) {
        logError(e);
    }
}

runItAll();

},{"./benchmark":6,"./test":10}],8:[function(require,module,exports){
'use strict';

var has = Object.prototype.hasOwnProperty
  , prefix = '~';

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */
function Events() {}

//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
  Events.prototype = Object.create(null);

  //
  // This hack is needed because the `__proto__` property is still inherited in
  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
  //
  if (!new Events().__proto__) prefix = false;
}

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener(emitter, event, fn, context, once) {
  if (typeof fn !== 'function') {
    throw new TypeError('The listener must be a function');
  }

  var listener = new EE(fn, context || emitter, once)
    , evt = prefix ? prefix + event : event;

  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  else emitter._events[evt] = [emitter._events[evt], listener];

  return emitter;
}

/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */
function clearEvent(emitter, evt) {
  if (--emitter._eventsCount === 0) emitter._events = new Events();
  else delete emitter._events[evt];
}

/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */
function EventEmitter() {
  this._events = new Events();
  this._eventsCount = 0;
}

/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */
EventEmitter.prototype.eventNames = function eventNames() {
  var names = []
    , events
    , name;

  if (this._eventsCount === 0) return names;

  for (name in (events = this._events)) {
    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
  }

  if (Object.getOwnPropertySymbols) {
    return names.concat(Object.getOwnPropertySymbols(events));
  }

  return names;
};

/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  var evt = prefix ? prefix + event : event
    , handlers = this._events[evt];

  if (!handlers) return [];
  if (handlers.fn) return [handlers.fn];

  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
    ee[i] = handlers[i].fn;
  }

  return ee;
};

/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */
EventEmitter.prototype.listenerCount = function listenerCount(event) {
  var evt = prefix ? prefix + event : event
    , listeners = this._events[evt];

  if (!listeners) return 0;
  if (listeners.fn) return 1;
  return listeners.length;
};

/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return false;

  var listeners = this._events[evt]
    , len = arguments.length
    , args
    , i;

  if (listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return addListener(this, event, fn, context, false);
};

/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  return addListener(this, event, fn, context, true);
};

/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return this;
  if (!fn) {
    clearEvent(this, evt);
    return this;
  }

  var listeners = this._events[evt];

  if (listeners.fn) {
    if (
      listeners.fn === fn &&
      (!once || listeners.once) &&
      (!context || listeners.context === context)
    ) {
      clearEvent(this, evt);
    }
  } else {
    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
      if (
        listeners[i].fn !== fn ||
        (once && !listeners[i].once) ||
        (context && listeners[i].context !== context)
      ) {
        events.push(listeners[i]);
      }
    }

    //
    // Reset the array, or remove it completely if we have no more listeners.
    //
    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
    else clearEvent(this, evt);
  }

  return this;
};

/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  var evt;

  if (event) {
    evt = prefix ? prefix + event : event;
    if (this._events[evt]) clearEvent(this, evt);
  } else {
    this._events = new Events();
    this._eventsCount = 0;
  }

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
  module.exports = EventEmitter;
}

},{}],9:[function(require,module,exports){
'use strict';
/**
 * Nice EventEmitter
 * - more object-friendly: listeners can be objects (i.e. no need to "bind" on listening methods)
 * - easier to find leaks: debug counting allows each "class" of listeners to set its own maximum number
 * - easier to stop listening: per listener (i.e. no need to keep track of each "on" so you can "remove" later)
 * - easier to avoid mistake of listening to inexistant event: emitter MUST declare which events it can emit
 * - often faster than many existing event emitters
 */
function EventEmitter () {
    this._listenersPerEventId = {};

    if (debugLevel > 0) {
        this._maxCountPerListenerKey = {};
    }
}
module.exports = EventEmitter;


EventEmitter.NO_DEBUG = 0;    // No checks except those that avoid crashes
EventEmitter.DEBUG_ERROR = 1; // Debug checks; errors go to console.error
EventEmitter.DEBUG_THROW = 2; // Debug checks; errors are thrown

var debugLevel = EventEmitter.DEBUG_THROW;

/**
 * Sets debug level.
 * Default debug mode is DEBUG_THROW - helps you debug your code by crashing.
 * DEBUG_ERROR is a good choice for production code.
 * NO_DEBUG can *sometimes* give you a bit of extra speed - but should you really be emitting that much?
 * NO_DEBUG also saves some memory - if you really create a huge number of emitters...
 *
 * @param {number} level - e.g. EventEmitter.DEBUG_ERROR (console.error messages) or EventEmitter.NO_DEBUG
 */
EventEmitter.setDebugLevel = function (level) {
    debugLevel = level;
};


//--- Emitter side

/**
 * Declares an event for this emitter.
 * Event must be declared before emit, on, or any other event-related method is called for this event.
 *
 * @param {string} eventId
 */
EventEmitter.prototype.declareEvent = function (eventId) {
    if (this._listenersPerEventId[eventId] !== undefined) {
        return throwOrConsole('Event ID declared twice: ', getAsText(this, eventId));
    }

    this._listenersPerEventId[eventId] = new ListenerList(this, eventId);
};

EventEmitter.prototype.emit = function (eventId, p1, p2, p3) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
        return false;
    }

    switch (arguments.length) {
    case 1: return listenerList.emit0();
    case 2: return listenerList.emit1(p1);
    case 3: return listenerList.emit2(p1, p2);
    case 4: return listenerList.emit3(p1, p2, p3);
    default: return listenerList.emitN.apply(listenerList, [].slice.call(arguments, 1));
    }
};

/**
 * Returns a "quick emitter" for a given event ID of this EventEmitter.
 * Using a quick emitter to emit is quite faster (if you are chasing fractions of milliseconds).
 *
 * @param {string} eventId - declared event ID for which you want to "quick emit"
 * @returns {QuickEmitter} - an object with methods emit0, emit1, emit2, emit3 and emitN
 */
EventEmitter.prototype.getQuickEmitter = function (eventId) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        return throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
    }
    return listenerList;
};

/**
 * Tells how many listeners are currently subscribed to given event ID.
 *
 * @param {string} eventId
 * @returns {number} number of listeners on this specific event
 */
EventEmitter.prototype.listenerCount = function listenerCount (eventId) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        return throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
    }
    return listenerList._count;
};


//--- Listener side

/**
 * Subscribes to an event.
 *
 * @param {string} eventId
 * @param {function} method - can be a simple function too
 * @param {object|string|undefined} listener - if not passed, emitter will be passed as context when event occurs
 * @returns {EventEmitter} this
 */
EventEmitter.prototype.on = function (eventId, method, listener) {
    var listenerList = this._listenersPerEventId[eventId];
    if (!listenerList) return throwOrConsole('Invalid event ID: ', getAsText(this, eventId, listener)), this;

    if (debugLevel > 0) {
        if (typeof method !== 'function' || typeof listener === 'function') {
            return throwOrConsole('Invalid parameters to emitter.on: \'', eventId + '\', ' + typeof method + ', ' + getObjectClassname(listener)), this;
        }
        listenerList._countListener(listener || this, listener);
    }
    listenerList._addListener(listener || this, method);
    return this;
};
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

/**
 * Unsubscribes from an event.
 * Specifying your listeners when calling "on" is often much easier
 * than having to track/store which functions you passed when subscribing.
 *
 * @param {string} eventId
 * @param {object|string|function} listener - same "listener" you passed when you called "on"
 */
EventEmitter.prototype.off = function (eventId, listener) {
    var listenerList = this._listenersPerEventId[eventId];
    if (!listenerList) return throwOrConsole('Invalid event ID: ', getAsText(this, eventId, listener));

    if (typeof listener === 'function') {
        // Old API compatibility
        var indexFn = listenerList._findMethod(listener);
        if (indexFn !== -1) listenerList._removeListener(indexFn, null);
    } else {
        var index = listenerList._findListener(listener);
        if (index !== -1) {
            listenerList._removeListener(index, listener);
        } else if (debugLevel > 0 && !listener) {
            return throwOrConsole('Invalid parameter to emitter.off: \'', eventId + '\', ' + listener);
        }
    }
};
EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

/**
 * Unsubscribes the given listener (context) from all events of this emitter
 *
 * @param {object|string} listener
 */
EventEmitter.prototype.forgetListener = function (listener) {
    for (var eventId in this._listenersPerEventId) {
        this.off(eventId, listener);
    }
};

/**
 * Sets the limit listener count for this emitter and listener class objects.
 * Default is 1 for all classes when this API is not called.
 *
 * @param {number} maxCount
 * @param {object|string} listener
 */
EventEmitter.prototype.setListenerMaxCount = function (maxCount, listener) {
    if (debugLevel === 0) return;
    if (!(maxCount > 0) || !listener) {
        return throwOrConsole('Invalid parameters to emitter.setListenerMaxCount: ', maxCount + ', ' + listener);
    }
    this._maxCountPerListenerKey[getObjectClassname(listener)] = maxCount;
};

// Old API compatibility
EventEmitter.prototype.setMaxListeners = function (maxCount) {
    if (debugLevel === 0) return;
    if (!(maxCount > 0) || arguments.length > 1) {
        return throwOrConsole('Invalid parameters to emitter.setMaxListeners: ', maxCount + (arguments[1] !== undefined ? ', ' + arguments[1] : ''));
    }
    this._maxCountPerListenerKey[DEFAULT_LISTENER] = maxCount;
};


//--- Private helpers

/**
 * Internal implementation of a "single eventID" emitter to a list of listeners.
 * A ListenerList can be returned to outside world for "quick emit" purpose.
 *
 * @param {EventEmitter} emitter
 * @param {string} eventId
 */
function ListenerList (emitter, eventId) {
    this._count = 0; // count of "listeners"
    this._methods = null; // null, function, or array of functions
    this._objects = null; // null, context, or array of contexts

    if (debugLevel > 0) {
        this._emitter = emitter; // our parent EventEmitter
        this._eventId = eventId;
        this._isEmitting = false;
        this._counterMap = {}; // key: listenerKey, value: count of listeners with same listenerKey
    }
}

ListenerList.prototype._addListener = function (context, method) {
    if (typeof this._methods === 'function') {
        // 1 -> 2 # Array creation
        this._count = 2;
        this._methods = [this._methods, method];
        this._objects = [this._objects, context];
    } else if (this._count === 0) {
        // 0 -> 1
        this._count = 1;
        this._methods = method;
        this._objects = context;
    } else {
        // n -> n+1 (n >= 0) # Array already exists
        this._methods[this._count] = method;
        this._objects[this._count++] = context;
    }
};

ListenerList.prototype._findListener = function (listener) {
    if (typeof this._methods === 'function') {
        return this._objects === listener ? 0 : -1;
    } else {
        return this._objects !== null ? this._objects.indexOf(listener) : -1;
    }
};

ListenerList.prototype._findMethod = function (method) {
    if (typeof this._methods === 'function') {
        return this._methods === method ? 0 : -1;
    } else {
        return this._methods !== null ? this._methods.indexOf(method) : -1;
    }
};

ListenerList.prototype._removeListener = function (index, listener) {
    this._count--;
    if (typeof this._methods === 'function') {
        this._methods = null;
        this._objects = null;
    } else {
        for (var i = index; i < this._count; i++) {
            this._methods[i] = this._methods[i + 1];
            this._objects[i] = this._objects[i + 1];
        }
        this._methods[i] = null;
        this._objects[i] = null;
    }

    if (debugLevel > 0) {
        var listenerKey = getObjectClassname(listener);
        this._counterMap[listenerKey]--;
        if (this._isEmitting) throwOrConsole('Removed listener during emit: ', getAsText(this._emitter, this._eventId, listener));
    }
};

// Only used if debugLevel > 0
ListenerList.prototype._countListener = function (context, listener) {
    var listenerKey = getObjectClassname(listener);
    var currentCount = (this._counterMap[listenerKey] || 0) + 1;
    var maxListenerCount = this._emitter._maxCountPerListenerKey[listenerKey] || 1;
    if (currentCount > maxListenerCount) {
        var msg = 'Too many listeners: ' + getAsText(this._emitter, this._eventId, listener) + '. ';
        var advice = listener
            ? 'Use ' + getObjectClassname(this._emitter) + '.setListenerMaxCount(n, ' + listenerKey + ') with n >= ' + currentCount
            : 'Use ' + getObjectClassname(this._emitter) + '.setMaxListeners(n) with n >= ' + currentCount + '. Even better: specify your listeners when calling "on"';
        throwOrConsole(msg, advice); // if console we can continue below
    }
    this._counterMap[listenerKey] = currentCount; // not done if exception above
    // Same listener should not listen twice to same event ID (does not apply to "undefined" listener)
    // NB: this._count is not yet updated at this point, hence this._count >= 1 below (instead of 2)
    if (currentCount >= 2 && this._count >= 1 && context === listener && this._findListener(listener) !== -1) {
        throwOrConsole('Listener listens twice: ', getAsText(this._emitter, this._eventId, listener));
    }
};

ListenerList.prototype.emit0 = function () {
    if (this._count === 0) return false; // 0 listeners
    if (debugLevel > 0) this._isEmitting = true;

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects);
    } else {
        for (var i = 0; i < this._count; i++) { this._methods[i].call(this._objects[i]); }
    }

    if (debugLevel > 0) this._isEmitting = false;
    return true;
};

ListenerList.prototype.emit1 = function (arg1) {
    if (this._count === 0) return false; // 0 listeners
    if (debugLevel > 0) this._isEmitting = true;

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects, arg1);
    } else {
        for (var i = 0; i < this._count; i++) { this._methods[i].call(this._objects[i], arg1); }
    }

    if (debugLevel > 0) this._isEmitting = false;
    return true;
};

ListenerList.prototype.emit2 = function (arg1, arg2) {
    if (this._count === 0) return false; // 0 listeners
    if (debugLevel > 0) this._isEmitting = true;

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects, arg1, arg2);
    } else {
        for (var i = 0; i < this._count; i++) { this._methods[i].call(this._objects[i], arg1, arg2); }
    }

    if (debugLevel > 0) this._isEmitting = false;
    return true;
};

ListenerList.prototype.emit3 = function (arg1, arg2, arg3) {
    if (this._count === 0) return false; // 0 listeners
    if (debugLevel > 0) this._isEmitting = true;

    if (typeof this._methods === 'function') {
        this._methods.call(this._objects, arg1, arg2, arg3);
    } else {
        for (var i = 0; i < this._count; i++) { this._methods[i].call(this._objects[i], arg1, arg2, arg3); }
    }

    if (debugLevel > 0) this._isEmitting = false;
    return true;
};

ListenerList.prototype.emitN = function () {
    if (this._count === 0) return false; // 0 listeners
    if (debugLevel > 0) this._isEmitting = true;

    if (typeof this._methods === 'function') {
        this._methods.apply(this._objects, arguments);
    } else {
        for (var i = 0; i < this._count; i++) { this._methods[i].apply(this._objects[i], arguments); }
    }

    if (debugLevel > 0) this._isEmitting = false;
    return true;
};

//---

/* eslint no-console: 0 */

function throwOrConsole (msg, info) {
    if (debugLevel >= EventEmitter.DEBUG_THROW) throw new Error(msg + info);
    console.error(msg + info);
}

var DEFAULT_LISTENER = '<default>';

function getObjectClassname (listener) {
    if (!listener) return DEFAULT_LISTENER;
    if (typeof listener === 'string') return listener;
    var constr = listener.constructor;
    return constr.name || constr.toString().split(/ |\(/, 2)[1];
}

function getAsText (emitter, eventId, listener) {
    if (listener === undefined || typeof listener === 'function') {
        return getObjectClassname(emitter) + '.on(\'' + eventId + '\', fn)';
    } else {
        return getObjectClassname(emitter) + '.on(\'' + eventId + '\', fn, ' + getObjectClassname(listener) + ')';
    }
}

},{}],10:[function(require,module,exports){
(function (process){(function (){
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

}).call(this)}).call(this,require('_process'))
},{"../index.js":1,"_process":3,"util":5}]},{},[7]);
