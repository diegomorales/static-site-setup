let gulp = require('gulp'),
  path = require('path'),
  browser = require('browser-sync'),
  del = require('del'),
  rename = require('gulp-rename'),
  postcss = require('gulp-postcss'),
  cssnext = require('postcss-cssnext'),
  atImport = require('postcss-import'),
  precss = require('precss'),
  cssnano = require('cssnano'),
  stylelint = require('gulp-stylelint'),
  sourcemaps = require('gulp-sourcemaps'),
  modernizr = require('gulp-modernizr'),
  uglify = require('gulp-uglify'),
  webpack = require('webpack'),
  UglifyjsPlugin = require('uglifyjs-webpack-plugin'),
  eslint = require('gulp-eslint'),
  nunjucks = require('nunjucks'),
  compile = require('gulp-nunjucks').compile

// Set default environment
process.env.NODE_ENV = 'development'

const isProd = () => process.env.NODE_ENV === 'production'

const paths = {
  dev: './src/',
  get devPages() {
    return this.dev + 'pages/'
  },
  get devPcss() {
    return this.dev + 'pcss/'
  },
  get devJs() {
    return this.dev + 'js/'
  },
  get devAssets() {
    return this.dev + 'assets/'
  },
  build: './build/',
  get buildCss() {
    return this.build + 'css/'
  },
  get buildJs() {
    return this.build + 'js/'
  },
  get buildAssets() {
    return this.build + 'assets/'
  }
}

const startServer = () => browser.init({
  server: {
    baseDir: './build',
    port: 3000
  },
  open: false
})

const reload = (done) => {
  browser.reload()
  done()
}

const cleanBuild = () => del(paths.build)

const copyPages = () => {
  return gulp.src(paths.devPages + '*.html')
    .pipe(gulp.dest(paths.build))
}

const buildPcss = () => {
  let postCssTasks = [
    atImport(),
    precss(),
    cssnext({browsers: ['last 2 versions']})
  ]

  if (isProd()) {
    postCssTasks.push(cssnano({
      discardComments: {
        removeAll: true
      }
    }))
  }

  return gulp.src(paths.devPcss + '*.pcss')
    .pipe(sourcemaps.init())
    .pipe(postcss(postCssTasks))
    .pipe(rename({extname: '.css'}))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.buildCss))

    // reload browser
    .pipe(browser.stream({match: '**/*.css'}))
}

const lintPcss = () => {
  return gulp.src([
    paths.devPcss + '**/*.pcss'
  ])
    .pipe(stylelint({
      failAfterError: false,
      reporters: [
        {formatter: 'string', console: true}
      ]
    }))
}

const buildJs = (done) => {
  let plugins = []

  // Additional plugins and loaders for production build.
  if (isProd()) {
    plugins.push(new UglifyjsPlugin({
      sourceMap: true
    }))
  }

  webpack({
    watch: !isProd(),
    devtool: isProd() ? 'source-map' : 'eval-source-map',
    entry: {
      main: path.resolve(paths.devJs, 'main.js')
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, paths.buildJs)
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: ['env']
              }
            }
          ]
        }
      ]
    },
    plugins: plugins

  }, (err, stats) => {
    if (err) {
      console.error(err.stack || err)
      if (err.details) {
        console.error(err.details)
      }
      return
    }

    const info = stats.toJson()

    if (stats.hasErrors()) {
      console.error(info.errors)
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings)
    }

    // Log result...
    console.log(stats.toString({
      chunks: false,  // Makes the build much quieter
      modules: false,
      colors: true,    // Shows colors in the console
      moduleTrace: false
    }))

    browser.reload()
    done()
  })
}

const lintJs = () => {
  return gulp.src([
    paths.devJs + '**/*.js'
  ])
    .pipe(eslint())
    .pipe(eslint.format())
}

const copyAssets = () => {
  return gulp.src(paths.devAssets + '**/*.*')
    .pipe(gulp.dest(paths.buildAssets))
}

const buildPages = () => {
  return gulp.src(paths.devPages + '*.njk')
    .pipe(compile({}, {
      env: new nunjucks.Environment(new nunjucks.FileSystemLoader([paths.devPages]))
    }))
    .pipe(rename({
      extname: '.html'
    }))
    .pipe(gulp.dest(paths.build))
}

const buildModernizr = () => {
  return gulp.src([paths.devJs + '**/*.js', paths.devPcss + '**/*.pcss'])
    .pipe(modernizr('modernizr-custom.js', {
      options: [
        'setClasses',
        'addTest',
        'html5printshiv',
        'testProp',
        'fnBind'
      ],
      excludeTests: ['hidden']
    }))
    .pipe(uglify())
    .pipe(gulp.dest(paths.buildJs))
}

const build = gulp.series(cleanBuild, gulp.parallel(
  copyAssets,
  copyPages,
  buildModernizr,
  buildPages,
  buildPcss,
  buildJs,
  lintPcss,
  lintJs
))

const watch = gulp.series(build, () => {
  startServer()

  gulp.watch([paths.devJs + '**/*.js'], lintJs)
  gulp.watch([paths.devPages + '**/*.njk'], gulp.series(buildPages, reload))
  gulp.watch([paths.devPcss + '**/*.pcss'], gulp.parallel(buildPcss, lintPcss))
  gulp.watch([paths.devAssets + '**/*.*'], gulp.series(copyAssets, reload))
})

gulp.task('default', watch)

gulp.task('build', gulp.series((done) => {

  // Set environment
  process.env.NODE_ENV = 'production'

  done()
}, build))
