// var toparse = document.createElement("meta");
// toparse.id = "toparse";
// toparse.style = { visibility: 'hidden', height: '0px' };
// document.head.appendChild(toparse);

document.addEventListener('readytoparse', function(e) {
    e.preventDefault();
    console.log('Received readytoparse');
    console.log(e.detail);

    chrome.runtime.sendMessage({ text: e.detail }, function(response) {
        console.log(response);
    });

    // toparse.textContent = tocompile;
    e = new CustomEvent('readytocompile', { detail: e.detail });
    document.dispatchEvent(e);
})

function injectScript(file, node) {
    var th = document.getElementsByTagName(node)[0];
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file);
    th.appendChild(s);
}

injectScript(chrome.extension.getURL('overleaf.js'), 'body');
