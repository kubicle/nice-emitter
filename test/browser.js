'use strict';

var runBenchmark = require('./benchmark').runBenchmark;
var runTest = require('./test').runTest;

var logDiv;
var browserConsoleLog;


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

function redirectConsole () {
    browserConsoleLog = console.log;
    console.log = log;
}

function logSection (title) {
    createDiv(logDiv, 'section', title);
}

function logLine (result) {
    var line = log(result.msg);
    if (result.factor) { // factor is 0 for EE3
        if (result.factor < 1) {
            line.className += ' warning';
        } else if (result.factor >= 1.5) {
            line.className += ' super';
        }
    }
}

function log () {
    var msg = [].join.call(arguments, ' ');
    browserConsoleLog(msg);
    return createDiv(logDiv, 'logLine', msg);
}

function runItAll () {
    setMeta('viewport', 'width=device-width, initial-scale=1');

    createDiv(document.body, 'title', 'nice-emitter Benchmark');
    createDiv(document.body, 'infos', 'EE3 = EventEmitter3');
    createDiv(document.body, 'infos', 'NE = nice-emitter');
    logDiv = createDiv(document.body, 'logDiv');

    redirectConsole();

    // NB: code in test.js will for sure de-optimize nice-emitter, so we MUST run benchmark.js first
    setTimeout(runOneStep, 100);
}

var stepNames = ['Benchmark DEBUG', 'Benchmark PROD', 'Test / coverage']
var step = 0;
var subStep = 0;

function runOneStep () {
    if (subStep === 0) logSection(stepNames[step]);
    var result;

    switch (step) {
    case 0:
        result = runBenchmark(subStep++, /*isProd=*/false);
        if (result !== null) {
            logLine(result);
        } else {
            step++;
            subStep = 0;
        }
        break;
    case 1:
        result = runBenchmark(subStep++, /*isProd=*/true);
        if (result !== null) {
            logLine(result);
        } else {
            step++;
            subStep = 0;
        }
        break;
    case 2:
        runTest();
        return; // stop here
    }
    setTimeout(runOneStep, 50);
}

runItAll();
