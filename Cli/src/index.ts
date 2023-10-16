import {
  Connection,
  Keypair,
  Signer,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
  ConfirmOptions,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  Commitment,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  clusterApiUrl
} from "@solana/web3.js"
import * as bs58 from 'bs58'
import fs from 'fs'
import * as anchor from '@project-serum/anchor'
import {AccountLayout,MintLayout,TOKEN_PROGRAM_ID,Token,ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { program } from 'commander';
import { programs } from '@metaplex/js';
import log from 'loglevel';
import axios from "axios"
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

program.version('0.0.1');
log.setLevel('info');

// const programId = new PublicKey('AirdfxxqajyegRGW1RpY5JfPyYiZ2Z9WYAZxmhKzxoKo')
const programId = new PublicKey('Hq6uN7rEysDbBQDSte5JXLwuhKX8NJ3MsDAwvhdJhgkv')
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
const pool_address = new PublicKey('9C6LsMVXabiPNVG4gJQVYV1Rg76Wd6jDZpekVvC9ti4J')
const idl=JSON.parse(fs.readFileSync('src/solana_anchor.json','utf8'))
const { metadata: { Metadata } } = programs

const confirmOption : ConfirmOptions = {
    commitment : 'finalized',
    preflightCommitment : 'finalized',
    skipPreflight : false
}

const sleep = (ms : number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

function loadWalletKey(keypair : any): Keypair {
  if (!keypair || keypair == '') {
    throw new Error('Keypair is required!');
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
  );
  log.info(`wallet public key: ${loaded.publicKey}`);
  return loaded;
}

const getTokenWallet = async (
  wallet: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
    ) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
}

const getMetadata = async (
  mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: PublicKey,
  payer: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey
    ) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

async function getDecimalsOfToken(conn : Connection, mint : PublicKey){
  let resp = await conn.getAccountInfo(mint)
  let accountData = MintLayout.decode(Buffer.from(resp!.data))
  return accountData.decimals
}

programCommand('init_pool')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [pool, bump] = await PublicKey.findProgramAddress([rand.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)
    const tokenAccount = await getTokenWallet(pool, tokenMint)
    transaction.add(createAssociatedTokenAccountInstruction(tokenAccount, owner.publicKey, pool, tokenMint))
    const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    console.log("token decimal", decimals);
    transaction.add(program.instruction.initPool(
      new anchor.BN(bump),
      new anchor.BN(infoJson.staking_period),
      new anchor.BN(infoJson.withdraw_period),
      new anchor.BN(infoJson.start_time),
      new anchor.BN(infoJson.soul_amount),
      new anchor.BN(infoJson.win_percent),
      new anchor.BN(infoJson.fail_percent),
      new anchor.BN(infoJson.burn_percent),
      new anchor.BN(infoJson.token_unit),
      infoJson.stake_collection,
      infoJson.token_halos,
      infoJson.token_horns,
      new anchor.BN(infoJson.period),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool,
          rand : rand,
          soulsMint : tokenMint,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("POOL : "+pool.toBase58())
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

programCommand('get_pool')
  .option(
    '-p, --pool <string>',
    'pool address'
  )
  .action(async (directory,cmd)=>{
    const {env, pool} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const poolAddress = new PublicKey(pool)
    const wallet = new anchor.Wallet(Keypair.generate())
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const poolData = await program.account.pool.fetch(poolAddress)
    // const resp = await conn.getTokenAccountBalance(poolData.souls_mint, "max")
    // const amount = resp.value.uiAmountString
    // const decimals = Math.pow(10,resp.value.decimals)
    console.log("test");
    console.log("        Pool Data");
    console.log("Owner : " + poolData.owner.toBase58())
    console.log("Token : " + poolData.soulsMint.toBase58())
    console.log("total souls : " + poolData.totalSouls.toNumber())
    console.log("staking period : " + poolData.stakingPeriod.toNumber() + " day")
    console.log("withdraw period : " + poolData.withdrawPeriod.toNumber() + " day")
    console.log("halos count", poolData.halosCount.toNumber());
    console.log("horns_count", poolData.hornsCount.toNumber());
    console.log("soul amount", poolData.soulAmount.toNumber());
    console.log("start time", poolData.startTime.toNumber());
    console.log("token unit", poolData.tokenUnit.toNumber());
    console.log("stake collection", poolData.stakeCollection);
    console.log("token halos", poolData.tokenHalos);
    console.log("token horns", poolData.tokenHorns);
    console.log("win percent", poolData.winPercent.toNumber());
    console.log("fail percent", poolData.failPercent.toNumber());
    console.log("burn percent", poolData.burnPercent.toNumber());
    console.log("period", poolData.period.toNumber());
    console.log("when                   amount");
    // (poolData.schedule as any[]).map((item) => {
    //   console.log((new Date(item!.airdropTime*1000)).toLocaleString(),"      ",item!.airdropAmount/decimals)
    // })
    console.log("")
  })

  programCommand('get_nft')
  .option(
    '-k, --keypair <path>',
    'keypair path'
  ).action(async (directory,cmd)=>{
    const {env, keypair} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    // const provider = new anchor.Provider(conn,owner,confirmOption)

    const allTokens: any = []
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner.publicKey, {
      programId: TOKEN_PROGRAM_ID
    });

    for (let index = 0; index < tokenAccounts.value.length; index++) {
      try{
        const tokenAccount = tokenAccounts.value[index];
        const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
        if (tokenAmount.amount == "1" && tokenAmount.decimals == "0") {
          let nftMint = new PublicKey(tokenAccount.account.data.parsed.info.mint)
          let [pda] = await anchor.web3.PublicKey.findProgramAddress([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            nftMint.toBuffer(),
          ], TOKEN_METADATA_PROGRAM_ID);
          const accountInfo: any = await conn.getParsedAccountInfo(pda);
          let metadata : any = new Metadata(owner.publicKey.toString(), accountInfo.value);
          console.log("test meatadata", metadata.data.data)
          const { data }: any = await axios.get(metadata.data.data.uri)
          console.log("nft get data", data)
          if (true) {
            const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0]) }
            console.log("nft data", entireData);
            console.log("hvh type",entireData.attributes[0].value)
            allTokens.push({account_address : tokenAccount.pubkey, mint_address : nftMint, ...entireData, mname : metadata.data.data.name })
          }
        }
        allTokens.sort(function (a: any, b: any) {
          if (a.name < b.name) { return -1; }
          if (a.name > b.name) { return 1; }
          return 0;
        })
      } catch(err) {
        continue;
      }
    }

    console.log("")
  })

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'mainnet-beta',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

function setLogLevel(value : any, prev : any) {
  if (value === undefined || value === null) {
    return;
  }
  console.log('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv)