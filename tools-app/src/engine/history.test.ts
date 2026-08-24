import { describe, expect, it } from 'vitest'
import type { Command } from './history'
import { HistoryStack, Transaction } from './history'

class SpyCommand implements Command {
  readonly label: string
  executed = 0
  undone = 0

  constructor(label = 'spy') {
    this.label = label
  }

  execute(): void {
    this.executed += 1
  }

  undo(): void {
    this.undone += 1
  }
}

describe('HistoryStack', () => {
  it('undo_reverts_last_command_and_redo_reapplies_it', () => {
    const stack = new HistoryStack()
    const spy = new SpyCommand('uno')
    spy.execute()
    stack.push(spy)

    const undone = stack.undo()

    expect(undone).toBe(spy)
    expect(spy.undone).toBe(1)
    expect(stack.canUndo).toBe(false)
    expect(stack.canRedo).toBe(true)

    const redone = stack.redo()

    expect(redone).toBe(spy)
    expect(spy.executed).toBe(2)
  })

  it('push_after_undo_clears_the_redo_stack', () => {
    const stack = new HistoryStack()
    const primo = new SpyCommand('primo')
    const secondo = new SpyCommand('secondo')
    stack.push(primo)
    stack.undo()
    expect(stack.canRedo).toBe(true)

    stack.push(secondo)

    expect(stack.canRedo).toBe(false)
    expect(stack.undo()).toBe(secondo)
  })

  it('keeps_at_most_100_commands_in_the_stack', () => {
    const stack = new HistoryStack()
    for (let i = 0; i < 102; i += 1) stack.push(new SpyCommand(`n${i}`))

    let undos = 0
    while (stack.undo() !== undefined) undos += 1

    expect(undos).toBe(100)
  })
})

describe('Transaction', () => {
  it('commit_applies_steps_immediately_and_single_undo_reverts_all', () => {
    const stack = new HistoryStack()
    const tx = new Transaction(stack)
    tx.open('doppio step')
    const a = new SpyCommand('a')
    const b = new SpyCommand('b')

    tx.add(a)
    tx.add(b)
    expect(a.executed).toBe(1)
    expect(b.executed).toBe(1)

    tx.commit()
    expect(stack.canUndo).toBe(true)

    stack.undo()
    expect(a.undone).toBe(1)
    expect(b.undone).toBe(1)
  })

  it('abort_reverts_applied_steps_and_records_nothing', () => {
    const stack = new HistoryStack()
    const tx = new Transaction(stack)
    tx.open('da abortire')
    const a = new SpyCommand('a')

    tx.add(a)
    tx.abort()

    expect(a.executed).toBe(1)
    expect(a.undone).toBe(1)
    expect(stack.undo()).toBeUndefined()
  })

  it('empty_commit_records_nothing', () => {
    const stack = new HistoryStack()
    const tx = new Transaction(stack)
    tx.open('empty')

    tx.commit()

    expect(stack.canUndo).toBe(false)
  })

  it('add_outside_transaction_throws', () => {
    const tx = new Transaction(new HistoryStack())
    expect(() => tx.add(new SpyCommand())).toThrow(/No open transaction/)
  })
})
