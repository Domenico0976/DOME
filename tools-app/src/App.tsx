import { useProjectStore } from './state/projectStore'
import { TopBar } from './ui/TopBar'
import { Sidebar } from './ui/Sidebar'
import { Stack } from './ui/Stack'
import { NodeOptions } from './ui/NodeOptions'
import { Canvas } from './ui/Canvas'
import { AudioBar } from './ui/AudioBar'
import { ExportMenu } from './ui/ExportMenu'

export default function App() {
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const stack = useProjectStore((s) => s.stack)
  const selected = stack.find((i) => i.uid === selectedUid) ?? null
  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <div className="app-body">
          <div className="app-nodes">
            <Stack />
            {selected ? <NodeOptions item={selected} /> : null}
          </div>
          <Canvas />
        </div>
        <AudioBar />
        <ExportMenu />
      </div>
    </div>
  )
}
