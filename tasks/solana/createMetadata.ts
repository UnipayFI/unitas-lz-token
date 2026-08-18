import {
    CreateV1InstructionAccounts,
    CreateV1InstructionArgs,
    TokenStandard,
    createV1,
} from '@metaplex-foundation/mpl-token-metadata'
import { percentAmount, publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { toWeb3JsTransaction } from '@metaplex-foundation/umi-web3js-adapters'
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types as devtoolsTypes } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { deriveConnection, getExplorerTxLink, serializeV0MessageForSquads } from './index'

interface CreateMetadataTaskArgs {
    eid: EndpointId
    mint: string
    name: string
    symbol: string
    uri: string
    sellerFeeBasisPoints?: number
    vaultPda?: string
}

task('lz:oft:solana:create-metadata', 'Creates Metaplex metadata for an existing SPL mint')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, devtoolsTypes.eid)
    .addParam('mint', 'The Token mint public key', undefined, devtoolsTypes.string)
    .addParam('name', 'Token Name', undefined, devtoolsTypes.string)
    .addParam('symbol', 'Token Symbol', undefined, devtoolsTypes.string)
    .addParam('uri', 'URI for token metadata', '', devtoolsTypes.string)
    .addOptionalParam(
        'sellerFeeBasisPoints',
        'Seller fee basis points (for Metaplex metadata, not OFT fees)',
        0,
        devtoolsTypes.int
    )
    .addOptionalParam(
        'vaultPda',
        'Vault PDA as update authority; if provided, outputs a Squads-compatible base58 message instead of sending',
        undefined,
        devtoolsTypes.string
    )
    .setAction(
        async ({ eid, mint: mintStr, name, symbol, uri, sellerFeeBasisPoints, vaultPda }: CreateMetadataTaskArgs) => {
            const primary = await deriveConnection(eid)
            const { connection } = primary
            const mint = publicKey(mintStr)

            const mintInfo = await getMint(connection, new PublicKey(mintStr), undefined, TOKEN_PROGRAM_ID)
            if (!mintInfo.mintAuthority) {
                throw new Error('Mint authority is null; cannot create metadata for this mint')
            }
            const decimals = mintInfo.decimals
            const mintAuthority = mintInfo.mintAuthority.toBase58()
            const vaultUpdateAuthority = vaultPda ? publicKey(vaultPda) : undefined
            const shouldOutputSquadsMessage = !!vaultPda && mintAuthority === vaultPda

            const { umi, umiWalletSigner } = shouldOutputSquadsMessage
                ? await deriveConnection(eid, { noopSigner: vaultUpdateAuthority })
                : primary
            if (vaultPda && !shouldOutputSquadsMessage) {
                console.log(
                    `Mint authority is ${mintAuthority}, not ${vaultPda}. Sending transaction with local signer.`
                )
            }

            const isTestnet = eid == EndpointId.SOLANA_V2_TESTNET

            const createArgs: CreateV1InstructionAccounts & CreateV1InstructionArgs = {
                mint,
                name,
                symbol,
                uri,
                decimals,
                isMutable: true,
                sellerFeeBasisPoints: percentAmount(sellerFeeBasisPoints ?? 0),
                authority: umiWalletSigner,
                payer: umiWalletSigner,
                updateAuthority: vaultUpdateAuthority ?? umiWalletSigner.publicKey,
                tokenStandard: TokenStandard.Fungible,
            }

            const ix = createV1(umi, createArgs)
            const txBuilder = transactionBuilder().add(ix)

            if (shouldOutputSquadsMessage) {
                txBuilder.setFeePayer(primary.umiWalletSigner).useV0()
                const web3JsTxn = toWeb3JsTransaction(await txBuilder.buildWithLatestBlockhash(umi))
                const base58 = bs58.encode(new Uint8Array(serializeV0MessageForSquads(web3JsTxn)))
                console.log('==== Import the following base58 txn data into the Squads UI ====')
                console.log(base58)
            } else {
                const tx = await txBuilder.sendAndConfirm(umi)
                console.log(`createMetadataTx: ${getExplorerTxLink(bs58.encode(tx.signature), isTestnet)}`)
            }
        }
    )
