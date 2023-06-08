import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonJS from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { rollup } from 'rollup';
import path from "path"
import fs from "fs"
// import {  } from ""



import nodeJsBuiltins from "builtins"
const nonPrefixedBuiltinModules = [...nodeJsBuiltins()]
const prefixedBuiltinModules = []
for (const mod of nonPrefixedBuiltinModules) {
  if (!mod.startsWith("node:")) prefixedBuiltinModules.push("node:"+mod)
}
const builtinModules = new Set([...nonPrefixedBuiltinModules, ...prefixedBuiltinModules])

const isCjsRegex = /((module)?((\[[`"'])|\.)exports([`"']\])?(\.|(\[[`"'])[^\s\n"`']+([`"']\])?)?\s*=\s*[^\s\n]+)|require\(["'`][^\s\n"'`]+["'`]\)/gm

// middleware that logs every resolved module if it is inside node_modules:

const resolved = new Set()

const config = {
  input: './app/src/colorfulCliLogger.ts',
  output: {
    file: 'app/dist/cjs/colorfulCliLogger.js',
    format: 'cjs',
    sourcemap: false
  },
  plugins: [
    typescript({tsconfig: "./tsconfig.forRollupCjs.json", noEmitOnError: false, sourceMap: false}), 
    // these resolve options do not matter if resolveOnly is used. ModulesOnly does currently not prefer cjs exports if they exists, instead it finds the first esm version and transpiles it, which we want to avoid if we can.
    resolve({modulesOnly: true, preferBuiltins: true, resolveOnly(mod, lel, lel2) {
      if (builtinModules.has(mod)) return false
      // this can happen when a module defines custom imports (e.g. chalk) in its package.json. We have no way tho to know here from where it was imported, so we just assume it was imported from a esm module and that it is esm as well. The only case that is known to not be covered here is when this module itself uses custom imports in package.json, to include this we would have to check if the given module is in local in this package. But I don't think that is worth the effort.
      if (!fs.existsSync(path.join("node_modules", mod))) {
        // resolved.add(mod)
        return true
      }
      const json = JSON.parse(fs.readFileSync(path.join("node_modules", mod, "package.json"), "utf8"))


      const vals = getSpecificJsonProps(json, [
        ["exports", "node", "require"],
        ["exports", ".", "node", "require"],
        ["exports", "require"],
        ["exports", "node"],
        ["exports", "default"],
        ["exports", ".", "default"],
        "main"
      ])

      for (const val of vals) {
        if (typeof val !== "string") continue
        if (val.endsWith(".mjs")) continue
        if (!val.endsWith(".js")) continue

        const fileContent = fs.readFileSync(path.join("node_modules", mod, val), "utf8")
        const isCjs = isCjsRegex.test(fileContent)
        
        if (isCjs) return false
      }

      resolved.add(mod)

      return true
    }}),
    json()
  ]
};

const bundle = await rollup(config);
bundle.write(config.output).then(() => {
  console.log("")
  for (const res of resolved) {
    console.warn("resolved module:", res)
  }
})

// console.log('resolved modules:', resolved)





function filterJsonProps(packageJsonParsed, whiteListOfPackageJsonProps/* (string | string[])[] */) {
  const ob = {}
  for (const keys of whiteListOfPackageJsonProps) {
    let keysAr = typeof keys === "string" ? keys.split(".") : keys
    let local = packageJsonParsed
    
    let failed = false
    for (const key of keysAr) {
      if (local[key] !== undefined) {
        local = local[key]
      }
      else {
        failed = true
        break
      }
    }
    if (failed) continue

    let localCopy = ob
    for (let i = 0; i < keysAr.length-1; i++) {
      const key = keysAr[i];
      if (localCopy[key] === undefined) localCopy[key] = {}
      localCopy = localCopy[key]
    }

    localCopy[keysAr[keysAr.length-1]] = local
  }
  return ob
}

function getSpecificJsonProps(packageJsonParsed, whiteListOfPackageJsonProps/* (string | string[])[] */) {
  const ar = []
  for (const keys of whiteListOfPackageJsonProps) {
    let keysAr = typeof keys === "string" ? keys.split(".") : keys
    let local = packageJsonParsed
    
    let failed = false
    for (const key of keysAr) {
      if (local[key] !== undefined) {
        local = local[key]
      }
      else {
        failed = true
        break
      }
    }
    if (failed) continue

    ar.push(local)
  }
  return ar
}