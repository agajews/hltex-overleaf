'use strict';

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

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        async function translate() {
            console.log('Received request ', request);
            var docs = request.docs;
            console.log('Received docs ', docs);
            var tex_docs = [];
            for (var i = 0; i < docs.length; i++) {
                var response = await new Promise(resolve => {
                    chrome.runtime.sendNativeMessage('com.hltex.overleaf', docs[i], resolve)
                });
                tex_docs.push({
                    text: response.text,
                    error: response.error,
                    line: response.line,
                    path: docs[i].path,
                    id: docs[i].tex_id,
                    current: docs[i].current,
                });
            }
            console.log('Last error: ', chrome.runtime.lastError);
            console.log('Tex docs: ', tex_docs);
            console.log('sendResponse', sendResponse);
            sendResponse({ docs: tex_docs });
            console.log('Sent response');
            console.log('Last error: ', chrome.runtime.lastError);
        }
        translate();
        return true;
    });
