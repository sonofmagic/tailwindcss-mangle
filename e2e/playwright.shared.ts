import type { LaunchOptions } from '@playwright/test'
import process from 'node:process'

export function resolveChromiumLaunchOptions(options: LaunchOptions = {}): LaunchOptions {
  const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']
  return {
    ...options,
    ...(executablePath ? { executablePath } : {}),
  }
}
