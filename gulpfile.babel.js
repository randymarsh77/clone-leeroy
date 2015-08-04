import gulp from 'gulp';
import babel from 'gulp-babel';
import eslint from 'gulp-eslint';

gulp.task('babel', () => {
  return gulp.src(['src/*.js'])
    .pipe(babel())
    .pipe(gulp.dest('dist'));
});

gulp.task('lint', () => {
  return gulp.src(['src/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', ['lint', 'babel'], () => {
  console.log('Success!');
});