import bs58 from 'bs58'
import { task, types } from 'hardhat/config'

interface Base64ToBase58Args {
    b64: string
}

task('utils:base64-to-base58', 'Convert base64 string(s) to base58 encoding')
    .addOptionalParam('b64', 'Base64 string to convert', undefined, types.string)
    .setAction(async ({ b64 }: Base64ToBase58Args) => {
        if (!b64) {
            throw new Error('Must provide either --b64 parameter')
        }

        if (b64) {
            const bytes = Buffer.from(b64, 'base64')
            const base58 = bs58.encode(Uint8Array.from(bytes))

            console.log('\n📝 Base64 to Base58 Conversion:')
            console.log('─'.repeat(50))
            console.log(`Base64: ${b64}`)
            console.log(`Base58: ${base58}`)
            console.log(`Bytes:  ${bytes.length}`)

            return { b64, base58, bytes: bytes.length }
        }
    })
