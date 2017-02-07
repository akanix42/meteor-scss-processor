import path from 'path';
import fs from 'fs';
import PathHelpers from 'meteor-build-plugin-helper-path-helpers';
import Processor from 'meteor-compiler-processor';
import R from 'ramda';
import cjson from 'cjson';
import checkNpmPackage from 'meteor-build-plugin-helper-check-npm-package';

export default class ScssProcessor extends Processor {
  constructor({ globalVariables, ...otherOptions } = {}) {
    super('SCSS compilation', otherOptions);
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

  async _process(file) {
      const sourceFile = this._wrapFileForNodeSass(file);
      const { css, sourceMap } = this._transpile(sourceFile);
      file.contents = css;
      file.sourceMap = sourceMap;
      file.isPreprocessed = true;
    return {};
  }

  _wrapFileForNodeSass(file) {
    let contents = file.rawContents;
    if (this.globalVariablesText) {
      contents = `${this.globalVariablesText}\n\n${contents}`
    }

    return { path: file.importPath, contents, file };
  }

  _discoverImportPath(importPath) {
    const potentialPaths = [importPath];
    const potentialFileExtensions = this.fileExtensions;

    if (!path.extname(importPath)) {
      potentialFileExtensions.forEach(extension => potentialPaths.push(`${importPath}.${extension}`));
    }
    if (path.basename(importPath)[0] !== '_') {
      [].concat(potentialPaths).forEach(potentialPath => potentialPaths.push(`${path.dirname(potentialPath)}/_${path.basename(potentialPath)}`));
    }

    for (let i = 0, potentialPath = potentialPaths[i]; i < potentialPaths.length; i++, potentialPath = potentialPaths[i]) {
      if (this.filesByName.has(potentialPath) || (fs.existsSync(potentialPaths[i]) && fs.lstatSync(potentialPaths[i]).isFile())) {
        return potentialPath;
      }
    }

    throw new Error(`File '${importPath}' not found at any of the following paths: ${JSON.stringify(potentialPaths)}`);
  }

  _transpile(sourceFile) {
    const sassOptions = {
      sourceMap: true,
      sourceMapContents: true,
      sourceMapEmbed: false,
      sourceComments: false,
      sourceMapRoot: '.',
      indentedSyntax: sourceFile.file.getExtension() === 'sass',
      outFile: `.${sourceFile.file.getBasename()}`,
      importer: this._importFile.bind(this, sourceFile),
      includePaths: [],
      file: sourceFile.path,
      data: sourceFile.contents
    };

    /* Empty options.data workaround from fourseven:scss */
    if (!sassOptions.data.trim()) {
      sassOptions.data = '$fakevariable : blue;';
    }

    const output = this.sass.renderSync(sassOptions);
    return { css: output.css.toString('utf-8'), sourceMap: JSON.parse(output.map.toString('utf-8')) };
  }

  _importFile(rootFile, sourceFilePath, relativeTo) {
    try {
      let importPath = PathHelpers.getPathRelativeToFile(sourceFilePath, relativeTo);
      importPath = this._discoverImportPath(importPath);
      let inputFile = this.filesByName.get(importPath);
      if (inputFile) {
        rootFile.file.referencedImportPaths.push(importPath);
      } else {
        this._createIncludedFile(importPath, rootFile);
      }

      return this._wrapFileForNodeSassImport(inputFile);
    } catch (err) {
      return err;
    }
  }

  _wrapFileForNodeSassImport(file) {
    return { contents: file.rawContents, file: file.importPath };
  }

};
