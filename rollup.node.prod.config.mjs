import { merge } from "webpack-merge"
import commonMod from "./rollup.node.common.config.mjs"


export default merge(commonMod, {
  input: 'app/src/colorfulCliLogger.ts',
  output: {
    file: 'dist/cjs/colorfulCliLogger.js',
    format: 'cjs'
  },
})