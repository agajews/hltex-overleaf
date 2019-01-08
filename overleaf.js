console.log('hello from overleaf!');

interval = setInterval(function() {
    if (window._ide) {
        var texid = "5c32d60c21c0266007c09bbd"
        var idecopy = jQuery.extend(true, {}, _ide)
        var newcm = new window._ide.connectionManager.constructor(idecopy, idecopy.$scope)

        console.log('Setting compiler');
        oldRecompile = window._ide.$scope.recompile;
        window.oldRecompile = oldRecompile;
        toparse = document.getElementById('toparse');
        window._ide.$scope.recompile = function() {
            console.log('recompiling!');

            event = new Event('readytoparse');
            toparse.textContent = window._ide.editorManager.getCurrentDocValue();
            toparse.dispatchEvent(event);
        }

        toparse.addEventListener('readytocompile', function(e) {
            e.preventDefault();
            console.log('Received readytocompile');
            compiled = toparse.textContent;
            console.log(compiled);
            toparse.textContent = '';

            idecopy.socket.emit('joinDoc', texid, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                idecopy.socket.emit('applyOtUpdate', texid, { doc: texid, op: [
                    {"p": 0, "d": docLines.join('\n')},
                    {"p": 0, "i": compiled}
                ], v: version }, function(error) {
                    console.log(error);
                    oldRecompile({});
                })
            });

        })

        var old_element = document.getElementsByClassName('btn-recompile')[0];
        var new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);
        new_element.addEventListener('click', function(e) {
            e.preventDefault();
            window._ide.$scope.recompile()
        });

        clearInterval(interval);
    }
}, 500);
