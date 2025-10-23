module.exports = {
  plugins: [
    require('@fullhuman/postcss-purgecss').default({
      content: [
        'templates/**/*.njk',
        'pages/**/*.json',
        'scripts/**/*.js',
        'index.html',
        'en/**/*.html',
        'fr/**/*.html'
      ],
      defaultExtractor: (content) => content.match(/[A-Za-z0-9-_:/]+/g) || [],
      safelist: [
        /^fa-/, /^card-/, /^liturgy-/, /^schedule-/,
        /^grid/, /^container/, /^lang-/, /^menu/,
        /^header-/, /^footer-/, /^nav-/, /^btn/, /^icon/, /^page-/
      ]
    })
  ]
}
