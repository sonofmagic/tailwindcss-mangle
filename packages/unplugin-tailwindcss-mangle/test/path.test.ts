import path from 'path'

describe('path', () => {
  it('should be', () => {
    const context = 'C:\\github-workspace\\tailwindcss-mangle\\apps\\next-app\\.next\\'
    const target = path.resolve('C:\\github-workspace\\tailwindcss-mangle\\apps\\next-app\\.next\\server\\chunks', '../pages/_app.js')
    expect(path.relative(context, target)).toBe('server\\pages\\_app.js')
  })
})
