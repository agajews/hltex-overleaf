// var toparse = document.createElement("meta");
// toparse.id = "toparse";
// toparse.style = { visibility: 'hidden', height: '0px' };
// document.head.appendChild(toparse);

document.addEventListener('readytoparse', function(e) {
    e.preventDefault();
    console.log('Received readytoparse');
    console.log(e.detail);

    chrome.runtime.sendMessage({ docs: e.detail }, function(response) {
        console.log('Background responded with', response);
        var e = new CustomEvent('readytocompile', { detail: response });
        document.dispatchEvent(e);
    });
})

function injectScript(file, node) {
    var th = document.getElementsByTagName(node)[0];
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file);
    th.appendChild(s);
}

injectScript(chrome.extension.getURL('overleaf.js'), 'body');
