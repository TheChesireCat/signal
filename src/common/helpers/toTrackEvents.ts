import _ from "lodash"
import { assemble as assembleNotes } from "./noteAssembler"
import { assemble as assembleRPN } from "./RPNAssembler"
import { AnyEvent } from "midifile-ts"
import { DeltaTimeProvider, TickProvider } from "common/track"

function addTick<T extends DeltaTimeProvider>(
  events: T[]
): (T & TickProvider)[] {
  let tick = 0
  return events.map((e) => {
    tick += e.deltaTime
    const newEvent = {
      ...e,
      tick,
    }
    delete (newEvent as any).deltaTime
    return newEvent
  })
}

const removeUnnecessaryProps = <T>(e: T): T => {
  const { channel, ...ev } = e as any
  return ev
}

export function toTrackEvents(events: AnyEvent[]) {
  return assembleNotes(addTick(assembleRPN(events))).map(removeUnnecessaryProps)
}
