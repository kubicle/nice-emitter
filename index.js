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

    if (listenerList.count === 0) return false; // 0 listeners

    switch (arguments.length) {
    case 1: return listenerList.emit0();
    case 2: return listenerList.emit1(p1);
    case 3: return listenerList.emit2(p1, p2);
    case 4: return listenerList.emit3(p1, p2, p3);
    default: return listenerList.emitN([].slice.call(arguments, 1));
    }
};

EventEmitter.prototype.makeQuickEmitFunction = function (eventId) {
    var listenerList = this._listenersPerEventId[eventId];
    if (listenerList === undefined) {
        return throwOrConsole('Undeclared event ID for ' + getObjectClassname(this) + ': ', eventId);
    }
    var funcName = 'emit_' + eventId;
    var fn = this[funcName];
    if (fn) return fn;

    fn = this[funcName] = function (p1, p2, p3) {
        if (listenerList.count === 0) return false; // 0 listeners

        switch (arguments.length) {
        case 0: return listenerList.emit0();
        case 1: return listenerList.emit1(p1);
        case 2: return listenerList.emit2(p1, p2);
        case 3: return listenerList.emit3(p1, p2, p3);
        default: return listenerList.emitN([].slice.call(arguments, 0));
        }
    };
    // qe = listenerList.quickEmit;
    // fn = this[funcName] = function () { return qe.apply(listenerList, arguments); };
    return fn;
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
        listenerList.countListener(listener || this, listener);
    }
    listenerList.addListener(listener || this, method);
    return this;
};

/**
 * Unsubscribes from an event.
 *
 * @param {string} eventId
 * @param {object|string} listener - same "listener" you passed when you called "on"
 */
EventEmitter.prototype.off = function (eventId, listener) {
    var listenerList = this._listenersPerEventId[eventId];
    if (!listenerList) return throwOrConsole('Invalid event ID: ', getAsText(this, eventId, listener));

    // Old API compatibility
    if (typeof listener === 'function') {
        return this.removeListener(eventId, listener);
    }
    if (debugLevel > 0 && !listener) {
        return throwOrConsole('Invalid parameter to emitter.off: \'', eventId + '\', ' + listener);
    }

    var index = listenerList.findListener(listener);
    if (index !== -1) listenerList.removeListener(index, listener);
};

// Old API compatibility - specifying your listeners when calling "on" is often much easier
// than having to track/store which functions your use to register.
EventEmitter.prototype.removeListener = function (eventId, fn) {
    var listenerList = this._listenersPerEventId[eventId];
    if (!listenerList) return throwOrConsole('Invalid event ID: ', getAsText(this, eventId));

    var index = listenerList.findMethod(fn);
    if (index !== -1) listenerList.removeListener(index, null);
};

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

function ListenerList (emitter, eventId) {
    this.methods = null; // null, function, or array of functions
    this.objects = null; // null, context, or array of contexts
    this.count = 0; // count of "listeners"

    if (debugLevel > 0) {
        this.emitter = emitter; // our parent EventEmitter
        this.eventId = eventId;
        this.isEmitting = false;
        this.counterMap = {}; // key: listenerKey, value: count of listeners with same listenerKey
    }
}

ListenerList.prototype.addListener = function (context, method) {
    if (typeof this.methods === 'function') {
        // 1 -> 2 # Array creation
        this.count = 2;
        this.methods = [this.methods, method];
        this.objects = [this.objects, context];
    } else if (this.count === 0) {
        // 0 -> 1
        this.count = 1;
        this.methods = method;
        this.objects = context;
    } else {
        // n -> n+1 (n >= 0) # Array already exists
        this.methods[this.count] = method;
        this.objects[this.count++] = context;
    }
};

ListenerList.prototype.findListener = function (listener) {
    if (typeof this.methods === 'function') {
        return this.objects === listener ? 0 : -1;
    } else {
        return this.objects !== null ? this.objects.indexOf(listener) : -1;
    }
};

ListenerList.prototype.findMethod = function (method) {
    if (typeof this.methods === 'function') {
        return this.methods === method ? 0 : -1;
    } else {
        return this.methods !== null ? this.methods.indexOf(method) : -1;
    }
};

ListenerList.prototype.removeListener = function (index, listener) {
    this.count--;
    if (typeof this.methods === 'function') {
        this.methods = null;
        this.objects = null;
    } else {
        for (var i = index; i < this.count; i++) {
            this.methods[i] = this.methods[i + 1];
            this.objects[i] = this.objects[i + 1];
        }
        this.methods[i] = null;
        this.objects[i] = null;
    }

    if (debugLevel > 0) {
        var listenerKey = getObjectClassname(listener);
        if (this.isEmitting) throwOrConsole('"on" removed during emit: ', getAsText(this.emitter, this.eventId, listener));
        this.counterMap[listenerKey]--;
    }
};

// Only used if debugLevel > 0
ListenerList.prototype.countListener = function (context, listener) {
    var listenerKey = getObjectClassname(listener);
    var currentCount = (this.counterMap[listenerKey] || 0) + 1;
    var maxListenerCount = this.emitter._maxCountPerListenerKey[listenerKey] || 1;
    if (currentCount > maxListenerCount) {
        var msg = 'Too many listeners: ' + getAsText(this.emitter, this.eventId, listener) + '. ';
        var advice = listener
            ? 'Use ' + getObjectClassname(this.emitter) + '.setListenerMaxCount(n, ' + listenerKey + ') with n >= ' + currentCount
            : 'Use ' + getObjectClassname(this.emitter) + '.setMaxListeners(n) with n >= ' + currentCount + '. Even better: specify your listeners when calling "on"';
        throwOrConsole(msg, advice); // if console we can continue below
    }
    this.counterMap[listenerKey] = currentCount; // not done if exception above
    // Same listener should not listen twice to same event ID (does not apply to "undefined" listener)
    if (currentCount > 1 && this.count > 1 && context === listener && this.objects.indexOf(listener) !== -1) {
        throwOrConsole('Listener listens twice: ', getAsText(this.emitter, this.eventId, listener));
    }
};

// ListenerList.prototype.quickEmit = function () {
//     if (this.count === 0) return false; // 0 listeners

//     switch (arguments.length) {
//     case 0: return this.emit0();
//     case 1: return this.emit1(arguments[0]);
//     case 2: return this.emit2(arguments[0], arguments[1]);
//     case 3: return this.emit3(arguments[0], arguments[1], arguments[2]);
//     default: return this.emitN([].slice.call(arguments, 0));
//     }
// };

ListenerList.prototype.emit0 = function () {
    if (debugLevel > 0) this.isEmitting = true;

    if (typeof this.methods === 'function') {
        this.methods.call(this.objects);
    } else {
        for (var i = 0; i < this.count; i++) { this.methods[i].call(this.objects[i]); }
    }

    if (debugLevel > 0) this.isEmitting = false;
    return true;
};

ListenerList.prototype.emit1 = function (arg1) {
    if (debugLevel > 0) this.isEmitting = true;

    if (typeof this.methods === 'function') {
        this.methods.call(this.objects, arg1);
    } else {
        for (var i = 0; i < this.count; i++) { this.methods[i].call(this.objects[i], arg1); }
    }

    if (debugLevel > 0) this.isEmitting = false;
    return true;
};

ListenerList.prototype.emit2 = function (arg1, arg2) {
    if (debugLevel > 0) this.isEmitting = true;

    if (typeof this.methods === 'function') {
        this.methods.call(this.objects, arg1, arg2);
    } else {
        for (var i = 0; i < this.count; i++) { this.methods[i].call(this.objects[i], arg1, arg2); }
    }

    if (debugLevel > 0) this.isEmitting = false;
    return true;
};

ListenerList.prototype.emit3 = function (arg1, arg2, arg3) {
    if (debugLevel > 0) this.isEmitting = true;

    if (typeof this.methods === 'function') {
        this.methods.call(this.objects, arg1, arg2, arg3);
    } else {
        for (var i = 0; i < this.count; i++) { this.methods[i].call(this.objects[i], arg1, arg2, arg3); }
    }

    if (debugLevel > 0) this.isEmitting = false;
    return true;
};

ListenerList.prototype.emitN = function (args) {
    if (debugLevel > 0) this.isEmitting = true;

    if (typeof this.methods === 'function') {
        this.methods.apply(this.objects, args);
    } else {
        for (var i = 0; i < this.count; i++) { this.methods[i].apply(this.objects[i], args); }
    }

    if (debugLevel > 0) this.isEmitting = false;
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
    if (listener === undefined) {
        return getObjectClassname(emitter) + '.on(\'' + eventId + '\', fn)';
    } else {
        return getObjectClassname(emitter) + '.on(\'' + eventId + '\', fn, ' + getObjectClassname(listener) + ')';
    }
}
