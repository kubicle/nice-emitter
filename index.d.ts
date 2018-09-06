/**
 * EventEmitter interface - similar to Node.js
 */
declare class EventEmitter {
    /**
     * Debug checks & counting. Errors are thrown. Helps you debug your code by crashing early.
     * This is the default level, except if code is minified.
     */
    DEBUG_THROW: number;

    /**
     * Debug checks & counting. Errors go to `console.error` but execution continues as normally as possible.
     */
    DEBUG_ERROR: number;

    /**
     * No counting, no checks except those that avoid crashes.
     * The fastest level, with minimum memory usage.
     * If your code is minified, NO_DEBUG is automatically the default (no need to call `setDebugLevel`).
     * NB: counting based on class names would have issues when 2 minified classes end-up with the same name.
     */
    NO_DEBUG: number;

    /**
     * Sets debug level. See comments about debug levels.
     */
    setDebugLevel (level: number);

    /**
     * Forces listener to be notified in the order in which they subscribed, at the expense of a bit more CPU and memory.
     * By default his order is not guaranteed.
     */
    respectSubscriberOrder (shouldRespect: boolean);

    /**
     * Declares an event for this emitter.
     * Event must be declared before `emit`, `on`, or other method is called for this event ID.
     */
    declareEvent (eventId: string);

    /**
     * Notifies each listener which subscribed to given event ID.
     * Optional parameters are passed.
     * Returns false if no listeners are registered.
     */
    emit (eventId: string, ...args: Array<any>): boolean;

    /**
     * Returns a "quick emitter" for a given event ID of this EventEmitter.
     * Using a quick emitter to emit is quite faster (if you are chasing fractions of milliseconds).
     * A QuickEmitter is an object with methods emit0, emit1, emit2, emit3 and emitN
     */
    getQuickEmitter (eventId: string): QuickEmitter;

    /**
     * Tells how many listeners are currently subscribed to given event ID.
     */
    listenerCount (eventId: string): number;

    /**
     * Subscribes to an event.
     * `method` can be a simple function too.
     * If `listener` is omitted, emitter will be passed as context when event occurs.
     */
    on (eventId: string, method: Function, listener?: any): this;
    addListener (eventId: string, method: Function, listener?: any): this;

    /**
     * Unsubscribes from an event.
     * Specifying your listeners when calling "on" is often much easier
     * than having to track/store which functions you passed when subscribing.
     * `listener` must be the same "listener" you passed when you called "on".
     */
    off (eventId: string, listener?: any);
    removeListener (eventId: string, listener?: any);

    /**
     * Old API compatibility
     * @deprecated `once` is not your friend.
     * `method` can be a simple function too.
     * If `listener` is omitted, emitter will be passed as context when event occurs.
     * If `timeoutMs` is omitted, a "human-debugging" value of 5 seconds will be used.
     * If timeout expires before the event occurs, a simple console.error is logged.
     */
    once (eventId: string, method: Function, listener?: any, timeoutMs?: number);

    /**
     * Unsubscribes the given listener (context) from all events of this emitter.
     */
    forgetListener (listener: any);

    /**
     * Sets the limit per event ID of listeners for this emitter and listener class objects.
     * Default is 1 for all classes when this API is not called.
     * If the maximum is reached, an error is thrown or logged.
     * Does nothing if debug level is NO_DEBUG.
     */
    setListenerMaxCount (maxCount: number, listener: any);

    /**
     * Old API compatibility.
     * Sets a maximum count (default is 1) of listeners that can subscribe to 1 event ID.
     * This limit applies when `on` or `addListener` are called without `listener` parameter.
     * If the maximum is reached, an error is thrown or logged.
     * Does nothing if debug level is NO_DEBUG.
     */
    setMaxListeners (maxCount: number);
}

declare interface QuickEmitter {
    emit0 (): boolean;
    emit1 (arg1: any): boolean;
    emit2 (arg1: any, arg2: any): boolean;
    emit3 (arg1: any, arg2: any, arg3: any): boolean;
    emitN (...args: Array<any>): boolean;
}

export = EventEmitter;
