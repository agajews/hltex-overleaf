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
//

// chrome.runtime.onMessage.addListener(
//     function(request, sender, sendResponse) {
//         console.log('Received request ', request)
//         if (request.greeting == "hello")
//           sendResponse({farewell: "goodbye"});
//     });
