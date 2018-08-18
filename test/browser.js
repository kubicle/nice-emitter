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
