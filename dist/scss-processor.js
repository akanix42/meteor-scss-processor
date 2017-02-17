'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _meteorBuildPluginHelperPathHelpers = require('meteor-build-plugin-helper-path-helpers');

var _meteorBuildPluginHelperPathHelpers2 = _interopRequireDefault(_meteorBuildPluginHelperPathHelpers);

var _meteorCompilerProcessor = require('meteor-compiler-processor');

var _meteorCompilerProcessor2 = _interopRequireDefault(_meteorCompilerProcessor);

var _ramda = require('ramda');

var _ramda2 = _interopRequireDefault(_ramda);

var _cjson = require('cjson');

var _cjson2 = _interopRequireDefault(_cjson);

var _meteorBuildPluginHelperCheckNpmPackage = require('meteor-build-plugin-helper-check-npm-package');

var _meteorBuildPluginHelperCheckNpmPackage2 = _interopRequireDefault(_meteorBuildPluginHelperCheckNpmPackage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ScssProcessor = function (_Processor) {
  (0, _inherits3.default)(ScssProcessor, _Processor);

  function ScssProcessor() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var compiler = arguments[1];
    var globalVariables = _ref.globalVariables,
        otherOptions = (0, _objectWithoutProperties3.default)(_ref, ['globalVariables']);
    (0, _classCallCheck3.default)(this, ScssProcessor);

    var _this = (0, _possibleConstructorReturn3.default)(this, (ScssProcessor.__proto__ || (0, _getPrototypeOf2.default)(ScssProcessor)).call(this, 'SCSS compilation', otherOptions, compiler));

    _this._processGlobalVariables(globalVariables);
    _this._loadNodeSass();
    return _this;
  }

  (0, _createClass3.default)(ScssProcessor, [{
    key: '_loadNodeSass',
    value: function _loadNodeSass(options) {
      var result = (0, _meteorBuildPluginHelperCheckNpmPackage2.default)('node-sass@>=3.x', 'meteor-scss');
      if (result !== true) return;

      this.sass = require('node-sass');
    }
  }, {
    key: '_processGlobalVariables',
    value: function _processGlobalVariables(globalVariables) {
      if (!globalVariables) return;

      var globalVariablesText = [];
      var globalVariablesJs = [];
      globalVariables.forEach(function (entry) {
        switch (_ramda2.default.type(entry)) {
          case 'Object':
            globalVariablesJs.push(entry);
            globalVariablesText.push(convertJsonVariablesToScssVariables(entry));
            break;
          case 'String':
            var fileContents = _fs2.default.readFileSync(entry, 'utf-8');
            if (_path2.default.extname(entry) === '.json') {
              var jsonVariables = _cjson2.default.parse(fileContents);
              globalVariablesJs.push(jsonVariables);
              globalVariablesText.push(convertJsonVariablesToScssVariables(jsonVariables));
            } else {
              globalVariablesJs.push(convertScssVariablesToJsonVariables(fileContents));
              globalVariablesText.push(fileContents);
            }
            break;
        }
      });

      this.globalVariablesJs = _ramda2.default.mergeAll(globalVariablesJs);
      this.globalVariablesText = _ramda2.default.join('\n', globalVariablesText);
      this.globalVariablesTextLineCount = this.globalVariablesText.split(/\r\n|\r|\n/).length;

      function convertJsonVariablesToScssVariables(variables) {
        var convertObjectToKeyValueArray = _ramda2.default.toPairs;
        var convertVariablesToScss = _ramda2.default.reduce(function (variables, pair) {
          return variables + ('$' + pair[0] + ': ' + pair[1] + ';\n');
        }, '');
        var processVariables = _ramda2.default.pipe(convertObjectToKeyValueArray, convertVariablesToScss);
        return processVariables(variables);
      }

      function convertScssVariablesToJsonVariables(text) {
        var extractVariables = _ramda2.default.match(/^\$.*/gm);
        var convertVariableToJson = _ramda2.default.pipe(_ramda2.default.replace(/"/g, '\\"'), _ramda2.default.replace(/\$(.*):\s*(.*);/g, '"$1":"$2"'));
        var surroundWithBraces = function surroundWithBraces(str) {
          return '{' + str + '}';
        };

        var processText = _ramda2.default.pipe(extractVariables, _ramda2.default.map(convertVariableToJson), _ramda2.default.join(',\n'), surroundWithBraces, _cjson2.default.parse);
        return processText(text);
      }
    }
  }, {
    key: '_process',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(file, result) {
        var sourceFile, _transpile2, css, sourceMap;

        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                console.log('initial result', (0, _stringify2.default)(result));
                sourceFile = this._wrapFileForNodeSass(file, result);
                _transpile2 = this._transpile(sourceFile), css = _transpile2.css, sourceMap = _transpile2.sourceMap;

                result.css = css;
                result.maps.css = sourceMap;
                console.log('scss processing result', (0, _stringify2.default)(result));

                return _context.abrupt('return', result);

              case 7:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function _process(_x2, _x3) {
        return _ref2.apply(this, arguments);
      }

      return _process;
    }()
  }, {
    key: '_wrapFileForNodeSass',
    value: function _wrapFileForNodeSass(file, result) {
      var contents = result.scss || result.css || file.contents;
      if (this.globalVariablesText) {
        contents = this.globalVariablesText + '\n\n' + contents;
      }
      result.scss = contents;
      return { path: file.importPath, contents: contents, file: file };
    }
  }, {
    key: '_calculatePotentialImportPaths',
    value: function _calculatePotentialImportPaths(importPath) {
      var potentialPaths = [importPath];
      var potentialFileExtensions = this.fileExtensions;

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

      return potentialPaths;
      //
      // for (let i = 0,
      //        potentialPath = potentialPaths[i]; i < potentialPaths.length; i++, potentialPath = potentialPaths[i]) {
      //   if (this.filesByName.has(potentialPath) || (fs.existsSync(potentialPaths[i]) && fs.lstatSync(potentialPaths[i]).isFile())) {
      //     return potentialPath;
      //   }
      // }
      //
      // throw new Error(`File '${importPath}' not found at any of the following paths: ${JSON.stringify(potentialPaths)}`);
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
      try {
        var initialImportPath = _meteorBuildPluginHelperPathHelpers2.default.getPathRelativeToFile(sourceFilePath, relativeTo);
        var potentialImportPaths = this._calculatePotentialImportPaths(initialImportPath);
        // importPath = this._discoverImportPath(importPath);
        var inputFile = this.compiler.importFile(potentialImportPaths, rootFile);
        // if (inputFile) {
        //   rootFile.file.referencedImportPaths.push(importPath);
        // } else {
        //   this._createIncludedFile(importPath, rootFile);
        // }

        return this._wrapFileForNodeSassImport(inputFile);
      } catch (err) {
        return err;
      }
    }
  }, {
    key: '_wrapFileForNodeSassImport',
    value: function _wrapFileForNodeSassImport(importResult) {
      return { contents: importResult.scss || importResult.css, file: importResult.inputFile.importPath };
    }
  }]);
  return ScssProcessor;
}(_meteorCompilerProcessor2.default);

exports.default = ScssProcessor;
;
//# sourceMappingURL=scss-processor.js.map
