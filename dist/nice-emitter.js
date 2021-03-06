(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.NiceEmitter = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{}]},{},[1])(1)
});
