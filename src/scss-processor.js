import path from 'path';
import fs from 'fs';
import PathHelpers from 'meteor-build-plugin-helper-path-helpers';
import Processor from 'meteor-compiler-processor';
import R from 'ramda';
import cjson from 'cjson';
import checkNpmPackage from 'meteor-build-plugin-helper-check-npm-package';

export default class ScssProcessor extends Processor {
  constructor({ globalVariables, ...otherOptions } = {}, compiler) {
    super('SCSS compilation', otherOptions, compiler);
    this._processGlobalVariables(globalVariables);
    this._loadNodeSass();
  }

  _loadNodeSass(options) {
    const result = checkNpmPackage('node-sass@>=3.x', 'meteor-scss');
    if (result !== true) return;

    this.sass = require('node-sass');
  }

  _processGlobalVariables(globalVariables) {
    if (!globalVariables) return;

    const globalVariablesText = [];
    const globalVariablesJs = [];
    globalVariables.forEach(entry => {
      switch (R.type(entry)) {
        case 'Object':
          globalVariablesJs.push(entry);
          globalVariablesText.push(convertJsonVariablesToScssVariables(entry));
          break;
        case 'String':
          const fileContents = fs.readFileSync(entry, 'utf-8');
          if (path.extname(entry) === '.json') {
            const jsonVariables = cjson.parse(fileContents);
            globalVariablesJs.push(jsonVariables);
            globalVariablesText.push(convertJsonVariablesToScssVariables(jsonVariables));
          } else {
            globalVariablesJs.push(convertScssVariablesToJsonVariables(fileContents));
            globalVariablesText.push(fileContents);
          }
          break;
      }
    });

    this.globalVariablesJs = R.mergeAll(globalVariablesJs);
    this.globalVariablesText = R.join('\n', globalVariablesText);
    this.globalVariablesTextLineCount = this.globalVariablesText.split(/\r\n|\r|\n/).length;

    function convertJsonVariablesToScssVariables(variables) {
      const convertObjectToKeyValueArray = R.toPairs;
      const convertVariablesToScss = R.reduce((variables, pair) => variables + `$${pair[0]}: ${pair[1]};\n`, '');
      const processVariables = R.pipe(convertObjectToKeyValueArray, convertVariablesToScss);
      return processVariables(variables);
    }

    function convertScssVariablesToJsonVariables(text) {
      const extractVariables = R.match(/^\$.*/gm);
      const convertVariableToJson = R.pipe(R.replace(/"/g, '\\"'), R.replace(/\$(.*):\s*(.*);/g, '"$1":"$2"'));
      const surroundWithBraces = (str) => `{${str}}`;

      const processText = R.pipe(extractVariables, R.map(convertVariableToJson), R.join(',\n'), surroundWithBraces, cjson.parse);
      return processText(text);
    }
  }

  async _process(file, result) {
    const sourceFile = this._wrapFileForNodeSass(file, result);
    const { css, sourceMap } = await this._transpile(sourceFile);
    result.css = css;
    result.maps.css = sourceMap;

    return result;
  }

  _wrapFileForNodeSass(file, result) {
    let contents = result.scss || result.css || file.contents;
    if (this.globalVariablesText) {
      contents = `${this.globalVariablesText}\n\n${contents}`
    }
    result.scss = contents;
    return { path: file.importPath, contents, file };
  }

  _calculatePotentialImportPaths(importPath) {
    const potentialPaths = [importPath];
    const potentialFileExtensions = this.fileExtensions;

    if (!path.extname(importPath)) {
      potentialFileExtensions.forEach(extension => potentialPaths.push(`${importPath}.${extension}`));
    }
    if (path.basename(importPath)[0] !== '_') {
      [].concat(potentialPaths).forEach(potentialPath => potentialPaths.push(`${path.dirname(potentialPath)}/_${path.basename(potentialPath)}`));
    }

    return potentialPaths;
  }

  async _transpile(sourceFile) {
    const sassOptions = {
      sourceMap: true,
      sourceMapContents: true,
      sourceMapEmbed: false,
      sourceComments: false,
      sourceMapRoot: '.',
      indentedSyntax: sourceFile.file.getExtension() === 'sass',
      outFile: `.${sourceFile.file.getBasename()}`,
      importer: (...args) => {
        this._importFile(sourceFile, ...args)
      },
      includePaths: [],
      file: sourceFile.path,
      data: sourceFile.contents
    };

    /* Empty options.data workaround from fourseven:scss */
    if (!sassOptions.data.trim()) {
      sassOptions.data = '$fakevariable : blue;';
    }

    const output = await this._renderSass(sassOptions);
    return { css: output.css.toString('utf-8'), sourceMap: JSON.parse(output.map.toString('utf-8')) };
  }

  _renderSass(options) {
    return new Promise((resolve, reject) => {
      this.sass.render(options, function (err, result) {
        if (err)
          reject(err);
        else
          resolve(result);
      });
    });
  }

  async _importFile(rootFile, sourceFilePath, relativeTo, done) {
    try {
      let initialImportPath = PathHelpers.getPathRelativeToFile(sourceFilePath, relativeTo);
      let potentialImportPaths = this._calculatePotentialImportPaths(initialImportPath);
      let importResult = await this.compiler.importFile(potentialImportPaths, rootFile);
      done(this._wrapFileForNodeSassImport(importResult));
    } catch (err) {
      console.error(err)
      console.error(err.stack)
      done(err);
    }
  }

  _wrapFileForNodeSassImport(importResult) {
    return { contents: importResult.scss || importResult.css, file: importResult.inputFile.importPath };
  }

};
