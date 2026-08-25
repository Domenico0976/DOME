import { registerTool } from '../core/registry'
import { imageVideoTool } from './inputs/imageVideo'
import { textTool } from './inputs/text'
import { audioFileTool } from './inputs/audioFile'
import { solidColorTool } from './inputs/solidColor'
import { gradientTool } from './inputs/gradient'
import { cameraTool } from './inputs/camera'

registerTool(imageVideoTool)
registerTool(textTool)
registerTool(audioFileTool)
registerTool(solidColorTool)
registerTool(gradientTool)
registerTool(cameraTool)
