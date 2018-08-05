'use strict';

var runBenchmark = require('./benchmark').runBenchmark;
var runTest = require('./test').runTest;

var logDiv;
var browserConsoleLog;


function createDiv (classname, parent) {
    var div = document.createElement('div');
    div.className = classname;
    parent.appendChild(div);
    return div;
}

function redirectConsole () {
    browserConsoleLog = console.log;
    console.log = log;
}

function log () {
    var msg = [].join.call(arguments, ' ');
    browserConsoleLog(msg);

    var logLine = createDiv('logLine', logDiv);
    logLine.innerText = msg;
}

function logSection (title) {
    createDiv('section', logDiv).innerText = title;
}

function runItAll () {
    logDiv = createDiv('logDiv', document.body);
    redirectConsole();

    // NB: code in test.js will for sure de-optimize nice-emitter, so we MUST run benchmark.js first
    setTimeout(runOneStep, 100);
}

var stepNames = ['Benchmark PROD', 'Benchmark DEBUG', 'Test / coverage']
var step = 0;
var subStep = 0;

function runOneStep () {
    if (subStep === 0) logSection(stepNames[step]);

    switch (step) {
    case 0:
        if (!runBenchmark(subStep++, /*isProd=*/true)) {
            step++;
            subStep = 0;
        }
        break;
    case 1:
        if (!runBenchmark(subStep++, /*isProd=*/false)) {
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
