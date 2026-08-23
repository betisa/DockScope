const packageJson = require('./package.json')

const requestedChannel = String(process.env.DOCKSCOPE_RELEASE_CHANNEL || '').toLowerCase()
const isPreviewVersion = /-(?:beta|preview)(?:[.-]|$)/i.test(packageJson.version)
const channel = requestedChannel === 'beta' || requestedChannel === 'preview' || isPreviewVersion
  ? 'beta'
  : 'latest'

module.exports = {
  ...packageJson.build,
  publish: [
    {
      provider: 'github',
      owner: 'mohikan1986',
      repo: 'DockScope',
      channel,
      releaseType: channel === 'beta' ? 'prerelease' : 'release',
      publishAutoUpdate: true
    }
  ],
  win: {
    ...packageJson.build.win,
    target: ['nsis']
  }
}
