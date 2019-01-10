'use strict';

chrome.runtime.onInstalled.addListener(function() {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (this.readyState == 4) {
            console.log(this.response);
        }
    }
    xhr.open('GET', "file:///tmp/test.json");
    xhr.responseType = 'text';
    xhr.send();
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

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        async function translate() {
            console.log('Received request ', request);
            var docs = request.docs;
            console.log('Received docs ', docs);
            var tex_docs = [];
            var blobs = [];
            for (var i = 0; i < docs.length; i++) {
                var response = await new Promise(resolve => {
                    chrome.runtime.sendNativeMessage('com.hltex.overleaf', docs[i], resolve);
                });

                console.log('Received response', response);
                if (!response) {
                    console.log('Last error: ', chrome.runtime.lastError);
                    sendResponse({ error: chrome.runtime.lastError });
                    return;
                }

                for (var j = 0; j < response.files.length; j++) {
                    var xhr = new XMLHttpRequest();
                    var file_promise = new Promise((resolve, reject) => {
                        // setTimeout(function() {
                        //     reject();
                        // }, 2000);
                        xhr.onreadystatechange = function () {
                            if (this.readyState == 4) {
                                resolve(this.response);
                            }
                        }
                    })
                    xhr.open('GET', "file://" + response.files[j]);
                    xhr.responseType = 'blob';
                    xhr.send();
                    var blob = await file_promise;
                    console.log('Got blob', blob);
                    var reader = new FileReader();

                    await new Promise((resolve) => {
                        reader.onloadend = (event) => {
                            resolve();
                        }
                        reader.readAsBinaryString(blob);
                    })
                    // The contents of the BLOB are in reader.result:
                    console.log(reader.result);
                    blobs.push({ blobText: reader.result, blobType: blob.type, path: response.files[j] })
                }

                tex_docs.push({
                    text: response.text,
                    error: response.error,
                    line: response.line,
                    path: docs[i].path,
                    id: docs[i].tex_id,
                    current: docs[i].current,
                });
            }
            sendResponse({ docs: tex_docs, blobs: blobs });
        }
        translate();
        return true;
    });
