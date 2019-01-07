/* eslint-disable
    camelcase,
    max-len,
    no-cond-assign,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define('ide/pdf/controllers/PdfController',['base', 'ace/ace', 'ide/human-readable-logs/HumanReadableLogs', 'libs/bib-log-parser'], function (App, Ace, HumanReadableLogs, BibLogParser) {
  var AUTO_COMPILE_MAX_WAIT = 5000;
  // We add a 1 second debounce to sending user changes to server if they aren't
  // collaborating with anyone. This needs to be higher than that, and allow for
  // client to server latency, otherwise we compile before the op reaches the server
  // and then again on ack.
  var AUTO_COMPILE_DEBOUNCE = 2000;

  App.filter('trusted', ['$sce', function ($sce) {
    return function (url) {
      return $sce.trustAsResourceUrl(url);
    };
  }]);

  App.controller('PdfController', function ($scope, $http, ide, $modal, synctex, event_tracking, localStorage) {
    // enable per-user containers by default
    var perUserCompile = true;
    var autoCompile = true;

    // pdf.view = uncompiled | pdf | errors
    $scope.pdf.view = __guard__($scope != null ? $scope.pdf : undefined, function (x) {
      return x.url;
    }) ? 'pdf' : 'uncompiled';
    $scope.shouldShowLogs = false;
    $scope.wikiEnabled = window.wikiEnabled;

    // view logic to check whether the files dropdown should "drop up" or "drop down"
    $scope.shouldDropUp = false;

    var logsContainerEl = document.querySelector('.pdf-logs');
    var filesDropdownEl = logsContainerEl != null ? logsContainerEl.querySelector('.files-dropdown') : undefined;

    // get the top coordinate of the files dropdown as a ratio (to the logs container height)
    // logs container supports scrollable content, so it's possible that ratio > 1.
    var getFilesDropdownTopCoordAsRatio = function getFilesDropdownTopCoordAsRatio() {
      return (filesDropdownEl != null ? filesDropdownEl.getBoundingClientRect().top : undefined) / (logsContainerEl != null ? logsContainerEl.getBoundingClientRect().height : undefined);
    };

    $scope.$watch('shouldShowLogs', function (shouldShow) {
      if (shouldShow) {
        return $scope.$applyAsync(function () {
          return $scope.shouldDropUp = getFilesDropdownTopCoordAsRatio() > 0.65;
        });
      }
    });

    $scope.trackLogHintsLearnMore = function () {
      return event_tracking.sendMB('logs-hints-learn-more');
    };

    if (ace.require('ace/lib/useragent').isMac) {
      $scope.modifierKey = 'Cmd';
    } else {
      $scope.modifierKey = 'Ctrl';
    }

    // utility for making a query string from a hash, could use jquery $.param
    var createQueryString = function createQueryString(args) {
      var qs_args = function () {
        var result = [];
        for (var k in args) {
          var v = args[k];
          result.push(k + '=' + v);
        }
        return result;
      }();
      if (qs_args.length) {
        return '?' + qs_args.join('&');
      } else {
        return '';
      }
    };

    $scope.stripHTMLFromString = function (htmlStr) {
      var tmp = document.createElement('DIV');
      tmp.innerHTML = htmlStr;
      return tmp.textContent || tmp.innerText || '';
    };

    $scope.$on('project:joined', function () {
      if (!autoCompile) {
        return;
      }
      autoCompile = false;
      $scope.recompile({ isAutoCompileOnLoad: true });
      return $scope.hasPremiumCompile = $scope.project.features.compileGroup === 'priority';
    });

    $scope.$on('pdf:error:display', function () {
      $scope.pdf.view = 'errors';
      return $scope.pdf.renderingError = true;
    });

    var autoCompileInterval = null;
    var autoCompileIfReady = function autoCompileIfReady() {
      if ($scope.pdf.compiling || !$scope.autocompile_enabled) {
        return;
      }

      // Only checking linting if syntaxValidation is on and visible to the user
      var autoCompileLintingError = ide.$scope.hasLintingError && ide.$scope.settings.syntaxValidation;
      if ($scope.autoCompileLintingError !== autoCompileLintingError) {
        $scope.$apply(function () {
          $scope.autoCompileLintingError = autoCompileLintingError;
          // We've likely been waiting a while until the user fixed the linting, but we
          // don't want to compile as soon as it is fixed, so reset the timeout.
          $scope.startedTryingAutoCompileAt = Date.now();
          return $scope.docLastChangedAt = Date.now();
        });
      }
      if (autoCompileLintingError && $scope.stop_on_validation_error) {
        return;
      }

      // If there's a longish compile, don't compile immediately after if user is still typing
      var startedTryingAt = Math.max($scope.startedTryingAutoCompileAt, $scope.lastFinishedCompileAt || 0);

      var timeSinceStartedTrying = Date.now() - startedTryingAt;
      var timeSinceLastChange = Date.now() - $scope.docLastChangedAt;

      var shouldCompile = false;
      if (timeSinceLastChange > AUTO_COMPILE_DEBOUNCE) {
        // Don't compile in the middle of the user typing
        shouldCompile = true;
      } else if (timeSinceStartedTrying > AUTO_COMPILE_MAX_WAIT) {
        // Unless they type for a long time
        shouldCompile = true;
      } else if (timeSinceStartedTrying < 0 || timeSinceLastChange < 0) {
        // If time is non-monotonic, assume that the user's system clock has been
        // changed and continue with compile
        shouldCompile = true;
      }

      if (shouldCompile) {
        return triggerAutoCompile();
      }
    };

    var triggerAutoCompile = function triggerAutoCompile() {
      return $scope.recompile({ isAutoCompileOnChange: true });
    };

    var startTryingAutoCompile = function startTryingAutoCompile() {
      if (autoCompileInterval != null) {
        return;
      }
      $scope.startedTryingAutoCompileAt = Date.now();
      return autoCompileInterval = setInterval(autoCompileIfReady, 200);
    };

    var stopTryingAutoCompile = function stopTryingAutoCompile() {
      clearInterval(autoCompileInterval);
      return autoCompileInterval = null;
    };

    $scope.$watch('uncompiledChanges', function (uncompiledChanges) {
      if (uncompiledChanges) {
        return startTryingAutoCompile();
      } else {
        return stopTryingAutoCompile();
      }
    });

    $scope.uncompiledChanges = false;
    var recalculateUncompiledChanges = function recalculateUncompiledChanges() {
      if (!$scope.autocompile_enabled) {
        // Auto-compile was disabled
        $scope.uncompiledChanges = false;
      }
      if ($scope.ui.pdfHidden) {
        // Don't bother auto-compiling if pdf isn't visible
        return $scope.uncompiledChanges = false;
      } else if ($scope.docLastChangedAt == null) {
        return $scope.uncompiledChanges = false;
      } else if ($scope.lastStartedCompileAt == null || $scope.docLastChangedAt > $scope.lastStartedCompileAt) {
        return $scope.uncompiledChanges = true;
      } else {
        return $scope.uncompiledChanges = false;
      }
    };

    var _updateDocLastChangedAt = function _updateDocLastChangedAt() {
      $scope.docLastChangedAt = Date.now();
      return recalculateUncompiledChanges();
    };

    var onDocChanged = function onDocChanged() {
      $scope.autoCompileLintingError = false;
      return _updateDocLastChangedAt();
    };

    var onDocSaved = function onDocSaved() {
      return (
        // We use the save as a trigger too, to account for the delay between the client
        // and server. Otherwise, we might have compiled after the user made
        // the change on the client, but before the server had it.
        _updateDocLastChangedAt()
      );
    };

    var onCompilingStateChanged = function onCompilingStateChanged(compiling) {
      return recalculateUncompiledChanges();
    };

    var autoCompileListeners = [];
    var toggleAutoCompile = function toggleAutoCompile(enabling) {
      if (enabling) {
        return autoCompileListeners = [ide.$scope.$on('doc:changed', onDocChanged), ide.$scope.$on('doc:saved', onDocSaved), $scope.$watch('pdf.compiling', onCompilingStateChanged)];
      } else {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = Array.from(autoCompileListeners)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var unbind = _step.value;

            unbind();
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        autoCompileListeners = [];
        return $scope.autoCompileLintingError = false;
      }
    };

    $scope.autocompile_enabled = localStorage('autocompile_enabled:' + $scope.project_id) || false;
    $scope.$watch('autocompile_enabled', function (newValue, oldValue) {
      if (newValue != null && oldValue !== newValue) {
        localStorage('autocompile_enabled:' + $scope.project_id, newValue);
        toggleAutoCompile(newValue);
        return event_tracking.sendMB('autocompile-setting-changed', {
          value: newValue
        });
      }
    });

    if ($scope.autocompile_enabled) {
      toggleAutoCompile(true);
    }

    // abort compile if syntax checks fail
    $scope.stop_on_validation_error = localStorage('stop_on_validation_error:' + $scope.project_id);
    if ($scope.stop_on_validation_error == null) {
      $scope.stop_on_validation_error = true;
    } // turn on for all users by default
    $scope.$watch('stop_on_validation_error', function (new_value, old_value) {
      if (new_value != null && old_value !== new_value) {
        return localStorage('stop_on_validation_error:' + $scope.project_id, new_value);
      }
    });

    $scope.draft = localStorage('draft:' + $scope.project_id) || false;
    $scope.$watch('draft', function (new_value, old_value) {
      if (new_value != null && old_value !== new_value) {
        return localStorage('draft:' + $scope.project_id, new_value);
      }
    });

    var sendCompileRequest = function sendCompileRequest(options) {
      if (options == null) {
        options = {};
      }
      var url = '/project/' + $scope.project_id + '/compile';
      var params = {};
      if (options.isAutoCompileOnLoad || options.isAutoCompileOnChange) {
        params['auto_compile'] = true;
      }
      // if the previous run was a check, clear the error logs
      if ($scope.check) {
        $scope.pdf.logEntries = [];
      }
      // keep track of whether this is a compile or check
      $scope.check = !!options.check;
      if (options.check) {
        event_tracking.sendMB('syntax-check-request');
      }
      // send appropriate check type to clsi
      var checkType = function () {
        switch (false) {
          case !$scope.check:
            return 'validate'; // validate only
          case !options.try:
            return 'silent'; // allow use to try compile once
          case !$scope.stop_on_validation_error:
            return 'error'; // try to compile
          default:
            return 'silent'; // ignore errors
        }
      }();
      // FIXME: Temporarily disable syntax checking as it is causing
      // excessive support requests for projects migrated from v1
      // https://github.com/overleaf/sharelatex/issues/911
      if (checkType === 'error') {
        checkType = 'silent';
      }
      return $http.post(url, {
        rootDoc_id: options.rootDocOverride_id || null,
        draft: $scope.draft,
        check: checkType,
        // use incremental compile for all users but revert to a full
        // compile if there is a server error
        incrementalCompilesEnabled: !$scope.pdf.error,
        _csrf: window.csrfToken
      }, { params: params });
    };

    var buildPdfDownloadUrl = function buildPdfDownloadUrl(pdfDownloadDomain, path) {
      // we only download builds from compiles server for security reasons
      if (pdfDownloadDomain != null && path != null && path.indexOf('build') !== -1) {
        return '' + pdfDownloadDomain + path;
      } else {
        return path;
      }
    };

    var parseCompileResponse = function parseCompileResponse(response) {
      // keep last url
      var file = void 0;
      var last_pdf_url = $scope.pdf.url;
      var pdfDownloadDomain = response.pdfDownloadDomain;
      // Reset everything

      $scope.pdf.error = false;
      $scope.pdf.timedout = false;
      $scope.pdf.failure = false;
      $scope.pdf.url = null;
      $scope.pdf.clsiMaintenance = false;
      $scope.pdf.tooRecentlyCompiled = false;
      $scope.pdf.renderingError = false;
      $scope.pdf.projectTooLarge = false;
      $scope.pdf.compileTerminated = false;
      $scope.pdf.compileExited = false;
      $scope.pdf.failedCheck = false;
      $scope.pdf.compileInProgress = false;
      $scope.pdf.autoCompileDisabled = false;

      // make a cache to look up files by name
      var fileByPath = {};
      if ((response != null ? response.outputFiles : undefined) != null) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = Array.from(response != null ? response.outputFiles : undefined)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            file = _step2.value;

            fileByPath[file.path] = file;
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }

      // prepare query string
      var qs = {};
      // add a query string parameter for the compile group
      if (response.compileGroup != null) {
        ide.compileGroup = qs.compileGroup = response.compileGroup;
      }
      // add a query string parameter for the clsi server id
      if (response.clsiServerId != null) {
        ide.clsiServerId = qs.clsiserverid = response.clsiServerId;
      }

      if (response.status === 'timedout') {
        $scope.pdf.view = 'errors';
        $scope.pdf.timedout = true;
        fetchLogs(fileByPath, { pdfDownloadDomain: pdfDownloadDomain });
      } else if (response.status === 'terminated') {
        $scope.pdf.view = 'errors';
        $scope.pdf.compileTerminated = true;
        fetchLogs(fileByPath, { pdfDownloadDomain: pdfDownloadDomain });
      } else if (['validation-fail', 'validation-pass'].includes(response.status)) {
        $scope.pdf.view = 'pdf';
        $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, last_pdf_url);
        $scope.shouldShowLogs = true;
        if (response.status === 'validation-fail') {
          $scope.pdf.failedCheck = true;
        }
        event_tracking.sendMB('syntax-check-' + response.status);
        fetchLogs(fileByPath, { validation: true, pdfDownloadDomain: pdfDownloadDomain });
      } else if (response.status === 'exited') {
        $scope.pdf.view = 'pdf';
        $scope.pdf.compileExited = true;
        $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, last_pdf_url);
        $scope.shouldShowLogs = true;
        fetchLogs(fileByPath, { pdfDownloadDomain: pdfDownloadDomain });
      } else if (response.status === 'autocompile-backoff') {
        if ($scope.pdf.isAutoCompileOnLoad) {
          // initial autocompile
          $scope.pdf.view = 'uncompiled';
        } else {
          // background autocompile from typing
          $scope.pdf.view = 'errors';
          $scope.pdf.autoCompileDisabled = true;
          $scope.autocompile_enabled = false; // disable any further autocompiles
          event_tracking.sendMB('autocompile-rate-limited', {
            hasPremiumCompile: $scope.hasPremiumCompile
          });
        }
      } else if (response.status === 'project-too-large') {
        $scope.pdf.view = 'errors';
        $scope.pdf.projectTooLarge = true;
      } else if (response.status === 'failure') {
        $scope.pdf.view = 'errors';
        $scope.pdf.failure = true;
        $scope.shouldShowLogs = true;
        fetchLogs(fileByPath, { pdfDownloadDomain: pdfDownloadDomain });
      } else if (response.status === 'clsi-maintenance') {
        $scope.pdf.view = 'errors';
        $scope.pdf.clsiMaintenance = true;
      } else if (response.status === 'too-recently-compiled') {
        $scope.pdf.view = 'errors';
        $scope.pdf.tooRecentlyCompiled = true;
      } else if (response.status === 'validation-problems') {
        $scope.pdf.view = 'validation-problems';
        $scope.pdf.validation = response.validationProblems;
        $scope.shouldShowLogs = false;
      } else if (response.status === 'compile-in-progress') {
        $scope.pdf.view = 'errors';
        $scope.pdf.compileInProgress = true;
      } else if (response.status === 'success') {
        var build = void 0;
        $scope.pdf.view = 'pdf';
        $scope.shouldShowLogs = false;

        // define the base url. if the pdf file has a build number, pass it to the clsi in the url
        if ((fileByPath['output.pdf'] != null ? fileByPath['output.pdf'].url : undefined) != null) {
          $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, fileByPath['output.pdf'].url);
        } else if ((fileByPath['output.pdf'] != null ? fileByPath['output.pdf'].build : undefined) != null) {
          ;build = fileByPath['output.pdf'].build;

          $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, '/project/' + $scope.project_id + '/build/' + build + '/output/output.pdf');
        } else {
          $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, '/project/' + $scope.project_id + '/output/output.pdf');
        }
        // check if we need to bust cache (build id is unique so don't need it in that case)
        if ((fileByPath['output.pdf'] != null ? fileByPath['output.pdf'].build : undefined) == null) {
          qs.cache_bust = '' + Date.now();
        }
        // convert the qs hash into a query string and append it
        $scope.pdf.url += createQueryString(qs);
        // Save all downloads as files
        qs.popupDownload = true;
        $scope.pdf.downloadUrl = '/project/' + $scope.project_id + '/output/output.pdf' + createQueryString(qs);

        fetchLogs(fileByPath, { pdfDownloadDomain: pdfDownloadDomain });
      }

      var IGNORE_FILES = ['output.fls', 'output.fdb_latexmk'];
      $scope.pdf.outputFiles = [];

      if (response.outputFiles == null) {
        return;
      }

      // prepare list of output files for download dropdown
      qs = {};
      if (response.clsiServerId != null) {
        qs.clsiserverid = response.clsiServerId;
      }
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = Array.from(response.outputFiles)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          file = _step3.value;

          if (IGNORE_FILES.indexOf(file.path) === -1) {
            var isOutputFile = /^output\./.test(file.path);
            $scope.pdf.outputFiles.push({
              // Turn 'output.blg' into 'blg file'.
              name: isOutputFile ? file.path.replace(/^output\./, '') + ' file' : file.path,
              url: '/project/' + project_id + '/output/' + file.path + createQueryString(qs),
              main: !!isOutputFile
            });
          }
        }

        // sort the output files into order, main files first, then others
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return $scope.pdf.outputFiles.sort(function (a, b) {
        return b.main - a.main || a.name.localeCompare(b.name);
      });
    };

    var fetchLogs = function fetchLogs(fileByPath, options) {
      var blgFile = void 0,
          chktexFile = void 0,
          logFile = void 0,
          response = void 0;
      if (options != null ? options.validation : undefined) {
        chktexFile = fileByPath['output.chktex'];
      } else {
        logFile = fileByPath['output.log'];
        blgFile = fileByPath['output.blg'];
      }

      var getFile = function getFile(name, file) {
        var opts = {
          method: 'GET',
          params: {
            compileGroup: ide.compileGroup,
            clsiserverid: ide.clsiServerId
          }
        };
        if ((file != null ? file.url : undefined) != null) {
          // FIXME clean this up when we have file.urls out consistently
          opts.url = file.url;
        } else if ((file != null ? file.build : undefined) != null) {
          opts.url = '/project/' + $scope.project_id + '/build/' + file.build + '/output/' + name;
        } else {
          opts.url = '/project/' + $scope.project_id + '/output/' + name;
        }
        // check if we need to bust cache (build id is unique so don't need it in that case)
        if ((file != null ? file.build : undefined) == null) {
          opts.params.cache_bust = '' + Date.now();
        }
        opts.url = buildPdfDownloadUrl(options.pdfDownloadDomain, opts.url);
        return $http(opts);
      };

      // accumulate the log entries
      var logEntries = {
        all: [],
        errors: [],
        warnings: []
      };

      var accumulateResults = function accumulateResults(newEntries) {
        return function () {
          var result = [];
          var _arr = ['all', 'errors', 'warnings'];
          for (var _i = 0; _i < _arr.length; _i++) {
            var key = _arr[_i];
            if (newEntries.type != null) {
              var _iteratorNormalCompletion4 = true;
              var _didIteratorError4 = false;
              var _iteratorError4 = undefined;

              try {
                for (var _iterator4 = Array.from(newEntries[key])[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                  var entry = _step4.value;

                  entry.type = newEntries.type;
                }
              } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion4 && _iterator4.return) {
                    _iterator4.return();
                  }
                } finally {
                  if (_didIteratorError4) {
                    throw _iteratorError4;
                  }
                }
              }
            }
            result.push(logEntries[key] = logEntries[key].concat(newEntries[key]));
          }
          return result;
        }();
      };

      // use the parsers for each file type
      var processLog = function processLog(log) {
        $scope.pdf.rawLog = log;

        var _HumanReadableLogs$pa = HumanReadableLogs.parse(log, {
          ignoreDuplicates: true
        }),
            errors = _HumanReadableLogs$pa.errors,
            warnings = _HumanReadableLogs$pa.warnings,
            typesetting = _HumanReadableLogs$pa.typesetting;

        var all = [].concat(errors, warnings, typesetting);
        return accumulateResults({ all: all, errors: errors, warnings: warnings });
      };

      var processChkTex = function processChkTex(log) {
        var errors = [];
        var warnings = [];
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = Array.from(log.split('\n'))[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var line = _step5.value;

            var m;
            if (m = line.match(/^(\S+):(\d+):(\d+): (Error|Warning): (.*)/)) {
              var result = {
                file: m[1],
                line: m[2],
                column: m[3],
                level: m[4].toLowerCase(),
                message: m[4] + ': ' + m[5]
              };
              if (result.level === 'error') {
                errors.push(result);
              } else {
                warnings.push(result);
              }
            }
          }
        } catch (err) {
          _didIteratorError5 = true;
          _iteratorError5 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }
          } finally {
            if (_didIteratorError5) {
              throw _iteratorError5;
            }
          }
        }

        var all = [].concat(errors, warnings);
        var logHints = HumanReadableLogs.parse({
          type: 'Syntax',
          all: all,
          errors: errors,
          warnings: warnings
        });
        event_tracking.sendMB('syntax-check-return-count', {
          errors: errors.length,
          warnings: warnings.length
        });
        return accumulateResults(logHints);
      };

      var processBiber = function processBiber(log) {
        var _BibLogParser$parse = BibLogParser.parse(log, {}),
            errors = _BibLogParser$parse.errors,
            warnings = _BibLogParser$parse.warnings;

        var all = [].concat(errors, warnings);
        return accumulateResults({ type: 'BibTeX', all: all, errors: errors, warnings: warnings });
      };

      // output the results
      var handleError = function handleError() {
        $scope.pdf.logEntries = [];
        return $scope.pdf.rawLog = '';
      };

      var annotateFiles = function annotateFiles() {
        $scope.pdf.logEntries = logEntries;
        $scope.pdf.logEntryAnnotations = {};
        return function () {
          var result = [];
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;
          var _iteratorError6 = undefined;

          try {
            for (var _iterator6 = Array.from(logEntries.all)[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              var entry = _step6.value;

              if (entry.file != null) {
                entry.file = normalizeFilePath(entry.file);
                var entity = ide.fileTreeManager.findEntityByPath(entry.file);
                if (entity != null) {
                  if (!$scope.pdf.logEntryAnnotations[entity.id]) {
                    $scope.pdf.logEntryAnnotations[entity.id] = [];
                  }
                  result.push($scope.pdf.logEntryAnnotations[entity.id].push({
                    row: entry.line - 1,
                    type: entry.level === 'error' ? 'error' : 'warning',
                    text: entry.message
                  }));
                } else {
                  result.push(undefined);
                }
              } else {
                result.push(undefined);
              }
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }

          return result;
        }();
      };

      // retrieve the logfile and process it
      if (logFile != null) {
        response = getFile('output.log', logFile).then(function (response) {
          return processLog(response.data);
        });

        if (blgFile != null) {
          // retrieve the blg file if present
          response = response.then(function () {
            return getFile('output.blg', blgFile).then(function (response) {
              return processBiber(response.data);
            }, function () {
              return true;
            });
          });
        }
      }

      if (response != null) {
        response.catch(handleError);
      } else {
        handleError();
      }

      if (chktexFile != null) {
        var getChkTex = function getChkTex() {
          return getFile('output.chktex', chktexFile).then(function (response) {
            return processChkTex(response.data);
          });
        };
        // always retrieve the chktex file if present
        if (response != null) {
          response = response.then(getChkTex, getChkTex);
        } else {
          response = getChkTex();
        }
      }

      // display the combined result
      if (response != null) {
        return response.finally(annotateFiles);
      }
    };

    var getRootDocOverride_id = function getRootDocOverride_id() {
      var doc = ide.editorManager.getCurrentDocValue();
      if (doc == null) {
        return null;
      }
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = Array.from(doc.split('\n'))[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var line = _step7.value;

          if (/^[^%]*\\documentclass/.test(line)) {
            return ide.editorManager.getCurrentDocId();
          }
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }

      return null;
    };

    var normalizeFilePath = function normalizeFilePath(path) {
      path = path.replace(/^(.*)\/compiles\/[0-9a-f]{24}(-[0-9a-f]{24})?\/(\.\/)?/, '');
      path = path.replace(/^\/compile\//, '');

      var rootDocDirname = ide.fileTreeManager.getRootDocDirname();
      if (rootDocDirname != null) {
        path = path.replace(/^\.\//, rootDocDirname + '/');
      }

      return path;
    };

    $scope.recompile = function (options) {
      console.log('hello from recompile!')
      if (options == null) {
        options = {};
      }
      if ($scope.pdf.compiling) {
        return;
      }

      event_tracking.sendMBSampled('editor-recompile-sampled', options);

      $scope.lastStartedCompileAt = Date.now();
      $scope.pdf.compiling = true;
      $scope.pdf.isAutoCompileOnLoad = options != null ? options.isAutoCompileOnLoad : undefined; // initial autocompile

      if (options != null ? options.force : undefined) {
        // for forced compile, turn off validation check and ignore errors
        $scope.stop_on_validation_error = false;
        $scope.shouldShowLogs = false; // hide the logs while compiling
        event_tracking.sendMB('syntax-check-turn-off-checking');
      }

      if (options != null ? options.try : undefined) {
        $scope.shouldShowLogs = false; // hide the logs while compiling
        event_tracking.sendMB('syntax-check-try-compile-anyway');
      }

      ide.$scope.$broadcast('flush-changes');

      options.rootDocOverride_id = getRootDocOverride_id();

      return sendCompileRequest(options).then(function (response) {
        var data = response.data;

        $scope.pdf.view = 'pdf';
        $scope.pdf.compiling = false;
        return parseCompileResponse(data);
      }).catch(function (response) {
        var data = response.data,
            status = response.status;

        if (status === 429) {
          $scope.pdf.rateLimited = true;
        }
        $scope.pdf.compiling = false;
        $scope.pdf.renderingError = false;
        $scope.pdf.error = true;
        return $scope.pdf.view = 'errors';
      }).finally(function () {
        return $scope.lastFinishedCompileAt = Date.now();
      });
    };

    // This needs to be public.
    ide.$scope.recompile = $scope.recompile;
    // This method is a simply wrapper and exists only for tracking purposes.
    ide.$scope.recompileViaKey = function () {
      return $scope.recompile({ keyShortcut: true });
    };

    $scope.stop = function () {
      if (!$scope.pdf.compiling) {
        return;
      }

      return $http({
        url: '/project/' + $scope.project_id + '/compile/stop',
        method: 'POST',
        params: {
          clsiserverid: ide.clsiServerId
        },
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      });
    };

    $scope.clearCache = function () {
      return $http({
        url: '/project/' + $scope.project_id + '/output',
        method: 'DELETE',
        params: {
          clsiserverid: ide.clsiServerId
        },
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      });
    };

    $scope.toggleLogs = function () {
      $scope.shouldShowLogs = !$scope.shouldShowLogs;
      if ($scope.shouldShowLogs) {
        return event_tracking.sendMBOnce('ide-open-logs-once');
      }
    };

    $scope.showPdf = function () {
      $scope.pdf.view = 'pdf';
      return $scope.shouldShowLogs = false;
    };

    $scope.toggleRawLog = function () {
      $scope.pdf.showRawLog = !$scope.pdf.showRawLog;
      if ($scope.pdf.showRawLog) {
        return event_tracking.sendMB('logs-view-raw');
      }
    };

    $scope.openClearCacheModal = function () {
      var modalInstance = void 0;
      return modalInstance = $modal.open({
        templateUrl: 'clearCacheModalTemplate',
        controller: 'ClearCacheModalController',
        scope: $scope
      });
    };

    return $scope.syncToCode = function (position) {
      return synctex.syncToCode(position).then(function (data) {
        var doc = data.doc,
            line = data.line;

        return ide.editorManager.openDoc(doc, { gotoLine: line });
      });
    };
  });

  App.factory('synctex', ['ide', '$http', '$q', function (ide, $http, $q) {
    // enable per-user containers by default
    var perUserCompile = true;

    var synctex = {
      syncToPdf: function syncToPdf(cursorPosition) {
        var deferred = $q.defer();

        var doc_id = ide.editorManager.getCurrentDocId();
        if (doc_id == null) {
          deferred.reject();
          return deferred.promise;
        }
        var doc = ide.fileTreeManager.findEntityById(doc_id);
        if (doc == null) {
          deferred.reject();
          return deferred.promise;
        }
        var path = ide.fileTreeManager.getEntityPath(doc);
        if (path == null) {
          deferred.reject();
          return deferred.promise;
        }

        // If the root file is folder/main.tex, then synctex sees the
        // path as folder/./main.tex
        var rootDocDirname = ide.fileTreeManager.getRootDocDirname();
        if (rootDocDirname != null && rootDocDirname !== '') {
          path = path.replace(RegExp('^' + rootDocDirname), rootDocDirname + '/.');
        }

        var row = cursorPosition.row,
            column = cursorPosition.column;


        $http({
          url: '/project/' + ide.project_id + '/sync/code',
          method: 'GET',
          params: {
            file: path,
            line: row + 1,
            column: column,
            clsiserverid: ide.clsiServerId
          }
        }).then(function (response) {
          var data = response.data;

          return deferred.resolve(data.pdf || []);
        }).catch(function (response) {
          var error = response.data;
          return deferred.reject(error);
        });

        return deferred.promise;
      },
      syncToCode: function syncToCode(position, options) {
        var v = void 0;
        if (options == null) {
          options = {};
        }
        var deferred = $q.defer();
        if (position == null) {
          deferred.reject();
          return deferred.promise;
        }

        // FIXME: this actually works better if it's halfway across the
        // page (or the visible part of the page). Synctex doesn't
        // always find the right place in the file when the point is at
        // the edge of the page, it sometimes returns the start of the
        // next paragraph instead.
        var h = position.offset.left;

        // Compute the vertical position to pass to synctex, which
        // works with coordinates increasing from the top of the page
        // down.  This matches the browser's DOM coordinate of the
        // click point, but the pdf position is measured from the
        // bottom of the page so we need to invert it.
        if (options.fromPdfPosition && (position.pageSize != null ? position.pageSize.height : undefined) != null) {
          v = position.pageSize.height - position.offset.top || 0; // measure from pdf point (inverted)
        } else {
          v = position.offset.top || 0; // measure from html click position
        }

        // It's not clear exactly where we should sync to if it wasn't directly
        // clicked on, but a little bit down from the very top seems best.
        if (options.includeVisualOffset) {
          v += 72; // use the same value as in pdfViewer highlighting visual offset
        }

        $http({
          url: '/project/' + ide.project_id + '/sync/pdf',
          method: 'GET',
          params: {
            page: position.page + 1,
            h: h.toFixed(2),
            v: v.toFixed(2),
            clsiserverid: ide.clsiServerId
          }
        }).then(function (response) {
          var data = response.data;

          if (data.code != null && data.code.length > 0) {
            var doc = ide.fileTreeManager.findEntityByPath(data.code[0].file);
            if (doc == null) {
              return;
            }
            return deferred.resolve({ doc: doc, line: data.code[0].line });
          }
        }).catch(function (response) {
          var error = response.data;
          return deferred.reject(error);
        });

        return deferred.promise;
      }
    };

    return synctex;
  }]);

  App.controller('PdfSynctexController', ['$scope', 'synctex', 'ide', function ($scope, synctex, ide) {
    var _this = this;

    this.cursorPosition = null;
    ide.$scope.$on('cursor:editor:update', function (event, cursorPosition) {
      _this.cursorPosition = cursorPosition;
    });

    $scope.syncToPdf = function () {
      if (_this.cursorPosition == null) {
        return;
      }
      return synctex.syncToPdf(_this.cursorPosition).then(function (highlights) {
        return $scope.pdf.highlights = highlights;
      });
    };

    ide.$scope.$on('cursor:editor:syncToPdf', $scope.syncToPdf);

    return $scope.syncToCode = function () {
      return synctex.syncToCode($scope.pdf.position, {
        includeVisualOffset: true,
        fromPdfPosition: true
      }).then(function (data) {
        var doc = data.doc,
            line = data.line;

        return ide.editorManager.openDoc(doc, { gotoLine: line });
      });
    };
  }]);

  App.controller('PdfLogEntryController', ['$scope', 'ide', 'event_tracking', function ($scope, ide, event_tracking) {
    return $scope.openInEditor = function (entry) {
      var column = void 0,
          line = void 0;
      event_tracking.sendMBOnce('logs-jump-to-location-once');
      var entity = ide.fileTreeManager.findEntityByPath(entry.file);
      if (entity == null || entity.type !== 'doc') {
        return;
      }
      if (entry.line != null) {
        ;line = entry.line;
      }
      if (entry.column != null) {
        ;column = entry.column;
      }
      return ide.editorManager.openDoc(entity, {
        gotoLine: line,
        gotoColumn: column
      });
    };
  }]);

  return App.controller('ClearCacheModalController', ['$scope', '$modalInstance', function ($scope, $modalInstance) {
    $scope.state = { inflight: false };

    $scope.clear = function () {
      $scope.state.inflight = true;
      return $scope.clearCache().then(function () {
        $scope.state.inflight = false;
        return $modalInstance.close();
      });
    };

    return $scope.cancel = function () {
      return $modalInstance.dismiss('cancel');
    };
  }]);
});

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null ? transform(value) : undefined;
};

