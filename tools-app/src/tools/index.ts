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
import { halftoneTool } from './filters/halftone'
import { pixelatorTool } from './filters/pixelator'
import { thermalTool } from './filters/thermal'
import { reLightTool } from './filters/reLight'
import { facetsTool } from './filters/facets'
import { typeShapeTool } from './filters/typeShape'

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
registerTool(halftoneTool)
registerTool(pixelatorTool)
registerTool(thermalTool)
registerTool(reLightTool)
registerTool(facetsTool)
registerTool(typeShapeTool)
