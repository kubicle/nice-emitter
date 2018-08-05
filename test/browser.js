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
            log(result.msg); // TODO: use result.factor
        } else {
            step++;
            subStep = 0;
        }
        break;
    case 1:
        result = runBenchmark(subStep++, /*isProd=*/true);
        if (result !== null) {
            log(result.msg); // TODO: use result.factor
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
