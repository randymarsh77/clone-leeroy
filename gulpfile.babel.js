import gulp from 'gulp';
import babel from 'gulp-babel';
import eslint from 'gulp-eslint';
import watch from 'gulp-watch';
import batch from 'gulp-batch';

gulp.task('babel', () => {
  return gulp.src(['src/*.js', 'src/utility/*.js'])
    .pipe(babel())
    .pipe(gulp.dest('dist'));
});

gulp.task('lint', () => {
  return gulp.src(['src/*.js', 'src/utility/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('watch', () => {
	watch('src/*.js', batch((events, done) => {
		gulp.start('default', done);
	}));
});

gulp.task('default', ['lint', 'babel'], () => {
  console.log('Success!');
});
