'use strict';

var gulp  = require('gulp'),
    gutil = require('gulp-util');
var exec  = require('child_process').exec;
var tslint = require('gulp-tslint');
var typescript = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var path = require('path');
var merge = require('merge2');

function errorHandler(err) {
    console.error(err.message);
    process.exit(1);
}

gulp.task('clean', function (done) {
    return del(['out/**', '!out'], done);
});

gulp.task('build', ['clean'], function () {
    let tsProject = typescript.createProject('./tsconfig.json');
    let tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .on('error', errorHandler);

    return merge([ // Merge the two output streams, so this task is finished when the IO of both operations is done.
        tsResult.dts.pipe(gulp.dest('./out')),
        tsResult.js.pipe(sourcemaps.write('.', {
            sourceRoot: function (file) {
                // This override is needed because of a bug in sourcemaps base logic.
                // "file.base"" is the out dir where all the js and map files are located.
                return file.base;
            }
        })).pipe(gulp.dest('./out'))]);
});

gulp.task('tslint', ['build'], function () {
    return gulp.src(['./src/**/*.ts', './test/**/*.ts', './test-integration/**/*.ts'])
        .pipe(tslint({ configuration: "tslint.json", formatter: "verbose" }))
        .pipe(tslint.report({ emitError: true, summarizeFailureOutput: true }))
        .on('error', errorHandler);
});

gulp.task('default', ['tslint']);
