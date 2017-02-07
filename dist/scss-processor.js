'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _meteorIncludedFile = require('meteor-included-file');

var _meteorIncludedFile2 = _interopRequireDefault(_meteorIncludedFile);

var _meteorPathHelpers = require('meteor-path-helpers');

var _meteorPathHelpers2 = _interopRequireDefault(_meteorPathHelpers);

var _logger = require('logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ScssProcessor = function () {
  function ScssProcessor(pluginOptions) {
    _classCallCheck(this, ScssProcessor);

    this.fileCache = {};
    this.filesByName = null;
    this.pluginOptions = pluginOptions;
    this.sass = require('node-sass');
  }

  _createClass(ScssProcessor, [{
    key: 'isRoot',
    value: function isRoot(inputFile) {
      var fileOptions = inputFile.getFileOptions();
      if (fileOptions.hasOwnProperty('isImport')) {
        return !fileOptions.isImport;
      }

      return !hasUnderscore(inputFile.getPathInPackage());

      function hasUnderscore(file) {
        return _path2.default.basename(file)[0] === '_';
      }
    }
  }, {
    key: 'shouldProcess',
    value: function shouldProcess(file) {
      return isScssFile.call(this, file);

      function isScssFile(file) {
        if (!this.pluginOptions.enableSassCompilation || typeof this.pluginOptions.enableSassCompilation === 'boolean') {
          return this.pluginOptions.enableSassCompilation;
        }

        var extension = _path2.default.extname(file.getPathInPackage()).substring(1);
        return this.pluginOptions.enableSassCompilation.indexOf(extension) !== -1;
      }
    }
  }, {
    key: 'process',
    value: function process(file, filesByName) {
      this.filesByName = filesByName;
      try {
        this._process(file);
      } catch (err) {
        var numberOfAdditionalLines = this.pluginOptions.globalVariablesTextLineCount ? this.pluginOptions.globalVariablesTextLineCount + 1 : 0;
        var adjustedLineNumber = err.line - numberOfAdditionalLines;
        _logger2.default.error('\n/~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        _logger2.default.error('Processing Step: SCSS compilation');
        _logger2.default.error('Unable to compile ' + file.importPath + '\nLine: ' + adjustedLineNumber + ', Column: ' + err.column + '\n' + err);
        _logger2.default.error('\n/~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        throw err;
      }
    }
  }, {
    key: '_process',
    value: function _process(file) {
      if (file.isPreprocessed) return;

      var sourceFile = this._wrapFileForNodeSass(file);

      var _transpile2 = this._transpile(sourceFile),
          css = _transpile2.css,
          sourceMap = _transpile2.sourceMap;

      file.contents = css;
      file.sourceMap = sourceMap;
      file.isPreprocessed = true;
    }
  }, {
    key: '_wrapFileForNodeSass',
    value: function _wrapFileForNodeSass(file) {
      return { path: file.importPath, contents: file.rawContents, file: file };
    }
  }, {
    key: '_discoverImportPath',
    value: function _discoverImportPath(importPath) {
      var potentialPaths = [importPath];
      var potentialFileExtensions = this.pluginOptions.enableSassCompilation === true ? this.pluginOptions.extensions : this.pluginOptions.enableSassCompilation;

      if (!_path2.default.extname(importPath)) {
        potentialFileExtensions.forEach(function (extension) {
          return potentialPaths.push(importPath + '.' + extension);
        });
      }
      if (_path2.default.basename(importPath)[0] !== '_') {
        [].concat(potentialPaths).forEach(function (potentialPath) {
          return potentialPaths.push(_path2.default.dirname(potentialPath) + '/_' + _path2.default.basename(potentialPath));
        });
      }

      for (var i = 0, potentialPath = potentialPaths[i]; i < potentialPaths.length; i++, potentialPath = potentialPaths[i]) {
        if (this.filesByName.has(potentialPath) || _fs2.default.existsSync(potentialPaths[i]) && _fs2.default.lstatSync(potentialPaths[i]).isFile()) {
          return potentialPath;
        }
      }

      throw new Error('File \'' + importPath + '\' not found at any of the following paths: ' + JSON.stringify(potentialPaths));
    }
  }, {
    key: '_transpile',
    value: function _transpile(sourceFile) {
      var sassOptions = {
        sourceMap: true,
        sourceMapContents: true,
        sourceMapEmbed: false,
        sourceComments: false,
        sourceMapRoot: '.',
        indentedSyntax: sourceFile.file.getExtension() === 'sass',
        outFile: '.' + sourceFile.file.getBasename(),
        importer: this._importFile.bind(this, sourceFile),
        includePaths: [],
        file: sourceFile.path,
        data: sourceFile.contents
      };

      /* Empty options.data workaround from fourseven:scss */
      if (!sassOptions.data.trim()) {
        sassOptions.data = '$fakevariable : blue;';
      }

      var output = this.sass.renderSync(sassOptions);
      return { css: output.css.toString('utf-8'), sourceMap: JSON.parse(output.map.toString('utf-8')) };
    }
  }, {
    key: '_importFile',
    value: function _importFile(rootFile, sourceFilePath, relativeTo) {
      var importPath = _meteorPathHelpers2.default.getImportPathRelativeToFile(sourceFilePath, relativeTo);
      importPath = this._discoverImportPath(importPath);
      var inputFile = this.filesByName.get(importPath);
      if (inputFile) {
        rootFile.file.referencedImportPaths.push(importPath);
      } else {
        this._createIncludedFile(importPath, rootFile);
      }

      return this._wrapFileForNodeSassImport(inputFile);
    }
  }, {
    key: '_createIncludedFile',
    value: function _createIncludedFile(importPath, rootFile) {
      var file = new _meteorIncludedFile2.default(importPath, rootFile);
      file.prepInputFile().await();
      this.filesByName.set(importPath, file);
    }
  }, {
    key: '_wrapFileForNodeSassImport',
    value: function _wrapFileForNodeSassImport(file) {
      return { contents: file.rawContents, file: file.importPath };
    }
  }]);

  return ScssProcessor;
}();

exports.default = ScssProcessor;
;
//# sourceMappingURL=scss-processor.js.map
