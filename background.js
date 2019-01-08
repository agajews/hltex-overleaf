'use strict';

chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({color: '#3aa757'}, function() {
        console.log("The color is green.");
    });
});

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        console.log(details.url);
        // if(details.url == "https://cdn.sharelatex.com/minjs/ide/pdf/controllers/PdfController.js") {
        //     console.log("replacing");
        //     return {redirectUrl: "https://raw.githubusercontent.com/agajews/hltex-chrome/master/PdfController.js"};
        // }
        if(details.url == "https://cdn.sharelatex.com/minjs/libs/raven-3.27.0.min.js") {
            return {redirectUrl: "https://raw.githubusercontent.com/agajews/hltex-chrome/master/raven-3.27.0.min.js"};
        }
    },
    // {urls: ["*://cdn.sharelatex.com/*.js"]},
    {urls: ["*://cdn.sharelatex.com/*.js"]},
    ["blocking"]);

chrome.webRequest.onHeadersReceived.addListener(details => {
    let myResponseHeaders = details.responseHeaders;
    let header = myResponseHeaders.find(e => e.name == 'Content-Type');

    // Check if the header has been defined already
    if (header) {
        console.log ('Modifying header');
        let headerIndex = myResponseHeaders.indexOf(header);
        myResponseHeaders.splice(headerIndex,1);
    }

    myResponseHeaders.push({ name: 'Content-Type', value: 'application/x-javascript' });

    return {responseHeaders: myResponseHeaders};
}, {urls: ["https://raw.githubusercontent.com/agajews/hltex-chrome/master/raven-3.27.0.min.js"]},
    ['blocking', 'responseHeaders']);

// chrome.webRequest.onBeforeRequest.addListener(
//   function(details) { return {cancel: true}; },
//   {urls: ["*://www.evil.com/*"]},
//   ["blocking"]);


chrome.runtime.sendNativeMessage('com.hltex.overleaf',
    { text: "Hello" },
    function(response) {
        console.log('Last error: ', chrome.runtime.lastError);
        console.log('Response from translator: ', response);
    });

// var port = chrome.runtime.connectNative("com.hltex.overleaf");
// console.log('Last error after opening: ', chrome.runtime.lastError);
// port.postMessage("ping");
// console.log('Last error after ping: ', chrome.runtime.lastError);

// port.onMessage.addListener((response) => {
//     console.log("Received: " + response);
// });

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log('Received request ', request)
        // port.postMessage("ping");
        // chrome.runtime.sendNativeMessage('com.hltex.overleaf',
        //     { text: "Hello" },
        //     function(response) {
        //         console.log('Last error: ', chrome.runtime.lastError);
        //         console.log('Response from translator: ', response);
        //         sendResponse({ response: response });
        //     });
    });
