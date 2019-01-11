'use strict';

chrome.extension.isAllowedFileSchemeAccess(function(isAllowedAccess) {
    if (isAllowedAccess) return; // Great, we've got access

    // alert for a quick demonstration, please create your own user-friendly UI
    alert('Please allow access to file URLs in the following screen.');

    chrome.tabs.create({
        url: 'chrome://extensions/?id=' + chrome.runtime.id
    });
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        async function translate() {
            console.log('Received request ', request);
            var docs = request.docs;
            var file_env = request.file_env;
            console.log('Received docs ', docs);
            var tex_docs = [];
            var blobs = [];
            for (var i = 0; i < docs.length; i++) {
                var response = await new Promise(resolve => {
                    chrome.runtime.sendNativeMessage('com.hltex.overleaf', { doc: docs[i], file_env: file_env }, resolve);
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
                    hlid: docs[i].id,
                    current: docs[i].current,
                });
            }
            sendResponse({ docs: tex_docs, blobs: blobs });
        }
        translate();
        return true;
    });
