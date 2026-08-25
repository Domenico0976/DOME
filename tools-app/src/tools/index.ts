import { registerTool } from '../core/registry'
import { imageVideoTool } from './inputs/imageVideo'
import { textTool } from './inputs/text'
import { audioFileTool } from './inputs/audioFile'
import { solidColorTool } from './inputs/solidColor'
import { gradientTool } from './inputs/gradient'
import { cameraTool } from './inputs/camera'
import { particlesTool } from './generative/particles'
import { ferrofluidTool } from './generative/ferrofluid'
import { tunnelTool } from './generative/tunnel'
import { flowfieldTool } from './generative/flowfield'
import { ringsTool } from './generative/rings'
import { starfieldTool } from './generative/starfield'
import { kaleidoscopeTool } from './generative/kaleidoscope'
import { plasmaTool } from './generative/plasma'

registerTool(imageVideoTool)
registerTool(textTool)
registerTool(audioFileTool)
registerTool(solidColorTool)
registerTool(gradientTool)
registerTool(cameraTool)
registerTool(particlesTool)
registerTool(ferrofluidTool)
registerTool(tunnelTool)
registerTool(flowfieldTool)
registerTool(ringsTool)
registerTool(starfieldTool)
registerTool(kaleidoscopeTool)
registerTool(plasmaTool)
