/* eslint-env node, mocha */
// import './test-helpers/global-variables.stub';
import chai from 'chai';
import ScssProcessor from './scss-processor';
// import { reloadOptions } from './options';
import logger from 'hookable-logger';
import generateFileObject from 'meteor-test-helper-generate-file-object';
import PathHelpers from 'meteor-build-plugin-helper-path-helpers';

PathHelpers.basePath = process.cwd();
const expect = chai.expect;

describe('ScssProcessor', function () {
  describe('#isRoot', function () {
    it('should return false if the filename starts with an underscore', function z() {
      const file = generateFileObject('./_test.scss', '');

      const processor = new ScssProcessor();

      expect(processor.isRoot(file)).to.be.false;
    });

    it('should return false if the file options "isImport" property is true', function z() {
      const file = generateFileObject('./test.scss', '');
      file.fileOptions.isImport = true;

      const processor = new ScssProcessor();

      expect(processor.isRoot(file)).to.be.false;
    });

    it('should return true if the above conditions are not met', function z() {
      const file = generateFileObject('./test.scss', '');

      const processor = new ScssProcessor();

      expect(processor.isRoot(file)).to.be.true;
    });
  });

  describe('#handlesFileExtension', function () {
    it('should return true if the enableSassCompilation array contains the file\'s extension', function z() {
      const processor = new ScssProcessor({ fileExtensions: ['scss'] });

      expect(processor.handlesFileExtension('scss')).to.be.true;
    });

    it('should return false if the enableSassCompilation array does not contain the file\'s extension', function z() {
      const file = generateFileObject('./test.scss', '');

      const processor = new ScssProcessor({ fileExtensions: [] });

      expect(processor.handlesFileExtension('scss')).to.be.false;
    });
  });

  describe('#process', function () {
    describe('file.contents', function () {
      it('should transpile the passed in file', async function z() {
        const file = generateFileObject('./test.scss', '.test { .nested { color: red; } } .test2 { color: blue; } // a comment');

        const processor = new ScssProcessor();
        await processor.process(file);

        expect(file.contents).to.equal('.test .nested {\n  color: red; }\n\n.test2 {\n  color: blue; }\n\n/*# sourceMappingURL=.test.scss.map */');
      });
    });

    describe('file.referencedImportPaths', function () {
      it('should list all of the files that the current file imports', async function z() {
        const allFiles = new Map();
        addFile(generateFileObject('./direct-import1.scss', '.test { color: red; }'));
        addFile(generateFileObject('./direct-import2.scss', '@import "./indirect-import.scss"; .test { color: red; }'));
        addFile(generateFileObject('./indirect-import.scss', '.test { color: red; }'));
        const file = generateFileObject('./test.scss', '@import "./direct-import1.scss"; @import "./direct-import2"; .test { color: blue; }');

        const processor = new ScssProcessor();
        await processor.process(file, allFiles);

        expect(file.referencedImportPaths).to.eql([
          'D:/projects/meteor-vue/meteor-scss-processor/direct-import1.scss',
          'D:/projects/meteor-vue/meteor-scss-processor/direct-import2.scss',
          'D:/projects/meteor-vue/meteor-scss-processor/indirect-import.scss'
        ]);

        function addFile(file) {
          allFiles.set(file.importPath, file);
        }
      });
    });

    describe('file.sourcemap', function () {
      it('should generate a sourcemap', async function z() {
        const file = generateFileObject('./test.scss', '.test { color: red; } .test2 { color: blue; }');

        const processor = new ScssProcessor();
        await processor.process(file);

        expect(file.sourceMap).to.eql({
          'version': 3,
          'sourceRoot': '.',
          'file': '.test.scss',
          'sources': [
            'test.scss'
          ],
          'sourcesContent': [
            '.test { color: red; } .test2 { color: blue; }'
          ],
          'mappings': 'AAAA,AAAA,KAAK,CAAC;EAAE,KAAK,EAAE,GAAI,GAAI;;AAAA,AAAA,MAAM,CAAC;EAAE,KAAK,EAAE,IAAK,GAAI',
          'names': []
        });
      });
    });

    it('should log a friendly error when node-sass encounters an error', function z(done) {
      const file = generateFileObject('./test.scss', '.test { error! }');

      let fullErrorMessage = '';
      logger.test(async function () {
        logger.error.addHook(errorMessage => {
          fullErrorMessage += errorMessage + '\n';
        });

        const processor = new ScssProcessor();
        try {
          await processor.process(file);
        } catch (err) {
          const expectedErrorMessage =
            '\n/~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n' +
            'Processing Step: SCSS compilation\n' +
            'Unable to process D:/projects/meteor-vue/meteor-scss-processor/test.scss\nLine: 1, Column: 9\nError: property "error" must be followed by a \':\'\n\n' +
            '/~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n';
          try {expect(fullErrorMessage).to.equal(expectedErrorMessage);
            done();
          }
          catch(err){
            done(err);
          }
        }
      });
    });

    it('should throw an error when node-sass encounters an error', function z(done) {
      const file = generateFileObject('./test.scss', '.test { error! }');

      logger.test(async function () {
        const processor = new ScssProcessor();
        try {
          await processor.process(file);
        } catch (err) {
          done();
        }
      });
    });

  });
});

