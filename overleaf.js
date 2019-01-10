console.log('hello from overleaf!');

function endRecompile(err) {
    if (err) {
        console.log('Reloading...');
        alert(err);
        location.reload();
    }

    window.recompiling = false;
    document.getElementsByClassName('btn-recompile')[0].children[1].innerHTML = "Recompile";
    document.getElementsByClassName('btn-recompile')[0].children[0].classList.remove('fa-spin');
    document.getElementsByClassName('btn-recompile')[0].removeAttribute('disabled');
}

function strToBlob(str, type) {
    var i, l, d, array;
    d = str;
    l = d.length;
    array = new Uint8Array(l);
    for (var i = 0; i < l; i++){
        array[i] = d.charCodeAt(i);
    }
    var blob = new Blob([array], {type: type});
    return blob;
}

interval = setInterval(function() {
    if (window._ide) {
        var idecopy = jQuery.extend(true, {}, _ide)
        var newcm = new window._ide.connectionManager.constructor(idecopy, idecopy.$scope)

        console.log('Setting compiler');
        oldRecompile = window._ide.$scope.recompile;
        window.oldRecompile = oldRecompile;
        // toparse = document.getElementById('toparse');
        window._ide.$scope.recompile = async function() {
            if (window.recompiling || _ide.$scope.pdf.compiling) {  // poor man's mutex
                return;
            }
            window.recompiling = true;
            document.getElementsByClassName('btn-recompile')[0].children[1].innerHTML = "Compiling...";
            document.getElementsByClassName('btn-recompile')[0].children[0].classList.add('fa-spin');
            document.getElementsByClassName('btn-recompile')[0].setAttribute('disabled', 'disabled');
            console.log('recompiling!');

            var docs = window._ide.$scope.docs;
            if (!docs) {
                endRecompile();
                return;
            }
            var hltex_docs = [];
            var tex_docs = [];
            var file_env = [];
            var noCurrent = false;
            for (var i = 0; i < docs.length; i++) {
                var current = docs[i].doc.id == window._ide.$scope.editor.open_doc_id;
                var name = docs[i].doc.name;
                if (current && !name.endsWith('.hltex')) {
                    noCurrent = true;
                }
                if (name.endsWith('.hltex')) {
                    var text = null;
                    if (current) {
                        text = window._ide.$scope.editor.sharejs_doc.getSnapshot();
                    } else {
                        try {
                            var docLines = await new Promise((resolve, reject) => {
                                idecopy.socket.emit('joinDoc', docs[i].doc.id, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                                    if (error) {
                                        reject(error);
                                        return;
                                    }
                                    resolve(docLines);
                                });
                            });
                        } catch (err) {
                            console.log(err);
                            endRecompile('Failed to read doc ' + docs[i].path);
                            return;
                        }
                        text = docLines.join('\n');
                    }
                    hltex_docs.push({
                        text: text,
                        name: name,
                        // id: docs[i].doc.id,
                        path: docs[i].path,
                        current: current,
                    });
                } else if (name.endsWith('.tex')) {
                    tex_docs.push({
                        path: docs[i].path,
                        id: docs[i].doc.id,
                    });
                } else if (!name.endsWith('.bib')) {  // TODO: any other file extensions to ignore?
                    try {
                        var docLines = await new Promise((resolve, reject) => {
                            idecopy.socket.emit('joinDoc', docs[i].doc.id, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                                if (error) {
                                    reject(error);
                                    return;
                                }
                                resolve(docLines);
                            });
                        });
                    } catch (err) {
                        console.log(err);
                        endRecompile('Failed to read doc ' + docs[i].path);
                        return;
                    }
                    text = docLines.join('\n');
                    file_env.push({
                        path: docs[i].path,
                        text: text,
                    })
                }
            }

            console.log('Hltex docs: ', hltex_docs);
            console.log('Tex docs: ', tex_docs);
            console.log('File env:', file_env);

            // why doesn't javascript have hashmaps
            for (var i = 0; i < hltex_docs.length; i++) {
                var hltex_path = hltex_docs[i].path;
                console.log('Hltex path: ', hltex_path);
                var tex_path = hltex_path.slice(0, -6) + '.tex';
                console.log('Tex path: ', tex_path);
                for (var j = 0; j < tex_docs.length; j++) {
                    // console.log('Examining tex doc:', tex_docs[j]);
                    if (tex_docs[j].path == tex_path) {
                        hltex_docs[i].tex_id = tex_docs[j].id;
                    }
                }
                // console.log('Tex id: ', hltex_docs[i].tex_id);
                // console.log('Hltex doc:', hltex_docs[i]);
                if (!hltex_docs[i].tex_id) {
                    var folder = window._ide.$scope.rootFolder;
                    var path = hltex_path.split('/');
                    // console.log('Hltex path', hltex_path);
                    // console.log('Children:', folder.children);
                    for (var j = 0; j < path.length - 1; j++) {
                        var matched = false;
                        for (var k = 0; k < folder.children.length; k++) {
                            // console.log('Examining', folder.children[k], path[j]);
                            if (folder.children[k].type == 'folder' && folder.children[k].name == path[j]) {
                                // console.log('Matched');
                                folder = folder.children[k];
                                matched = true;
                                break;
                            }
                        }
                        if (!matched) {
                            endRecompile('Failed to create tex doc for ' + hltex_path);
                            return;
                        }
                    }

                    // console.log('Doc name:', hltex_docs[i].name);
                    // console.log('Sliced name:', hltex_docs[i].name.slice(0, -6));

                    console.log('Creating tex doc', hltex_path);
                    try {
                        res = await _ide.fileTreeManager.createDoc(hltex_docs[i].name.slice(0, -6) + '.tex', folder)
                    } catch(err) {
                        console.log(err);
                        endRecompile('Failed to create tex doc for ' + hltex_path);
                        return;
                    }
                    console.log(res);
                    hltex_docs[i].tex_id = res.data._id;
                    // await new Promise(resolve => setTimeout(resolve, 1000));
                }

                console.log('Current:', hltex_docs[i]);
                if (hltex_docs[i].current) {
                    var tex_id = hltex_docs[i].tex_id;
                    window._ide.editorManager.getCurrentDocId = function() {
                        if (window.recompiling) {
                            console.log('Returning', tex_id);
                            return tex_id;
                        } else {
                            return window._ide.$scope.editor.open_doc_id;
                        }
                    }

                    window._ide.editorManager.getCurrentDocValue = function() {
                        if (window.recompiling) {
                            return "\\documentclass";
                        } else {
                            var ref;
                            return (ref = this.$scope.editor.sharejs_doc) != null ? ref.getSnapshot() : void 0;
                        }
                    }
                }
            }

            if (noCurrent) {
                window._ide.editorManager.getCurrentDocId = function() {
                    return window._ide.$scope.editor.open_doc_id;
                }

                window._ide.editorManager.getCurrentDocValue = function() {
                    var ref;
                    return (ref = this.$scope.editor.sharejs_doc) != null ? ref.getSnapshot() : void 0;
                }
            }

            var e = new CustomEvent('readytoparse', { detail: { docs: hltex_docs, file_env: file_env } });
            document.dispatchEvent(e);
        }

        document.addEventListener('readytocompile', async function(e) {
            e.preventDefault();

            console.log('Received response', e.detail);

            if (!e.detail) {
                // alert('Chrome native messaging failed');
                endRecompile('Chrome native messaging failed');
                return;
            }

            if (!e.detail.docs) {
                // alert('Chrome native messaging raised `' + e.detail.error + '`');
                endRecompile('Chrome native messaging raised `' + e.detail.error + '`');
                return;
            }
            var docs = e.detail.docs;
            var blobs = e.detail.blobs

            console.log('Received readytocompile');
            console.log('Tex docs: ', docs);

            console.log('Uploading blobs');
            for (var i = 0; i < blobs.length; i++) {
                // var blob = new Blob(['{"text": "hi"}']);
                var blob = strToBlob(blobs[i].blobText, blobs[i].blobType);
                var formData = new FormData();
                var filename = blobs[i].path.split('\\').pop().split('/').pop();
                formData.append("qqfile", blob, filename);
                var request = new XMLHttpRequest();
                request.open("POST", window.project_id + '/upload?folder_id=' + window._ide.$scope.rootFolder.id + '&_csrf=' + window.csrfToken)
                request.onload = function(a) {
                    console.log(a);
                }
                request.send(formData);
            }

            for (var i = 0; i < docs.length; i++) {
                if (docs[i].text) {
                    if (docs[i].current) {
                        _ide.$scope.editor.sharejs_doc.ace.session.clearAnnotations();
                    }
                    try {
                        await new Promise((resolve, reject) => {
                            idecopy.socket.emit('joinDoc', docs[i].id, { encodeRanges: true }, function (error, docLines, version, updates, ranges) {
                                if (error) {
                                    console.log(error);
                                    reject(error);
                                    return;
                                }
                                idecopy.socket.emit('applyOtUpdate', docs[i].id, { doc: docs[i].id, op: [
                                    {"p": 0, "d": docLines.join('\n')},
                                    {"p": 0, "i": docs[i].text}
                                ], v: version }, function(error) {
                                    if (error) {
                                        console.log(error);
                                        reject(error);
                                        return;
                                    }
                                    resolve();
                                })
                            });
                        });
                    } catch (err) {
                        console.log(error);
                        endRecompile('Failed to sync compiled tex with tex doc');
                        return;
                    }

                } else if (docs[i].current) {
                    _ide.$scope.editor.sharejs_doc.ace.session.setAnnotations([{
                        row: docs[i].line,
                        column: 0,
                        start_row: docs[i].line,
                        start_col: 0,
                        end_row: docs[i].line,
                        end_col: 0,
                        suppressed: false,
                        type: "error",
                        text: docs[i].error,
                    }]);
                    endRecompile();
                    return;
                }
            }

            oldRecompile({});
            setTimeout(function() {
                endRecompile();
            }, 1000);

        });

        var old_element = document.getElementsByClassName('btn-recompile')[0];
        var new_element = old_element.cloneNode(true);
        old_element.parentNode.replaceChild(new_element, old_element);
        new_element.addEventListener('click', function(e) {
            e.preventDefault();
            window._ide.$scope.recompile()
        });

        new_element.id = 'recompilebutton';
        document.getElementsByClassName('btn-recompile')[1].style.visibility = 'hidden';
        document.getElementsByClassName('btn-recompile')[0].style["border-top-right-radius"] = '25px';
        document.getElementsByClassName('btn-recompile')[0].style["border-bottom-right-radius"] = '25px';

        function getScopes(root) {
            var scopes = [];

            function visit(scope) {
                scopes.push(scope);
            }
            function traverse(scope) {
                visit(scope);
                if (scope.$$nextSibling)
                    traverse(scope.$$nextSibling);
                if (scope.$$childHead)
                    traverse(scope.$$childHead);
            }

            traverse(root);
            return scopes;
        }

        var scopes = getScopes(_ide.$scope)
        var editor_scope = null;

        for (var i = 0; i < scopes.length; i++) {
                if (scopes[i].onSave) {
                        console.log(i);
                editor_scope = i;
            }
        }

        scopes[editor_scope].onSave = _ide.$scope.recompile

        _ide.$scope.$on('doc:opened', function() {
            setTimeout(function() {
                if (_ide.$scope.editor.open_doc_name.endsWith('.hltex')) {
                    _ide.$scope.editor.sharejs_doc.ace.session.setMode('ace/mode/hltex');
                }
            }, 50);
        });

        ace.define("ace/mode/hltex_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function(require, exports, module) {
            "use strict";
            var oop = require("../lib/oop")
            , TextHighlightRules = require("./text_highlight_rules").TextHighlightRules
            , LatexHighlightRules = function() {
                this.$rules = {
                    start: [{
                        token: "comment",
                        regex: "%.*$"
                    }, {
                        token: ["keyword", "lparen", "variable.parameter", "rparen", "lparen", "storage.type", "rparen"],
                        regex: "(\\\\(?:documentclass|usepackage|input))(?:(\\[)([^\\]]*)(\\]))?({)([^}]*)(})"
                    }, {  // split preamble from document
                        token: ["constant.character.escape"],
                        regex: "(^\\s*===\\s*$)"
                    }, {
                        token: ["keyword", "lparen", "variable.parameter", "rparen"],
                        regex: "(\\\\(?:label|v?ref|cite(?:[^{]*)))(?:({)([^}]*)(}))?"
                    }, {
                        token: ["storage.type", "lparen", "variable.parameter", "rparen"],
                        regex: "(\\\\begin)({)(verbatim)(})",
                        next: "verbatim"
                    }, {
                        token: ["storage.type", "lparen", "variable.parameter", "rparen"],
                        regex: "(\\\\begin)({)(lstlisting)(})",
                        next: "lstlisting"
                    }, {
                        token: ["storage.type", "lparen", "variable.parameter", "rparen"],
                        regex: "(\\\\(?:begin|end))({)([\\w*]*)(})"
                    }, {
                        token: "storage.type",
                        regex: /\\verb\b\*?/,
                        next: [{
                            token: ["keyword.operator", "string", "keyword.operator"],
                            regex: "(.)(.*?)(\\1|$)|",
                            next: "start"
                        }]
                    }, {
                        token: "storage.type",
                        regex: "\\\\[a-zA-Z]+"
                    }, {
                        token: "lparen",
                        regex: "[[({]"
                    }, {
                        token: "rparen",
                        regex: "[\\])}]"
                    }, {
                        token: "constant.character.escape",
                        regex: "\\\\[^a-zA-Z]?"
                    }, {
                        token: "string",
                        regex: "\\${1,2}",
                        next: "equation"
                    }],
                    equation: [{
                        token: "comment",
                        regex: "%.*$"
                    }, {
                        token: "string",
                        regex: "\\${1,2}",
                        next: "start"
                    }, {
                        token: "constant.character.escape",
                        regex: "\\\\(?:[^a-zA-Z]|[a-zA-Z]+)"
                    }, {
                        token: "error",
                        regex: "^\\s*$",
                        next: "start"
                    }, {
                        defaultToken: "string"
                    }],
                    verbatim: [{
                        token: ["storage.type", "lparen", "variable.parameter", "rparen"],
                        regex: "(\\\\end)({)(verbatim)(})",
                        next: "start"
                    }, {
                        defaultToken: "text"
                    }],
                    lstlisting: [{
                        token: ["storage.type", "lparen", "variable.parameter", "rparen"],
                        regex: "(\\\\end)({)(lstlisting)(})",
                        next: "start"
                    }, {
                        defaultToken: "text"
                    }]
                },
                this.normalizeRules()
            };
            oop.inherits(LatexHighlightRules, TextHighlightRules),
            exports.LatexHighlightRules = LatexHighlightRules
        });

        // ace.define("ace/mode/folding/hltex", ["require", "exports", "module", "ace/lib/oop", "ace/mode/folding/fold_mode", "ace/range", "ace/token_iterator"], function(require, exports, module) {
        //     "use strict";
        //     var oop = require("../../lib/oop")
        //     , BaseFoldMode = require("./fold_mode").FoldMode
        //     , Range = require("../../range").Range
        //     , TokenIterator = require("../../token_iterator").TokenIterator
        //     , keywordLevels = {
        //         "\\subparagraph": 1,
        //         "\\paragraph": 2,
        //         "\\subsubsubsection": 3,
        //         "\\subsubsection": 4,
        //         "\\subsection": 5,
        //         "\\section": 6,
        //         "\\chapter": 7,
        //         "\\part": 8,
        //         "\\begin": 9,
        //         "\\end": 10
        //     }
        //     , FoldMode = exports.FoldMode = function() {}
        //     ;
        //     oop.inherits(FoldMode, BaseFoldMode),
        //     function() {
        //         this.foldingStartMarker = /^\s*\\(begin)|\s*\\(part|chapter|(?:sub)*(?:section|paragraph))\b|{\s*$/,
        //         this.foldingStopMarker = /^\s*\\(end)\b|^\s*}/,
        //         this.getFoldWidgetRange = function(session, foldStyle, row) {
        //             var line = session.doc.getLine(row)
        //             , match = this.foldingStartMarker.exec(line);
        //             if (match)
        //                 return match[1] ? this.latexBlock(session, row, match[0].length - 1) : match[2] ? this.latexSection(session, row, match[0].length - 1) : this.openingBracketBlock(session, "{", row, match.index);
        //             var match = this.foldingStopMarker.exec(line);
        //             return match ? match[1] ? this.latexBlock(session, row, match[0].length - 1) : this.closingBracketBlock(session, "}", row, match.index + match[0].length) : void 0
        //         }
        //         ,
        //         this.latexBlock = function(session, row, column, returnRange) {
        //             var keywords = {
        //                 "\\begin": 1,
        //                 "\\end": -1
        //             }
        //             , stream = new TokenIterator(session,row,column)
        //             , token = stream.getCurrentToken();
        //             if (token && ("storage.type" == token.type || "constant.character.escape" == token.type)) {
        //                 var val = token.value
        //                 , dir = keywords[val]
        //                 , getType = function() {
        //                     var token = stream.stepForward()
        //                     , type = "lparen" == token.type ? stream.stepForward().value : "";
        //                     return -1 === dir && (stream.stepBackward(),
        //                     type && stream.stepBackward()),
        //                     type
        //                 }
        //                 , stack = [getType()]
        //                 , startColumn = -1 === dir ? stream.getCurrentTokenColumn() : session.getLine(row).length
        //                 , startRow = row;
        //                 for (stream.step = -1 === dir ? stream.stepBackward : stream.stepForward; token = stream.step(); )
        //                     if (token && ("storage.type" == token.type || "constant.character.escape" == token.type)) {
        //                         var level = keywords[token.value];
        //                         if (level) {
        //                             var type = getType();
        //                             if (level === dir)
        //                                 stack.unshift(type);
        //                             else if (stack.shift() !== type || !stack.length)
        //                                 break
        //                         }
        //                     }
        //                 if (!stack.length) {
        //                     if (1 == dir && (stream.stepBackward(),
        //                     stream.stepBackward()),
        //                     returnRange)
        //                         return stream.getCurrentTokenRange();
        //                     var row = stream.getCurrentTokenRow();
        //                     return -1 === dir ? new Range(row,session.getLine(row).length,startRow,startColumn) : new Range(startRow,startColumn,row,stream.getCurrentTokenColumn())
        //                 }
        //             }
        //         }
        //         ,
        //         this.latexSection = function(session, row, column) {
        //             var stream = new TokenIterator(session,row,column)
        //             , token = stream.getCurrentToken();
        //             if (token && "storage.type" == token.type) {
        //                 for (var startLevel = keywordLevels[token.value] || 0, stackDepth = 0, endRow = row; token = stream.stepForward(); )
        //                     if ("storage.type" === token.type) {
        //                         var level = keywordLevels[token.value] || 0;
        //                         if (level >= 9) {
        //                             if (stackDepth || (endRow = stream.getCurrentTokenRow() - 1),
        //                             stackDepth += 9 == level ? 1 : -1,
        //                             0 > stackDepth)
        //                                 break
        //                         } else if (level >= startLevel)
        //                             break
        //                     }
        //                 for (stackDepth || (endRow = stream.getCurrentTokenRow() - 1); endRow > row && !/\S/.test(session.getLine(endRow)); )
        //                     endRow--;
        //                 return new Range(row,session.getLine(row).length,endRow,session.getLine(endRow).length)
        //             }
        //         }
        //     }
        //     .call(FoldMode.prototype)
        // });

        ace.define("ace/mode/behaviour/hltex", ["require", "exports", "module", "ace/lib/oop", "ace/mode/behaviour", "ace/token_iterator", "ace/lib/lang"], function(require, exports, module) {
            "use strict";
            var context, oop = require("../../lib/oop"), Behaviour = require("../behaviour").Behaviour, TokenIterator = require("../../token_iterator").TokenIterator, SAFE_INSERT_IN_TOKENS = (require("../../lib/lang"),
            ["text", "paren.rparen", "punctuation.operator"]), SAFE_INSERT_BEFORE_TOKENS = ["text", "paren.rparen", "punctuation.operator", "comment"], contextCache = {}, initContext = function(editor) {
                var id = -1;
                return editor.multiSelect && (id = editor.selection.index,
                contextCache.rangeCount != editor.multiSelect.rangeCount && (contextCache = {
                    rangeCount: editor.multiSelect.rangeCount
                })),
                contextCache[id] ? context = contextCache[id] : void (context = contextCache[id] = {
                    autoInsertedBrackets: 0,
                    autoInsertedRow: -1,
                    autoInsertedLineEnd: "",
                    maybeInsertedBrackets: 0,
                    maybeInsertedRow: -1,
                    maybeInsertedLineStart: "",
                    maybeInsertedLineEnd: ""
                })
            }, getWrapped = function(selection, selected, opening, closing) {
                var rowDiff = selection.end.row - selection.start.row;
                return {
                    text: opening + selected + closing,
                    selection: [0, selection.start.column + 1, rowDiff, selection.end.column + (rowDiff ? 0 : 1)]
                }
            }, LatexBehaviour = function() {
                this.add("braces", "insertion", function(state, action, editor, session, text) {
                    if (!(editor.completer && editor.completer.popup && editor.completer.popup.isOpen)) {
                        var cursor = editor.getCursorPosition()
                        , line = session.doc.getLine(cursor.row)
                        , lastChar = line[cursor.column - 1];
                        if ("\\" !== lastChar)
                            if ("{" == text) {
                                initContext(editor);
                                var selection = editor.getSelectionRange()
                                , selected = session.doc.getTextRange(selection);
                                if ("" !== selected && editor.getWrapBehavioursEnabled())
                                    return getWrapped(selection, selected, "{", "}");
                                if (LatexBehaviour.isSaneInsertion(editor, session))
                                    return LatexBehaviour.recordAutoInsert(editor, session, "}"),
                                    {
                                        text: "{}",
                                        selection: [1, 1]
                                    }
                            } else if ("}" == text) {
                                initContext(editor);
                                var rightChar = line.substring(cursor.column, cursor.column + 1);
                                if ("}" == rightChar) {
                                    var matching = session.$findOpeningBracket("}", {
                                        column: cursor.column + 1,
                                        row: cursor.row
                                    });
                                    if (null !== matching && LatexBehaviour.isAutoInsertedClosing(cursor, line, text))
                                        return LatexBehaviour.popAutoInsertedClosing(),
                                        {
                                            text: "",
                                            selection: [1, 1]
                                        }
                                }
                            }
                    }
                }),
                this.add("braces", "deletion", function(state, action, editor, session, range) {
                    if (!(editor.completer && editor.completer.popup && editor.completer.popup.isOpen)) {
                        var selected = session.doc.getTextRange(range);
                        if (!range.isMultiLine() && "{" == selected) {
                            initContext(editor);
                            var line = session.doc.getLine(range.start.row)
                            , rightChar = line.substring(range.start.column + 1, range.start.column + 2);
                            if ("}" == rightChar)
                                return range.end.column++,
                                range
                        }
                    }
                }),
                this.add("brackets", "insertion", function(state, action, editor, session, text) {
                    if (!(editor.completer && editor.completer.popup && editor.completer.popup.isOpen)) {
                        var cursor = editor.getCursorPosition()
                        , line = session.doc.getLine(cursor.row)
                        , lastChar = line[cursor.column - 1];
                        if ("\\" !== lastChar)
                            if ("[" == text) {
                                initContext(editor);
                                var selection = editor.getSelectionRange()
                                , selected = session.doc.getTextRange(selection);
                                if ("" !== selected && editor.getWrapBehavioursEnabled())
                                    return getWrapped(selection, selected, "[", "]");
                                if (LatexBehaviour.isSaneInsertion(editor, session))
                                    return LatexBehaviour.recordAutoInsert(editor, session, "]"),
                                    {
                                        text: "[]",
                                        selection: [1, 1]
                                    }
                            } else if ("]" == text) {
                                initContext(editor);
                                var rightChar = line.substring(cursor.column, cursor.column + 1);
                                if ("]" == rightChar) {
                                    var matching = session.$findOpeningBracket("]", {
                                        column: cursor.column + 1,
                                        row: cursor.row
                                    });
                                    if (null !== matching && LatexBehaviour.isAutoInsertedClosing(cursor, line, text))
                                        return LatexBehaviour.popAutoInsertedClosing(),
                                        {
                                            text: "",
                                            selection: [1, 1]
                                        }
                                }
                            }
                    }
                }),
                this.add("brackets", "deletion", function(state, action, editor, session, range) {
                    if (!(editor.completer && editor.completer.popup && editor.completer.popup.isOpen)) {
                        var selected = session.doc.getTextRange(range);
                        if (!range.isMultiLine() && "[" == selected) {
                            initContext(editor);
                            var line = session.doc.getLine(range.start.row)
                            , rightChar = line.substring(range.start.column + 1, range.start.column + 2);
                            if ("]" == rightChar)
                                return range.end.column++,
                                range
                        }
                    }
                }),
                this.add("dollars", "insertion", function(state, action, editor, session, text) {
                    var cursor = editor.getCursorPosition()
                    , line = session.doc.getLine(cursor.row)
                    , lastChar = line[cursor.column - 1];
                    if ("\\" !== lastChar && "$" == text) {
                        if (this.lineCommentStart && -1 != this.lineCommentStart.indexOf(text))
                            return;
                        initContext(editor);
                        var quote = text
                        , selection = editor.getSelectionRange()
                        , selected = session.doc.getTextRange(selection);
                        if ("" !== selected && "$" !== selected && editor.getWrapBehavioursEnabled())
                            return getWrapped(selection, selected, quote, quote);
                        if (!selected) {
                            var pair, leftChar = line.substring(cursor.column - 1, cursor.column), rightChar = line.substring(cursor.column, cursor.column + 1), token = session.getTokenAt(cursor.row, cursor.column), rightToken = session.getTokenAt(cursor.row, cursor.column + 1), stringBefore = token && /string|escape/.test(token.type), stringAfter = !rightToken || /string|escape/.test(rightToken.type);
                            if (rightChar == quote)
                                pair = stringBefore !== stringAfter,
                                pair && /string\.end/.test(rightToken.type) && (pair = !1);
                            else {
                                if (stringBefore && !stringAfter)
                                    return null;
                                if (stringBefore && stringAfter)
                                    return null;
                                var wordRe = session.$mode.tokenRe;
                                wordRe.lastIndex = 0;
                                var isWordBefore = wordRe.test(leftChar);
                                wordRe.lastIndex = 0;
                                var isWordAfter = wordRe.test(leftChar);
                                if (isWordBefore || isWordAfter)
                                    return null;
                                if (rightChar && !/[\s;,.})\]\\]/.test(rightChar))
                                    return null;
                                pair = !0
                            }
                            return {
                                text: pair ? quote + quote : "",
                                selection: [1, 1]
                            }
                        }
                    }
                }),
                this.add("dollars", "deletion", function(state, action, editor, session, range) {
                    var selected = session.doc.getTextRange(range);
                    if (!range.isMultiLine() && "$" == selected) {
                        initContext(editor);
                        var line = session.doc.getLine(range.start.row)
                        , rightChar = line.substring(range.start.column + 1, range.start.column + 2);
                        if (rightChar == selected)
                            return range.end.column++,
                            range
                    }
                })
            };
            LatexBehaviour.isSaneInsertion = function(editor, session) {
                var cursor = editor.getCursorPosition()
                , iterator = new TokenIterator(session,cursor.row,cursor.column);
                if (!this.$matchTokenType(iterator.getCurrentToken() || "text", SAFE_INSERT_IN_TOKENS)) {
                    var iterator2 = new TokenIterator(session,cursor.row,cursor.column + 1);
                    if (!this.$matchTokenType(iterator2.getCurrentToken() || "text", SAFE_INSERT_IN_TOKENS))
                        return !1
                }
                return iterator.stepForward(),
                iterator.getCurrentTokenRow() !== cursor.row || this.$matchTokenType(iterator.getCurrentToken() || "text", SAFE_INSERT_BEFORE_TOKENS)
            }
            ,
            LatexBehaviour.$matchTokenType = function(token, types) {
                return types.indexOf(token.type || token) > -1
            }
            ,
            LatexBehaviour.recordAutoInsert = function(editor, session, bracket) {
                var cursor = editor.getCursorPosition()
                , line = session.doc.getLine(cursor.row);
                this.isAutoInsertedClosing(cursor, line, context.autoInsertedLineEnd[0]) || (context.autoInsertedBrackets = 0),
                context.autoInsertedRow = cursor.row,
                context.autoInsertedLineEnd = bracket + line.substr(cursor.column),
                context.autoInsertedBrackets++
            }
            ,
            LatexBehaviour.isAutoInsertedClosing = function(cursor, line, bracket) {
                return context.autoInsertedBrackets > 0 && cursor.row === context.autoInsertedRow && bracket === context.autoInsertedLineEnd[0] && line.substr(cursor.column) === context.autoInsertedLineEnd
            }
            ,
            LatexBehaviour.popAutoInsertedClosing = function() {
                context.autoInsertedLineEnd = context.autoInsertedLineEnd.substr(1),
                context.autoInsertedBrackets--
            }
            ,
            oop.inherits(LatexBehaviour, Behaviour),
            exports.LatexBehaviour = LatexBehaviour
        });

        ace.define("ace/mode/hltex", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text",
            "ace/mode/hltex_highlight_rules",
            // "ace/mode/folding/hltex",
            "ace/mode/behaviour/hltex",
            "ace/range"], function(require, exports, module) {
            "use strict";
            var oop = require("../lib/oop")
            , TextMode = require("./text").Mode
            , LatexHighlightRules = require("./hltex_highlight_rules").LatexHighlightRules
            // , LatexFoldMode = require("./folding/hltex").FoldMode
            , Range = require("../range").Range;
            var LatexBehaviour = require("./behaviour/hltex").LatexBehaviour;
            var Mode = function() {
                this.HighlightRules = LatexHighlightRules;
                // this.foldingRules = new LatexFoldMode
                this.$behaviour = new LatexBehaviour;
            };
            oop.inherits(Mode, TextMode);
            (function() {
                this.type = "text",
                this.lineCommentStart = "%",
                this.$id = "ace/mode/hltex"
            }).call(Mode.prototype);
            exports.Mode = Mode;
        });

        define("ace/mode-hltex", function() {});

        clearInterval(interval);
    }
}, 500);
