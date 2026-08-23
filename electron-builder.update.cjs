const packageJson = require('./package.json')

module.exports = {
  ...packageJson.build,
  publish: [
    {
      provider: 'generic',
      url: '${env.DSM_UPDATE_BASE_URL}'
    }
  ],
  win: {
    ...packageJson.build.win,
    target: ['nsis']
  }
}
