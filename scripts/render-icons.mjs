// Renders the PNG icons in public/ from the two SVGs there. Run after editing them.
import {readFileSync} from 'node:fs'
import {chromium} from '@playwright/test'

const PUBLIC = new URL('../public/', import.meta.url)

// "any" icons are shown as is, so they keep the rounded shape on a transparent canvas.
// Maskable and Apple icons are full-bleed: the OS crops them to its own shape.
const ICONS = [
    {out: 'icon-192.png', size: 192, from: 'favicon.svg', transparent: true},
    {out: 'icon-512.png', size: 512, from: 'favicon.svg', transparent: true},
    {out: 'icon-maskable-512.png', size: 512, from: 'icon.svg', transparent: false},
    {out: 'apple-touch-icon.png', size: 180, from: 'icon.svg', transparent: false},
]

const browser = await chromium.launch()
for (const {out, size, from, transparent} of ICONS) {
    const page = await browser.newPage({viewport: {width: size, height: size}})
    const svg = readFileSync(new URL(from, PUBLIC), 'utf8')
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
    await page.screenshot({path: new URL(out, PUBLIC).pathname, omitBackground: transparent})
    await page.close()
}
await browser.close()
