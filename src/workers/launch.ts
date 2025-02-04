import { Launcher } from '@xmcl/launch'

const noCheck: Launcher.PrecheckService = {
  async ensureLibraries () {},
  async ensureNatives () {}
}

let firstRun = true

addEventListener('message', function (e) {
  let option = e.data as Launcher.Option
  console.log(option)
  if (firstRun) {
    firstRun = false
  } else {
    option = { ...option, ...noCheck }
  }
  Launcher.launch(option).then(p => {
    p.stdout.on('data', (data) => {
      // console.log(data.toString())
    })
    p.on('exit', (code, signal) => {
      postMessage({ state: 'exit', code, signal })
    })
    postMessage({ state: 'launched' })
  }).catch(err => {
    postMessage({ state: 'error', error: err })
  })
})
