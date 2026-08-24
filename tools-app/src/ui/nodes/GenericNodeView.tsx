import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export function GenericNodeView(props: NodeProps) {
  const data = props.data as {
    label?: unknown
    inputPorts?: unknown
    outputPorts?: unknown
  }
  const label = typeof data.label === 'string' ? data.label : 'node'
  const inputPorts = Array.isArray(data.inputPorts) ? (data.inputPorts as string[]) : []
  const outputPorts = Array.isArray(data.outputPorts) ? (data.outputPorts as string[]) : []

  return (
    <div className={props.selected === true ? 'node-shell node-shell--selected' : 'node-shell'}>
      {inputPorts.map((portName, index) => (
        <Handle
          key={`in-${portName}`}
          type="target"
          position={Position.Left}
          id={portName}
          style={{ top: `${((index + 1) * 100) / (inputPorts.length + 1)}%` }}
        />
      ))}
      <div className="node-title">{label}</div>
      {outputPorts.map((portName, index) => (
        <Handle
          key={`out-${portName}`}
          type="source"
          position={Position.Right}
          id={portName}
          style={{ top: `${((index + 1) * 100) / (outputPorts.length + 1)}%` }}
        />
      ))}
    </div>
  )
}
