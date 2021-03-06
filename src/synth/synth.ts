import { Synthesizer, MidiMessageHandler } from "sf2synth/bin/synth"
import { WindowMessenger } from "common/messenger/messenger"

import "./synth.css"

type Message = number[]

export const SynthEvent = {
  activate: "activate",
  midi: "midi",
  loadSoundFont: "load_soundfont",
  startRecording: "start_recording",
  stopRecording: "stop_recording",
  didCreateSynthWindow: "did-create-synth-window",
  didLoadSoundFont: "did_load_soundfont",
}

export interface LoadSoundFontEvent {
  presetNames: {
    [index: number]: {
      [index: number]: string
    }
  }
}

export default class SynthController {
  private eventsBuffer: any[] = []

  // 送信元とのタイムスタンプの差
  private timestampOffset = 0

  private handler = new MidiMessageHandler()
  private ctx: AudioContext
  private output: AudioNode
  private synth: Synthesizer
  private messenger: WindowMessenger

  constructor() {
    const ctx = new AudioContext()
    const output = ctx.createGain()
    output.connect(ctx.destination)
    this.ctx = ctx
    this.output = output

    this.synth = new Synthesizer(ctx)
    this.synth.connect(output)
    this.handler.listener = this.synth

    this.setupRecorder()
    this.startTimer()
    this.bindMessenger()
  }

  private bindMessenger() {
    const messenger = new WindowMessenger(window.parent)
    messenger.on(SynthEvent.activate, () => this.activate())
    messenger.on(SynthEvent.midi, (payload: any) => this.onMidi(payload))
    messenger.on(SynthEvent.loadSoundFont, (payload: any) =>
      this.loadSoundFont(payload.url)
    )
    messenger.on(SynthEvent.startRecording, () => this.startRecording())
    messenger.on(SynthEvent.stopRecording, () => this.stopRecording())

    messenger.send(SynthEvent.didCreateSynthWindow)
    this.messenger = messenger
  }

  private setupRecorder() {}

  private startRecording() {}

  private stopRecording() {}

  private onMidi({ events, timestamp }: { events: any[]; timestamp: number }) {
    this.eventsBuffer = [...this.eventsBuffer, ...events]
    this.timestampOffset = window.performance.now() - timestamp
  }

  private loadSoundFont(url: string) {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => this.synth.loadSoundFont(new Uint8Array(buf)))
      .then(() => {
        this.messenger.send(SynthEvent.didLoadSoundFont, {
          presetNames: this.synth.soundFont.getPresetNames(),
        } as LoadSoundFontEvent)
      })
      .catch((e) => console.warn(e.message))
  }

  private activate() {
    if (this.ctx.state !== "running") {
      this.ctx.resume().then(() => {
        console.log(`AudioContext.state = ${this.ctx.state}`)
      })
    }
  }

  private startTimer() {
    this.onTimer()
  }

  private onTimer() {
    // 再生時刻が現在より過去なら再生して削除
    const eventsToSend = this.eventsBuffer.filter(({ message, timestamp }) => {
      const delay = timestamp - window.performance.now() + this.timestampOffset
      return delay <= 0
    })

    const allSoundOffChannels = eventsToSend
      .filter(({ message }) => isMessageAllSoundOff(message))
      .map(({ message }) => getMessageChannel(message))

    // 再生するイベントと、all sound off を受信したチャンネルのイベントを削除する
    this.eventsBuffer = this.eventsBuffer.filter((e) => {
      return (
        !eventsToSend.includes(e) &&
        !allSoundOffChannels.includes(getMessageChannel(e.message))
      )
    })

    eventsToSend.forEach(({ message }) =>
      this.handler.processMidiMessage(message)
    )

    requestAnimationFrame(() => this.onTimer())
  }
}

/// メッセージがチャンネルイベントならチャンネルを、そうでなければ -1 を返す
const getMessageChannel = (message: Message) => {
  const isChannelEvent = (message[0] & 0xf0) !== 0xf0
  return isChannelEvent ? message[0] & 0x0f : -1
}

const isMessageAllSoundOff = (message: Message) => {
  const isControlChange = (message[0] & 0xf0) === 0xb0
  if (isControlChange) {
    const isAllSoundOff = message[1] === 0x78
    return isAllSoundOff
  }
  return false
}
