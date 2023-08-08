export interface PatchUserConfig {
  output?: {
    filename?: string

    loose?: boolean
    /**
     * @description remove * in output json
     */
    removeUniversalSelector?: boolean
  }
  tailwindcss?: {
    cwd?: string
    config?: string
  }
}

export interface UserConfig {
  patch?: PatchUserConfig
}
