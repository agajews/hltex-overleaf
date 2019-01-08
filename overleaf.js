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
        window._ide.$scope.recompile = async function() {
            if (window.recompiling) {  // poor man's mutex
                return;
            }
            window.recompiling = true;
            console.log('recompiling!');

            var docs = window._ide.$scope.docs;
            var hltex_docs = [];
            var tex_docs = [];
            for (var i = 0; i < docs.length; i++) {
                name = docs[i].doc.name;
                if (name.endsWith('.hltex')) {
                    docLines = await new Promise(resolve => {
                        idecopy.socket.emit('joinDoc', docs[i].doc.id, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                            resolve(docLines);
                        });
                    });
                    hltex_docs.push({
                        text: docLines.join('\n'),
                        // id: docs[i].doc.id,
                        path: docs[i].path,
                    });
                } else if (name.endsWith('.tex')) {
                    tex_docs.push({
                        path: docs[i].path,
                        id: docs[i].doc.id,
                    });
                }
            }

            console.log('Hltex docs: ', hltex_docs);
            console.log('Tex docs: ', tex_docs);

            // why doesn't javascript have hashmaps
            for (var i = 0; i < hltex_docs.length; i++) {
                var hltex_path = hltex_docs[i].path;
                console.log('Hltex path: ', hltex_path);
                var tex_path = hltex_path.slice(0, -6) + '.tex';
                console.log('Tex path: ', tex_path);
                for (var j = 0; j < tex_docs.length; j++) {
                    if (tex_docs[j].path == tex_path) {
                        hltex_docs[i].tex_id = tex_docs[j].id;
                    }
                }
                if (!hltex_docs[i].tex_id) {
                    console.log('Missing tex doc for ', hltex_path);
                    return;
                }
            }

            var e = new CustomEvent('readytoparse', { detail: hltex_docs });
            document.dispatchEvent(e);
        }

        document.addEventListener('readytocompile', async function(e) {
            e.preventDefault();
            var docs = e.detail;
            console.log('Received readytocompile');
            console.log('Tex docs: ', docs);

            for (var i = 0; i < docs.length; i++) {
                await new Promise(resolve => {
                    idecopy.socket.emit('joinDoc', docs[i].id, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                        idecopy.socket.emit('applyOtUpdate', docs[i].id, { doc: docs[i].id, op: [
                            {"p": 0, "d": docLines.join('\n')},
                            {"p": 0, "i": docs[i].text}
                        ], v: version }, function(error) {
                            console.log(error);
                            resolve();
                        })
                    });
                });
            }

            oldRecompile({});
            setTimeout(function() {
                window.recompiling = false;
            }, 1000);

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
