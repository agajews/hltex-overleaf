// chrome.runtime.sendNativeMessage('com.hltex.overleaf',
//     { text: "Hello" },
//     function(response) {
//         console.log("Received " + response);
//     });

// chrome.runtime.sendMessage({greeting: "hello"}, function(response) {
//     console.log(response);
// });

var toparse = document.createElement("p");
toparse.id = "toparse";
toparse.style = { visibility: 'hidden', height: '0px' };
document.body.appendChild(toparse);

toparse.addEventListener('readytoparse', function(e) {
    e.preventDefault();
    console.log('Received readytoparse');
    tocompile = toparse.textContent;
    console.log(tocompile);
    toparse.textContent = '';

    toparse.textContent = tocompile;
    event = new Event('readytocompile');
    toparse.dispatchEvent(event);
})

function injectScript(file, node) {
    var th = document.getElementsByTagName(node)[0];
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file);
    th.appendChild(s);
}

injectScript(chrome.extension.getURL('overleaf.js'), 'body');
