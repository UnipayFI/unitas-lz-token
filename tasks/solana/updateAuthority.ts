import { AccountMeta, publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { toWeb3JsTransaction } from '@metaplex-foundation/umi-web3js-adapters'
import { AuthorityType, TOKEN_PROGRAM_ID, createSetAuthorityInstruction, getMint } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { types as devtoolsTypes } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { deriveConnection, getExplorerTxLink, serializeV0MessageForSquads } from '.'

interface UpdateAuthorityBaseArgs {
    eid: EndpointId
    mint: string
    vaultPda?: string
    tokenProgram: string
}

interface UpdateMintAuthorityArgs extends UpdateAuthorityBaseArgs {
    newMintAuthority: string
}

interface UpdateFreezeAuthorityArgs extends UpdateAuthorityBaseArgs {
    newFreezeAuthority: string
}

const buildAndSendOrOutput = async ({
    eid,
    mint,
    tokenProgram,
    vaultPda,
    currentAuthority,
    newAuthority,
    authorityType,
    authorityLabel,
}: {
    eid: EndpointId
    mint: PublicKey
    tokenProgram: PublicKey
    vaultPda?: string
    currentAuthority: string
    newAuthority: string
    authorityType: AuthorityType
    authorityLabel: string
}) => {
    let umi
    let umiWalletSigner

    if (vaultPda && currentAuthority === vaultPda) {
        const derived = await deriveConnection(eid, { readOnly: true, noopSigner: publicKey(vaultPda) })
        umi = derived.umi
        umiWalletSigner = derived.umiWalletSigner
    } else {
        const derived = await deriveConnection(eid)
        umi = derived.umi
        umiWalletSigner = derived.umiWalletSigner

        if (vaultPda) {
            console.log(
                `${authorityLabel} authority is ${currentAuthority}, not ${vaultPda}. Sending transaction with local signer.`
            )
        }

        if (currentAuthority !== umiWalletSigner.publicKey.toString()) {
            throw new Error(
                `${authorityLabel} authority is ${currentAuthority}, not the local signer ${umiWalletSigner.publicKey.toString()}`
            )
        }
    }

    const authorityPkStr = vaultPda && currentAuthority === vaultPda ? vaultPda : umiWalletSigner.publicKey.toString()
    const currentAuthorityPk = new PublicKey(authorityPkStr)

    const ix = createSetAuthorityInstruction(
        mint,
        currentAuthorityPk,
        authorityType,
        new PublicKey(newAuthority),
        [],
        tokenProgram
    )

    const umiInstruction = {
        programId: publicKey(ix.programId.toBase58()),
        keys: ix.keys.map((key) => ({
            pubkey: key.pubkey as any,
            isSigner: key.isSigner,
            isWritable: key.isWritable,
        })) as unknown as AccountMeta[],
        data: new Uint8Array(ix.data),
    }

    const txBuilder = transactionBuilder().add({
        instruction: umiInstruction as any,
        signers: [umiWalletSigner],
        bytesCreatedOnChain: 0,
    })

    if (vaultPda && currentAuthority === vaultPda) {
        txBuilder.setFeePayer(umiWalletSigner).useV0()
        const web3JsTxn = toWeb3JsTransaction(await txBuilder.buildWithLatestBlockhash(umi))
        const base58Message = bs58.encode(new Uint8Array(serializeV0MessageForSquads(web3JsTxn)))
        console.log('==== Import the following base58 txn data into the Squads UI ====')
        console.log(base58Message)
    } else {
        const isTestnet = eid === EndpointId.SOLANA_V2_TESTNET
        const { signature } = await txBuilder.sendAndConfirm(umi)
        console.log(`Txn link: ${getExplorerTxLink(bs58.encode(signature), isTestnet)}`)
    }
}

task('lz:oft:solana:update-mint-authority', 'Updates SPL mintAuthority')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, devtoolsTypes.eid)
    .addParam('mint', 'The Token mint public key', undefined, devtoolsTypes.string)
    .addParam('newMintAuthority', 'New mint authority public key', undefined, devtoolsTypes.string)
    .addOptionalParam('tokenProgram', 'The Token Program public key', TOKEN_PROGRAM_ID.toBase58(), devtoolsTypes.string)
    .addOptionalParam('vaultPda', 'The Vault PDA public key', undefined, devtoolsTypes.string)
    .setAction(async ({ eid, mint: mintStr, vaultPda, newMintAuthority, tokenProgram }: UpdateMintAuthorityArgs) => {
        const { connection } = await deriveConnection(eid, { readOnly: true })

        const tokenProgramPk = new PublicKey(tokenProgram)
        const mintPk = new PublicKey(mintStr)
        const mintInfo = await getMint(connection, mintPk, undefined, tokenProgramPk)

        if (!mintInfo.mintAuthority) {
            throw new Error('Mint authority is null; cannot set mint authority')
        }

        const currentMintAuthority = mintInfo.mintAuthority.toBase58()
        await buildAndSendOrOutput({
            eid,
            mint: mintPk,
            tokenProgram: tokenProgramPk,
            vaultPda,
            currentAuthority: currentMintAuthority,
            newAuthority: newMintAuthority,
            authorityType: AuthorityType.MintTokens,
            authorityLabel: 'Mint',
        })
    })

task('lz:oft:solana:update-freeze-authority', 'Updates SPL freezeAuthority')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, devtoolsTypes.eid)
    .addParam('mint', 'The Token mint public key', undefined, devtoolsTypes.string)
    .addParam('newFreezeAuthority', 'New freeze authority public key', undefined, devtoolsTypes.string)
    .addOptionalParam('tokenProgram', 'The Token Program public key', TOKEN_PROGRAM_ID.toBase58(), devtoolsTypes.string)
    .addOptionalParam('vaultPda', 'The Vault PDA public key', undefined, devtoolsTypes.string)
    .setAction(
        async ({ eid, mint: mintStr, vaultPda, newFreezeAuthority, tokenProgram }: UpdateFreezeAuthorityArgs) => {
            const { connection } = await deriveConnection(eid, { readOnly: true })

            const tokenProgramPk = new PublicKey(tokenProgram)
            const mintPk = new PublicKey(mintStr)
            const mintInfo = await getMint(connection, mintPk, undefined, tokenProgramPk)

            if (!mintInfo.freezeAuthority) {
                throw new Error('Freeze authority is null; cannot set freeze authority')
            }

            const currentFreezeAuthority = mintInfo.freezeAuthority.toBase58()
            await buildAndSendOrOutput({
                eid,
                mint: mintPk,
                tokenProgram: tokenProgramPk,
                vaultPda,
                currentAuthority: currentFreezeAuthority,
                newAuthority: newFreezeAuthority,
                authorityType: AuthorityType.FreezeAccount,
                authorityLabel: 'Freeze',
            })
        }
    )
