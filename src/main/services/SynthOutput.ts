import { Messenger, WindowMessenger } from "common/messenger/messenger"
import { SynthEvent, LoadSoundFontEvent } from "synth/synth"

export interface Message {
  message: number[]
  timestamp: number
}

function createElement(html: string) {
  const elem = document.createElement("div")
  elem.innerHTML = html
  const child = elem.firstElementChild
  if (child !== null) {
    document.body.appendChild(child)
  }
  return child
}

export default class SynthOutput {
  private messenger: Messenger
  onLoadSoundFont: (e: LoadSoundFontEvent) => void = () => {}

  constructor(soundFontPath: string) {
    const iframe =
      (document.getElementById("synth") as HTMLIFrameElement) ??
      (createElement(
        `<iframe src="./synth.html" id="synth"></iframe>`
      ) as HTMLIFrameElement)

    if (iframe.contentWindow == null) {
      console.error("Failed create iframe for synth.html")
      return
    }

    this.messenger = new WindowMessenger(iframe.contentWindow)

    iframe.onload = () => {
      if (soundFontPath) {
        this.loadSoundFont(soundFontPath)
      }
    }

    this.messenger.on(SynthEvent.didLoadSoundFont, (e) =>
      this.onLoadSoundFont(e)
    )
  }

  activate() {
    this.messenger.send(SynthEvent.activate)
  }

  loadSoundFont(url: string) {
    this.messenger.send(SynthEvent.loadSoundFont, { url })
  }

  startRecording() {
    this.messenger.send(SynthEvent.startRecording)
  }

  stopRecording() {
    this.messenger.send(SynthEvent.stopRecording)
  }

  send(message: number[], timestamp: DOMHighResTimeStamp) {
    this.sendEvents([{ message, timestamp }])
  }

  sendEvents(events: Message[]) {
    this.messenger.send(SynthEvent.midi, {
      events,
      timestamp: window.performance.now(),
    })
  }
}
