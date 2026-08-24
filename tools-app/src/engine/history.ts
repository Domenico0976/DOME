export interface Command {
  readonly label: string
  execute(): void
  undo(): void
}

export class CompositeCommand implements Command {
  readonly label: string
  private readonly steps: Command[] = []

  constructor(label: string) {
    this.label = label
  }

  get size(): number {
    return this.steps.length
  }

  add(step: Command): void {
    this.steps.push(step)
  }

  execute(): void {
    for (const step of this.steps) step.execute()
  }

  undo(): void {
    for (const step of [...this.steps].reverse()) step.undo()
  }
}

const HISTORY_LIMIT = 100

export class HistoryStack {
  private past: Command[] = []
  private future: Command[] = []

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  push(command: Command): void {
    this.past.push(command)
    if (this.past.length > HISTORY_LIMIT) this.past.shift()
    this.future = []
  }

  undo(): Command | undefined {
    const command = this.past.pop()
    if (command) {
      command.undo()
      this.future.push(command)
    }
    return command
  }

  redo(): Command | undefined {
    const command = this.future.pop()
    if (command) {
      command.execute()
      this.past.push(command)
    }
    return command
  }

  clear(): void {
    this.past = []
    this.future = []
  }
}

export class Transaction {
  private composite: CompositeCommand | null = null

  constructor(private readonly stack: HistoryStack) {}

  open(label: string): void {
    if (this.composite) throw new Error('Transaction already open')
    this.composite = new CompositeCommand(label)
  }

  add(step: Command): void {
    if (!this.composite) throw new Error('No open transaction')
    step.execute()
    this.composite.add(step)
  }

  commit(): void {
    const composite = this.requireOpen()
    this.composite = null
    if (composite.size > 0) this.stack.push(composite)
  }

  abort(): void {
    const composite = this.requireOpen()
    this.composite = null
    composite.undo()
  }

  private requireOpen(): CompositeCommand {
    if (!this.composite) throw new Error('No open transaction')
    return this.composite
  }
}
