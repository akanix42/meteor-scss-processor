const gulp = require('gulp');
const runStandardGulpBabelTask = require('gulp-build-babel-standard');

gulp.task('default', function () {
  return runStandardGulpBabelTask();
});
