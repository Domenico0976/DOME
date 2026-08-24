import type { GraphModel } from './graph'
import { isPatchSpec } from './patch'
import type { NodeDef, Signal } from './types'
import { splitAddress } from './types'

export interface FrameInfo {
  frame: number
  timeSec: number
  dt: number
}

export interface NodeRuntimeLike {
  compute(
    inputs: Record<string, Signal>,
    params: Record<string, number>,
    frame: FrameInfo,
  ): Record<string, Signal>
  ready?(): boolean
  dispose?(): void
  draw?(ctx: CanvasRenderingContext2D, frame: FrameInfo): void
}

export interface RegistryEntry {
  def: NodeDef
  create(): NodeRuntimeLike
}

interface Instance {
  runtime: NodeRuntimeLike
  nodeType: string
  outputs: Record<string, Signal>
  computedFrame: number
}

export class EvalBudgetError extends Error {
  constructor() {
    super('Budget di valutazione superato: possibile ciclo nel grafo')
    this.name = 'EvalBudgetError'
  }
}

const EVAL_BUDGET_FACTOR = 2

export class GraphEngine {
  private frameNumber = 0
  private lastTimeSec: number | null = null
  private readonly instances = new Map<string, Instance>()

  constructor(
    private readonly model: GraphModel,
    private readonly registry: ReadonlyMap<string, RegistryEntry>,
    private readonly options?: { sinks?: readonly string[] },
  ) {}

  outputOf(nodeId: string, portName: string): Signal | undefined {
    return this.instances.get(nodeId)?.outputs[portName]
  }

  getRuntime(nodeId: string): NodeRuntimeLike | undefined {
    return this.instances.get(nodeId)?.runtime
  }

  reset(): void {
    for (const instance of this.instances.values()) instance.runtime.dispose?.()
    this.instances.clear()
    this.frameNumber = 0
    this.lastTimeSec = null
  }

  tick(timeSec: number): void {
    this.frameNumber += 1
    const dt = this.lastTimeSec === null ? 0 : Math.max(0, timeSec - this.lastTimeSec)
    this.lastTimeSec = timeSec
    const frame: FrameInfo = { frame: this.frameNumber, timeSec, dt }

    let budget = this.model.nodes().length * EVAL_BUDGET_FACTOR + 8
    const guard = (): void => {
      budget -= 1
      if (budget < 0) throw new EvalBudgetError()
    }

    for (const sinkId of this.resolveSinks()) this.pullNode(sinkId, frame, guard)
  }

  private resolveSinks(): readonly string[] {
    const explicit = this.options?.sinks ?? []
    const terminal = this.model
      .nodes()
      .filter((node) => (this.registry.get(node.type)?.def.outputs.length ?? 0) === 0)
      .map((node) => node.id)
    return [...new Set([...explicit, ...terminal])]
  }

  private pullNode(nodeId: string, frame: FrameInfo, guard: () => void): void {
    guard()
    const instance = this.instanceFor(nodeId)
    if (instance.computedFrame === this.frameNumber) return
    instance.computedFrame = this.frameNumber

    const entry = this.requireEntry(instance.nodeType)
    const inputs: Record<string, Signal> = {}
    for (const port of entry.def.inputs) {
      const connection = this.model.incomingTo(`${nodeId}.${port.name}`)
      inputs[port.name] = connection ? this.pull(connection.from, frame, guard) : port.defaultValue
    }

    if (instance.runtime.ready?.() === false) {
      instance.outputs = Object.fromEntries(
        entry.def.outputs.map((port) => [port.name, port.defaultValue]),
      )
      return
    }

    const params = this.resolveParams(this.model.getNode(nodeId)?.params ?? {}, frame, guard)
    instance.outputs = instance.runtime.compute(inputs, params, frame)
  }

  private pull(address: string, frame: FrameInfo, guard: () => void): Signal {
    guard()
    const [nodeId, portName] = splitAddress(address)
    this.pullNode(nodeId, frame, guard)
    const output = this.instances.get(nodeId)?.outputs[portName]
    if (output !== undefined) return output
    const nodeType = this.model.getNode(nodeId)?.type ?? this.instances.get(nodeId)?.nodeType
    const fallback = nodeType
      ? this.requireEntry(nodeType).def.outputs.find((port) => port.name === portName)
      : undefined
    return fallback ? fallback.defaultValue : 0
  }

  private resolveParams(
    specs: Record<string, unknown>,
    frame: FrameInfo,
    guard: () => void,
  ): Record<string, number> {
    const resolved: Record<string, number> = {}
    for (const [key, spec] of Object.entries(specs)) {
      if (typeof spec === 'number') {
        resolved[key] = spec
        continue
      }
      if (isPatchSpec(spec)) {
        const signal = this.pull(spec.$patch.from, frame, guard)
        resolved[key] = typeof signal === 'number' ? signal : 0
      }
    }
    return resolved
  }

  private instanceFor(nodeId: string): Instance {
    let instance = this.instances.get(nodeId)
    if (!instance) {
      const node = this.model.getNode(nodeId)
      if (!node) throw new Error(`Unknown node: ${nodeId}`)
      instance = {
        runtime: this.requireEntry(node.type).create(),
        nodeType: node.type,
        outputs: {},
        computedFrame: -1,
      }
      this.instances.set(nodeId, instance)
    }
    return instance
  }

  private requireEntry(type: string): RegistryEntry {
    const entry = this.registry.get(type)
    if (!entry) throw new Error(`Unregistered node type: ${type}`)
    return entry
  }
}
