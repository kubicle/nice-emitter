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
 * @param {object|string|undefined} listener - if not passed, "this" will be passed as context when event occurs
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
 * NB: specifying your listeners when calling "on" is often much easier
 * than having to track/store which functions your use to register.
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

EventEmitter.prototype.forgetListener = function (listener) {
    for (var eventId in this._listenersPerEventId) {
        this.off(eventId, listener);
    }
};

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
