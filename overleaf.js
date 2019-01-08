console.log('hello from overleaf!');

interval = setInterval(function() {
    if (window._ide) {
        var texid = "5c32d60c21c0266007c09bbd"
        var idecopy = jQuery.extend(true, {}, _ide)
        var newcm = new window._ide.connectionManager.constructor(idecopy, idecopy.$scope)

        console.log('Setting compiler');
        oldRecompile = window._ide.$scope.recompile;
        window.oldRecompile = oldRecompile;
        // toparse = document.getElementById('toparse');
        window._ide.$scope.recompile = function() {
            if (window.recompiling) {  // poor man's mutex
                return;
            }
            window.recompiling = true;
            console.log('recompiling!');

            // toparse.textContent = window._ide.editorManager.getCurrentDocValue();
            e = new CustomEvent('readytoparse', { detail: window._ide.editorManager.getCurrentDocValue() });
            document.dispatchEvent(e);
        }

        document.addEventListener('readytocompile', function(e) {
            e.preventDefault();
            console.log('Received readytocompile');
            console.log(e.detail);
            // compiled = toparse.textContent;
            // console.log(compiled);
            // toparse.textContent = '';

            idecopy.socket.emit('joinDoc', texid, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                idecopy.socket.emit('applyOtUpdate', texid, { doc: texid, op: [
                    {"p": 0, "d": docLines.join('\n')},
                    {"p": 0, "i": e.detail}
                ], v: version }, function(error) {
                    console.log(error);
                    oldRecompile({});
                    setTimeout(function() {
                        window.recompiling = false;
                    }, 1000);
                })
            });

        });

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
