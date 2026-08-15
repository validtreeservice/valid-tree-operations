import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { parse } from '@babel/parser'

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return ['.js', '.jsx'].includes(extname(entry.name)) ? [path] : []
  })
}

const files = sourceFiles('src')
for (const file of files) {
  parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] })
}
console.log(`JavaScript/JSX parser validation passed (${files.length} source files).`)
