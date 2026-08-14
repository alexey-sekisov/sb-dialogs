import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import { VERSION } from '../src/version'

describe('version', () => {
  it('берётся из package.json', () => {
    expect(VERSION).toBe(packageJson.version)
  })
})
