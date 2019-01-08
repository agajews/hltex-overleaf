console.log('hello from overleaf!');
interval = setInterval(function() {
    if (window._ide) {
        var texid = "5c32d60c21c0266007c09bbd"
        var idecopy = jQuery.extend(true, {}, _ide)
        var newcm = new window._ide.connectionManager.constructor(idecopy, idecopy.$scope)

        console.log('Setting compiler');
        oldRecompile = window._ide.$scope.recompile;
        window._ide.$scope.recompile = function() {
            console.log('recompiling!');
            idecopy.socket.emit('joinDoc', texid, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                idecopy.socket.emit('applyOtUpdate', texid, { doc: texid, op: [
                    {"p": 0, "d": docLines.join('\n')},
                    {"p": 0, "i":"\\documentclass{article}\n\\begin{document}\nYo!\n\\end{document}"}
                ], v: version }, function(error) {
                    console.log(error);
                    oldRecompile({});
                })
            });
        }

        var old_element = document.getElementsByClassName('btn-recompile')[0];
        var new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);
        new_element.addEventListener('click', function() {
            window._ide.$scope.recompile()
        });

        clearInterval(interval);
    }
}, 500);
