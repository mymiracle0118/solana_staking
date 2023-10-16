import { Fragment, useRef, useState, useEffect } from 'react';
import useNotify from './notify'
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import * as anchor from "@project-serum/anchor";
import {AccountLayout,MintLayout,TOKEN_PROGRAM_ID,Token,ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { programs } from '@metaplex/js'
import moment from 'moment';
import Loading from "./Loading";
// import win_horns from "./video/win_horns.mov";
// import winhorns from "../asset/video/winhorns.mp4";
import winhorns from "../asset/video/winhorns.mp4";
import winhalos from "../asset/video/winhalos.mp4";
import { FaDiscord } from "react-icons/fa";
import { FaTwitter } from "react-icons/fa";
// import drawn from "../asset/video/drawn.mp4";
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
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  Commitment,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  clusterApiUrl,
  StakeInstruction
} from "@solana/web3.js";
import axios from "axios"
import { token } from '@project-serum/anchor/dist/cjs/utils';
import { createJsxClosingElement, moveEmitHelpers, PollingWatchKind } from 'typescript';
import { clearInterval } from 'timers';
import { unstable_renderSubtreeIntoContainer } from 'react-dom';
import SelectInput from '@mui/material/Select/SelectInput';

let wallet : any
let conn = new Connection(clusterApiUrl('mainnet-beta'))
let notify : any
const { metadata: { Metadata } } = programs
const COLLECTION_NAME = "Gorilla"
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
)
const programId = new PublicKey('Hq6uN7rEysDbBQDSte5JXLwuhKX8NJ3MsDAwvhdJhgkv')
const idl = require('./solana_anchor.json')
const confirmOption : ConfirmOptions = {
    commitment : 'finalized',
    preflightCommitment : 'finalized',
    skipPreflight : false
}

// const REWARD_TOKEN = 'sou1ELxm3XpLWpnjP81KaoigPPCwbNUFAZ4dhqifq13' //Mainnet beta
const REWARD_TOKEN = 'sou1ELxm3XpLWpnjP81KaoigPPCwbNUFAZ4dhqifq13'

let POOL = new PublicKey('AXs3wpVhvfX2K2TQFU8FM1bVwDG9M8hAJYY8LSXf12cM') // Devnet
const STAKEDATA_SIZE = 8 + 32 + 32 + 32 + 32 + 8 + 1;
const DEVNET_ID = 103;

let init = true;
let ownerstakedinfo: any = null;
let pD : any ;
// let claimAmount = 0
let nfts : any[] = []
let stakedNfts : any[] = []
let catchFlag : boolean = false;
let progressflag : boolean = false;
const delay_ms : Number = 50;

const getTimeZoneOffset = (date : any, timeZone : any) => {

  // Abuse the Intl API to get a local ISO 8601 string for a given time zone.
  const options = {
      timeZone, calendar: 'iso8601', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
};
 // @ts-ignore
 const dateTimeFormat = new Intl.DateTimeFormat(undefined, options);
 const parts = dateTimeFormat.formatToParts(date);
 const map = new Map(parts.map((x) => [x.type, x.value]));
 const year = map.get('year');
 const month = map.get('month');
 const day = map.get('day');
 const hour = map.get('hour');
 const minute = map.get('minute');
 const second = map.get('second');
 const ms = date.getMilliseconds().toString().padStart(3, '0');
 const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}`;

 // Lie to the Date object constructor that it's a UTC time.
 const lie = new Date(`${iso}Z`);

 // Return the difference in timestamps, as minutes
 // Positive values are West of GMT, opposite of ISO 8601
 // this matches the output of `Date.getTimeZoneOffset`
 // @ts-ignore
 return -(lie - date) / 60 / 1000;
};

function sleep(time: any){
  return new Promise((resolve)=>setTimeout(resolve,time)
)
}

const getTimeStampOfDateInEnvTimeZone = (timeStamp:number, userTimezone: string, timezoneForTesting:string) => {

  const envTimeZoneOffsetInMinutes = getTimeZoneOffset(new Date(timeStamp), timezoneForTesting);
  const userTimeZoneOffsetInMInutes = getTimeZoneOffset(new Date(timeStamp), userTimezone);
  const difference = userTimeZoneOffsetInMInutes - envTimeZoneOffsetInMinutes;
  const diffInMilliseconds = difference * 60000;
  return timeStamp - diffInMilliseconds;
};

const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
    ) => {  
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

const getTokenListInfo = async (address:String, chainId:Number) => {
  const tokens: any = await new TokenListProvider().resolve();
  const tokenlist: any = await tokens.filterByChainId(chainId).getList();
  let tokenitem;
  await tokenlist.map((item: any) => {
    if(item.address === address) {
      tokenitem = item;
    }
  });
  return tokenitem;
}

const getMasterEdition = async (
  mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

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
};

const getStakeStateInfo = async (address: PublicKey) => {
  let wallet = new anchor.Wallet(Keypair.generate())
  let provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)
  let poolData = await program.account.stakeState.fetch(address)
  return poolData;
}

const getStakeDataInfo = async (address: PublicKey) => {
  let wallet = new anchor.Wallet(Keypair.generate())
  let provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)
  let poolData = await program.account.stakeData.fetch(address)
  return poolData;
}

async function getTokenAccountBalance(owner: PublicKey, mint: PublicKey) {
  let amount = 0
    if( owner != null ){
      const tokenAccount = await getTokenWallet(owner, mint)
      if(await conn.getAccountInfo(tokenAccount)){
        let resp : any = (await conn.getTokenAccountBalance(tokenAccount)).value
        amount = Number(resp.uiAmount)
      }
    }
  return amount;
}

async function getStakeStateAccount(owner : PublicKey, pool: PublicKey, token: PublicKey) {
  // console.log(owner, pool, token);
  return await PublicKey.findProgramAddress([owner.toBuffer(),pool.toBuffer(), token.toBuffer()], programId)
}

async function getOwnerStakeStateInfo() {
  const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
  let [stakeState] = await getStakeStateAccount(wallet.publicKey, POOL, reward_mint);
  if((await conn.getAccountInfo(stakeState)) == null) {
    return;
  }

  let balance = await getTokenAccountBalance(wallet.publicKey, reward_mint);

  let stateinfo = await getStakeStateInfo(stakeState);
  ownerstakedinfo = {
    ...stateinfo,
    souls : balance,
  }
}

let init_flag= false;

export default function Stake(){

	const [changed, setChange] = useState(true)
	const [rewardAmount, setRewardAmount] = useState(10)
	const [period, setPeriod] = useState(60)
	const [withdrawable, setWithdrawable] = useState(7)
	const [collectionName, setCollectionName] = useState(COLLECTION_NAME)
	const [rewardToken, setRewardToken] = useState(REWARD_TOKEN)
  const [todaystr, setDateTime] = useState(""); // Save the current date to be able to trigger an update
  const [loading, setLoading] = useState(false);
  const [claimableAmount, setClaimAmount] = useState(0);
  const [stakingPeriod, setStakingPeriod] = useState({start:"", end:""});
  const [withdrawPeriod, setWithdrawPeriod] = useState({start:"", end: ""});
  const [fightingFlag, setFightingFlag] = useState(0);//default halos win
  const [winTeam, setWinTeam] = useState("");
  // const [init, setInitFlag] = useState(false);
  
  let stakedinfo;

  wallet = useWallet()
	notify = useNotify()

  useEffect(() => {
    const timer = setInterval(() => {
      getTime();
    },1000);

    return () => {
      clearInterval(timer);
    }
  }, []);

  useEffect(() => {
    if(wallet){
      if(!wallet.disconnecting && wallet.publicKey && !init_flag) {
        init_flag = true;
        console.log("get info")
        getNfts()
      }
    }
  }, [wallet])
  // useEffect(() => {
  //   if(wallet.publicKey !== undefined) {
  //     console.log("wallet", wallet)
  //     getNfts()
  //     init = false
  //   }
  // }, [loading])

  // const testTimezone = () => {

  //   const timezoneOffset = (new Date()).getTimezoneOffset();

  //   console.log("timezone offset", timezoneOffset);

  //   const date = new Date();
  //   const dateAsString = date.toString();
  //   console.log("date string", dateAsString)

  //   console.log(moment().utcOffset()); // (-240, -120, -60, 0, 60, 120, 240, etc.)
  //   // const timezone = dateAsString.match(/\(([^\)]+)\)$/)[1];

  //   // console.log(timezone);

  // }

  const getTime = () => {
    // testTimezone();
    const today = new Date();
    setDateTime(today.toLocaleString("en-US"));

    if(pD) {
      catchClaimPeriod();
    }

    if(pD) {
      if(moment().unix() > Date.parse(pD.end_withdraw) / 1000) {
        updateStakingPeriod();
      }
    }
  }

  const updateStakingPeriod = async () => {

    let time_period = getStakingPeriod();

    const time_interval = moment().unix() - time_period.withdraw_limit;

    let day_interval = time_interval / (time_period.total_period * pD.period);
    day_interval = day_interval | 0;

    if(time_interval < 0)
      day_interval--;

    const starttime = Date.parse(pD.abs_start_time) / 1000 + pD.period * (day_interval + 1) * time_period.total_period;
    const next_staking_limit = starttime + pD.period * pD.staking_period;
    const withdrawtime = next_staking_limit + 1;
    const next_withdraw_limit = withdrawtime + pD.period * pD.withdraw_period;

    const next_staking_start = new Date(starttime * 1000);
    const next_staking_end = new Date(next_staking_limit * 1000);
    const next_withdraw_start = new Date(withdrawtime * 1000);
    const next_withdraw_end = new Date(next_withdraw_limit * 1000);

    pD.start_time = next_staking_start;
    pD.end_time = next_staking_end;

    pD.start_withdraw = next_withdraw_start;
    pD.end_withdraw = next_withdraw_end;

    setStakingPeriod({
      start: next_staking_start.toLocaleString("en-US"),
      end: next_staking_end.toLocaleString("en-US"),
    })

    setWithdrawPeriod({
      start: next_withdraw_start.toLocaleString("en-US"),
      end: next_withdraw_end.toLocaleString("en-US")
    })
  }

  const catchClaimPeriod = async () => {
     if((moment().unix() > (Date.parse(pD.end_time) / 1000)) && (moment().unix() < (Date.parse(pD.end_withdraw) / 1000))) {
      if(catchFlag)
        return;
      getClaimAmount(conn, wallet.publicKey);

      if(pD.halos_count > pD.horns_count) {
        setFightingFlag(0);// halos win
        setWinTeam("Halos");
      } else if(pD.halos_count < pD.horns_count) {
        setFightingFlag(1);// horns win
        setWinTeam("Horns");
      } else {
        setFightingFlag(2);// drawn
        setWinTeam("Drawn");
      }

      catchFlag = true;
    } else {
      catchFlag = false;
    }
  }

  async function validateStaking(
    conn : Connection,
    owner : PublicKey
    ){
    console.log("+ validate Staking")

    if(!wallet.connected) {
      notify('error', 'Wallet is unconnected!');
      // setLoading(false);
      return false;
    }

    const provider = new anchor.Provider(conn, wallet, anchor.Provider.defaultOptions());
    const program = new anchor.Program(idl, programId, provider);

    await getPoolData();

    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);

    let [stakeState] = await getStakeStateAccount(owner, POOL, reward_mint);

    let balance = await getTokenAccountBalance(owner, reward_mint);

    if(balance < pD.soulAmount) {
      notify('error', 'Insufficient tokens!');
      // setLoading(false);
      return false;
    }

    // console.log(time_period.staking_limit, moment().unix(), time_period.withdraw_limit);
    
    if(moment().unix() >= Date.parse(pD.end_time) / 1000 && moment().unix() <= Date.parse(pD.end_withdraw) / 1000) {
      notify('error', 'Staking period has passed!');
      // setLoading(false)
      return false;
    }

    if((await conn.getAccountInfo(stakeState)) != null) {
      stakedinfo = await getStakeStateInfo(stakeState)
      // console.log(moment().unix(), time_period.staking_limit)
      if(moment().unix() < Date.parse(pD.end_time) / 1000) {
        if(stakedinfo.lastStakeTime.toNumber() !== 0 && stakedinfo.lastStakeTime.toNumber() < (Date.parse(pD.start_time) / 1000)) {
            if(stakedinfo.halosCount != 0 || stakedinfo.hornsCount != 0) {
              // console.log("test")
              notify('error', 'You should claim and unstake nft tokens before stake!');
              // setLoading(false)
              return false;
            }
        }
      }
    }
      
    // console.log(starttime, moment().unix(), next_staking_limit)
    if(moment().unix() > Date.parse(pD.end_withdraw) / 1000) {
      // console.log("test")
      notify('error', 'Staking period has passed!');
      // setLoading(false);
      return false;
    }

    return true;
  }

  async function stake(
    nftAccount : PublicKey,
    nftMint : PublicKey,
    hvhtype : String
    ){

    setLoading(true);

    if(!await validateStaking(conn, wallet.publicKey)) {
      setLoading(false);
      return;
    }

    console.log("+ stake")

    let provider = new anchor.Provider(conn, wallet as any, confirmOption)
    let program = new anchor.Program(idl,programId,provider)

    const stakeData = Keypair.generate()
    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
    const metadata = await getMetadata(nftMint)
    const sourceNftAccount = nftAccount;
    const destNftAccount = await getTokenWallet(POOL,nftMint)
    const srcSoulsAccount = await getTokenWallet(wallet.publicKey, reward_mint);
    const destSoulsAccount = await getTokenWallet(POOL, reward_mint);

    const accountInfo: any = await conn.getParsedAccountInfo(metadata);
    let metadata1 : any = new Metadata(wallet.publicKey.toString(), accountInfo.value);

    let [stakeState, bump] = await getStakeStateAccount(wallet.publicKey, POOL, reward_mint);
  

    let transaction = new Transaction()
    // signers.push(stakeState)
    if((await conn.getAccountInfo(destNftAccount)) == null)
      transaction.add(createAssociatedTokenAccountInstruction(destNftAccount,wallet.publicKey,POOL,nftMint))
    if((await conn.getAccountInfo(destSoulsAccount)) == null)
      transaction.add(createAssociatedTokenAccountInstruction(destSoulsAccount,wallet.publicKey,POOL,reward_mint))
    if((await conn.getAccountInfo(stakeState)) == null) {
      transaction.add(
        await program.instruction.initStakeState(new anchor.BN(bump),
        {
          accounts: {
            owner : wallet.publicKey,
            pool : POOL,
            soulsMint: reward_mint,
            stakeState: stakeState,
            systemProgram : anchor.web3.SystemProgram.programId
          }
        })
      )
    }

    let signers : Keypair[] = []
    signers.push(stakeData)
    transaction.add(
      await program.instruction.stake(hvhtype, {
        accounts: {
          owner : wallet.publicKey,
          pool : POOL,
          stakeData : stakeData.publicKey,
          stakeState : stakeState,
          nftMint : nftMint,
          metadata : metadata,
          sourceNftAccount : sourceNftAccount,
          destNftAccount : destNftAccount,
          sourceSoulsAccount:srcSoulsAccount,
          destSoulsAccount:destSoulsAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : anchor.web3.SystemProgram.programId,
          clock : SYSVAR_CLOCK_PUBKEY
        }
      })
    )

    await sendTransaction(transaction,signers)

  }

  async function stakeAll(hvflag : boolean){

    setLoading(true);

    if(nfts.length <= 0) {
      setLoading(false);
      return;
    }

    console.log("+ stakeAll")

    let provider = new anchor.Provider(conn, wallet as any, confirmOption)
    let program = new anchor.Program(idl,programId,provider)
    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
    let [stakeState, bump] = await getStakeStateAccount(wallet.publicKey, POOL, reward_mint);

    let stakeData = null;
    let metadata = null;
    let sourceNftAccount = null;
    let destNftAccount = null;
    let srcSoulsAccount = null;
    let destSoulsAccount = null;

    let accountInfo: any = null;
    let metadata1 : any = null;
    let j = 0;
    // nft.account_address, nft.mint_address, nft.attributes[0].value

    // let instructions : TransactionInstruction[] = []
    let transaction = new Transaction()
    let signers : Keypair[] = []

    if((await conn.getAccountInfo(stakeState)) == null) {
      transaction.add(
        await program.instruction.initStakeState(new anchor.BN(bump),
        {
          accounts: {
            owner : wallet.publicKey,
            pool : POOL,
            soulsMint: reward_mint,
            stakeState: stakeState,
            systemProgram : anchor.web3.SystemProgram.programId
          }
        })
      )

      await sendTransaction(transaction, signers)

    }

    progressflag = true;

    for(let i = 0; i < nfts.length; i++) {

      if(!await validateStaking(conn, wallet.publicKey) || !progressflag) {
        // await getNfts();
        setLoading(false);
        return;
      }

      if(hvflag && nfts[i].attributes[0].value != pD.token_halos) {
        // console.log("halos", nfts[i].attributes[0].value, pD.token_halos)
        continue;
      }

      if(!hvflag && nfts[i].attributes[0].value != pD.token_horns) {
        // console.log("horns", nfts[i].attributes[0].value, pD.token_horns)
        continue;
      }
  
      stakeData = Keypair.generate()
      metadata = await getMetadata(nfts[i].mint_address)  
      sourceNftAccount = nfts[i].account_address   
      destNftAccount = await getTokenWallet(POOL, nfts[i].mint_address) 
      srcSoulsAccount = await getTokenWallet(wallet.publicKey, reward_mint)  
      destSoulsAccount = await getTokenWallet(POOL, reward_mint);
      
      accountInfo = await conn.getParsedAccountInfo(metadata);
      metadata1 = new Metadata(wallet.publicKey.toString(), accountInfo.value);
 
      let transaction = new Transaction()
      let signers : Keypair[] = []


      if((await conn.getAccountInfo(destNftAccount)) == null)
        transaction.add(createAssociatedTokenAccountInstruction(destNftAccount,wallet.publicKey,POOL, nfts[i].mint_address))
      if((await conn.getAccountInfo(destSoulsAccount)) == null)
        transaction.add(createAssociatedTokenAccountInstruction(destSoulsAccount,wallet.publicKey,POOL,reward_mint))
      
      signers.push(stakeData)

      transaction.add(
        await program.instruction.stake(nfts[i].attributes[0].value, {
          accounts: {
            owner : wallet.publicKey,
            pool : POOL,
            stakeData : stakeData.publicKey,
            stakeState : stakeState,
            nftMint : nfts[i].mint_address,
            metadata : metadata,
            sourceNftAccount : sourceNftAccount,
            destNftAccount : destNftAccount,
            sourceSoulsAccount:srcSoulsAccount,
            destSoulsAccount:destSoulsAccount,
            tokenProgram : TOKEN_PROGRAM_ID,
            systemProgram : anchor.web3.SystemProgram.programId,
            clock : SYSVAR_CLOCK_PUBKEY
          }
        })
      )

      await sendSingleTransaction(transaction, signers)

    }

    await getNfts();
    setLoading(false);

  }

  async function validateUnStaking(stakedatainfo : any){
    console.log("+ validate UnStaking")

    if(!wallet.connected) {
      notify('error', 'Wallet is unconnected!');
      // setLoading(false);
      return false;
    }

    if(stakedatainfo.unstaked) {
      notify('error', 'Already unstaked!');
      // setLoading(false);
      return false;
    }

    await getPoolData();

    if(moment().unix() <= Date.parse(pD.end_time) / 1000) {
      notify('error', 'Please wait until the weekly staking competition is complete!');
      // setLoading(false);
      return false;
    }

    return true;
  }

  async function unstake(
    stakeData : PublicKey,
    hvhtype : String
    ){

    setLoading(true);

    let stakedatainfo = await getStakeDataInfo(stakeData);
    if(!await validateUnStaking(stakedatainfo)) {
      setLoading(false)
      return;
    }
    console.log("+ unstake")

    let provider = new anchor.Provider(conn, wallet as any, confirmOption)
    let program = new anchor.Program(idl,programId,provider)
    let stakedNft = await program.account.stakeData.fetch(stakeData)
    let account = await conn.getAccountInfo(stakedNft.nftAccount)
    let mint = new PublicKey(AccountLayout.decode(account!.data).mint)
    const sourceNftAccount = await getTokenWallet(POOL, mint);
    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
    let [stakeState,] = await getStakeStateAccount(wallet.publicKey, POOL, reward_mint);
    const metadata = await getMetadata(mint)

    let transaction = new Transaction()

    transaction.add(
      await program.instruction.unstake(hvhtype,
        {
        accounts:{
          owner : wallet.publicKey,
          pool : POOL,
          stakeData : stakeData,
          stakeState : stakeState,
          nftMint : mint,
          metadata : metadata,
          sourceNftAccount : sourceNftAccount,
          destNftAccount : stakedNft.nftAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : anchor.web3.SystemProgram.programId,
          clock : SYSVAR_CLOCK_PUBKEY
        }
      })
    )

    await sendTransaction(transaction,[])

  }

  async function unstakeAll(){

    setLoading(true);

    let provider = new anchor.Provider(conn, wallet as any, confirmOption)
    let program = new anchor.Program(idl,programId,provider)
    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
    let [stakeState] = await getStakeStateAccount(wallet.publicKey, POOL, reward_mint);
    let stakedNFTs = await getStakedNftsForOwner(conn,wallet.publicKey)

    console.log("+unstake all");

    let transaction = new Transaction()

    let j = 0;
    let stakedNft = null;
    let account = null;
    let mint = null;
    let sourceNftAccount = null;
    let metadata = null;
    let stakeData = null;
    let stakedatainfo = null;
    let instructions : TransactionInstruction[] = []

    if(stakedNFTs.length <= 0) {
      setLoading(false);
      return;
    }

    progressflag = true;

    for(let i = 0; i < stakedNFTs.length; i++) {
      stakeData = stakedNFTs[i].stakeData;
      stakedatainfo = await getStakeDataInfo(stakeData);

      if(!await validateUnStaking(stakedatainfo) || !progressflag) {
        // await getNfts();
        setLoading(false);
        return;
      }

      stakedNft = await program.account.stakeData.fetch(stakeData)
      account = await conn.getAccountInfo(stakedNft.nftAccount)
      mint = new PublicKey(AccountLayout.decode(account!.data).mint)
      sourceNftAccount = await getTokenWallet(POOL, mint);
      metadata = await getMetadata(mint)

      instructions.push(
        await program.instruction.unstake(stakedNFTs[i].type,
          {
          accounts:{
            owner : wallet.publicKey,
            pool : POOL,
            stakeData : stakeData,
            stakeState : stakeState,
            nftMint : mint,
            metadata : metadata,
            sourceNftAccount : sourceNftAccount,
            destNftAccount : stakedNft.nftAccount,
            tokenProgram : TOKEN_PROGRAM_ID,
            systemProgram : anchor.web3.SystemProgram.programId,
            clock : SYSVAR_CLOCK_PUBKEY
          }
        })
      )
      
      j++;

      if((j === 4) || (i === stakedNFTs.length - 1 && j !== 0)) {

        let transaction = new Transaction()
        
        instructions.map(item=>transaction.add(item))
        
        await sendSingleTransaction(transaction, []);

        j = 0;
        instructions = []

      }
    }

    await getNfts();
    setLoading(false);
    // await sendSingleTransaction(transaction,[])
  }

  async function validateClaim(stakestateinfo : any){
    console.log("+ validate UnStaking")

    if(!wallet.connected) {
      notify('error', 'Wallet is unconnected!');
      // setLoading(false);
      return false;
    }

    await getPoolData();

    if(moment().unix() <= Date.parse(pD.end_time) / 1000 || moment().unix() > Date.parse(pD.end_withdraw) / 1000) {
      notify('error', 'Not withdraw period!');
      return false;
    }

    if(stakestateinfo.lastStakeTime.toNumber() <= Date.parse(pD.start_time) / 1000) {
      notify('error', 'You should stake again!');
      return false;
    }

    if(stakestateinfo.claimed) {
      notify('error', 'Already claimed!');
      return false;
    }

    return true;
  }

  async function claim(
    ){
    console.log("+ claim")

    setLoading(true);

    let provider = new anchor.Provider(conn, wallet as any, confirmOption)
    let program = new anchor.Program(idl,programId,provider)  

    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
    let [stakeState] = await getStakeStateAccount(wallet.publicKey, POOL, reward_mint);
    // console.log("test")
    if((await conn.getAccountInfo(stakeState)) === null) {
      notify('error', 'Nothing staked!');
      setLoading(false);
      return false;
    }

    // console.log("test")

    let stakedinfo = await getStakeStateInfo(stakeState);

    if(!await validateClaim(stakedinfo)) {
      setLoading(false);
      return;
    }

    const destSoulsAccount = await getTokenWallet(wallet.publicKey, reward_mint);
    const srcSoulsAccount = await getTokenWallet(POOL, reward_mint);

    let transaction = new Transaction()

    if((await conn.getAccountInfo(destSoulsAccount)) == null)
      transaction.add(createAssociatedTokenAccountInstruction(destSoulsAccount, wallet.publicKey, wallet.publicKey, reward_mint))

    transaction.add(
      await program.instruction.claim({
        accounts:{
          owner : wallet.publicKey,
          pool : POOL,
          stakeState : stakeState,
          destSoulsAccount : destSoulsAccount,
          sourceSoulsAccount : srcSoulsAccount,
          burnSoulsAccount : srcSoulsAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : anchor.web3.SystemProgram.programId,
          clock : SYSVAR_CLOCK_PUBKEY,
        }
      })
    )
    // }

    await sendTransaction(transaction,[])
  
  }

  async function getNftsForOwner(
    conn : any,
    owner : PublicKey
    ){
    // const tokeninfo: any = await getTokenListInfo(REWARD_TOKEN, DEVNET_ID);
    
    // const test_token: PublicKey = new PublicKey(REWARD_TOKEN);
    
    // const tokenbalance: Number = await getTokenAccountBalance(owner, test_token);

    console.log("+ getNftsForOwner")
    const allTokens: any = []
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner, {
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
          let metadata : any = new Metadata(owner.toString(), accountInfo.value);
          // console.log("test meatadata", metadata.data.data.name)
          // console.log("nft get data", data)
          if (metadata.data.data.symbol == pD.staking_collection) {
            const { data }: any = await axios.get(metadata.data.data.uri)
            const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0]) }
            // console.log("nft data", entireData);
            if(entireData.attributes) {
              if(entireData.attributes.value === pD.halos || entireData.attributes.value === pD.horns) {
                allTokens.push({account_address : tokenAccount.pubkey, mint_address : nftMint, ...entireData})
              }
            }
          }
        }

        await sleep(delay_ms);

        allTokens.sort(function (a: any, b: any) {
          if (a.name < b.name) { return -1; }
          if (a.name > b.name) { return 1; }
          return 0;
        })
      } catch(err) {
        continue;
      }
    }

    return allTokens
  }

  async function getStakedNftsForOwner(
    conn : Connection,
    owner : PublicKey,
    ){
    console.log("+ getStakedNftsForOwner")
    const wallet = new anchor.Wallet(Keypair.generate());
    const provider = new anchor.Provider(conn, wallet, anchor.Provider.defaultOptions());
    const program = new anchor.Program(idl, programId, provider);
    const allTokens: any = []
    let resp = await conn.getProgramAccounts(programId,{
      dataSlice: {length: 0, offset: 0},
      filters: [{dataSize: STAKEDATA_SIZE}, {memcmp:{offset:8,bytes:owner.toBase58()}}, {memcmp:{offset:40,bytes:POOL.toBase58()}}]
    })

    for(let nftAccount of resp){
      try {
        let stakedNft = await program.account.stakeData.fetch(nftAccount.pubkey)

        if(stakedNft.unstaked) continue;
        let account = await conn.getAccountInfo(stakedNft.nftAccount)

        let mint = new PublicKey(AccountLayout.decode(account!.data).mint)
        let pda= await getMetadata(mint)
        const accountInfo: any = await conn.getParsedAccountInfo(pda);
        let metadata : any = new Metadata(owner.toString(), accountInfo.value);
        const { data }: any = await axios.get(metadata.data.data.uri)
        const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0])}
        // console.log(entireData);
        allTokens.push({
          stakeTime : stakedNft.stakeTime.toNumber(),
          stakeData : nftAccount.pubkey,
          name : entireData.name,
          type : entireData.attributes[0].value,
          ...entireData,
        })
      } catch(error) {
        console.log(error)
        continue
      }
      
    }
    return allTokens
  }

  async function getPoolData(){
    let wallet = new anchor.Wallet(Keypair.generate())
    let provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)

    let poolData = await program.account.pool.fetch(POOL)

    const unixTime = poolData.startTime.toNumber();
    const date = new Date(unixTime * 1000);

    const total_period = poolData.stakingPeriod.toNumber() + poolData.withdrawPeriod.toNumber();
    const staking_limit = unixTime + poolData.period.toNumber() * poolData.stakingPeriod.toNumber();
    const withdraw_limit = unixTime + poolData.period.toNumber() * total_period;
    const withdrawstart = staking_limit + 1;

    // const staking_end = (new Date(staking_limit * 1000)).toLocaleString("en-US");
    // const withdraw_start = (new Date(withdrawstart * 1000)).toLocaleString("en-US");
    // const withdraw_end = (new Date(withdraw_limit * 1000)).toLocaleString("en-US");

    // setStakingPeriod({start: date.toLocaleString("en-US"), end: staking_end});
    // setWithdrawPeriod({start: withdraw_start, end: withdraw_end});

    // console.log("time", date.toLocaleString("en-US"));

    pD = {
      owner : poolData.owner,
      souls_mint : poolData.soulsMint,
      total_souls : poolData.totalSouls.toNumber(),
      halos_count : poolData.halosCount.toNumber(),
      horns_count : poolData.hornsCount.toNumber(),
      win_percent : poolData.winPercent.toNumber(),
      fail_percent : poolData.failPercent.toNumber(),
      burn_percent : poolData.burnPercent.toNumber(),
      burned : poolData.burned,
      soulAmount : poolData.soulAmount.toNumber(),
      token_unit : poolData.tokenUnit.toNumber(),
      staking_period : poolData.stakingPeriod.toNumber(),
      withdraw_period : poolData.withdrawPeriod.toNumber(),
      staking_collection : poolData.stakeCollection,
      token_halos : poolData.tokenHalos,
      token_horns : poolData.tokenHorns,
      start_time : date.toLocaleString("en-US"),
      abs_start_time : date.toLocaleString("en-US"),
      period : poolData.period.toNumber(),
    }

    updateStakingPeriod();
  }

  const getStakingPeriod = () => {
    const total_period = pD.staking_period + pD.withdraw_period;
    const staking_limit = Date.parse(pD.abs_start_time) / 1000 + pD.period * pD.staking_period;
    const withdraw_limit = Date.parse(pD.abs_start_time) / 1000 + pD.period * total_period;

    return {total_period, staking_limit, withdraw_limit};
  }

  async function getClaimAmount(
    conn : Connection,
    owner : PublicKey
    ){
    console.log("+ getClaimAmount")
    const provider = new anchor.Provider(conn, wallet, anchor.Provider.defaultOptions());
    const program = new anchor.Program(idl, programId, provider);

    await getPoolData();

    let claimAmount = 0;

    const reward_mint : PublicKey = new PublicKey(REWARD_TOKEN);
    let [stakeState,] = await getStakeStateAccount(owner, POOL, reward_mint);
    if((await conn.getAccountInfo(stakeState)) == null) {
      notify('error', 'Nothing staked!');
      setClaimAmount(0);
      // catchFlag = false;
      return 0;
    }

    let stakedinfo = await getStakeStateInfo(stakeState)

    if(moment().unix() < Date.parse(pD.end_time) / 1000 || moment().unix() > Date.parse(pD.end_withdraw) / 1000) {
      notify('error', 'Not withdraw period');
      setClaimAmount(0);
      // catchFlag = false;
      return 0;
    }

    if(stakedinfo.lastStakeTime.toNumber() < Date.parse(pD.start_time) / 1000) {
      notify('error', 'You should unstake all tokens and stake again');
      setClaimAmount(0);
      // catchFlag = false;
      return 0;
    }

    let total_amount = pD.total_souls;
    let win_amount = total_amount * pD.win_percent / 100;
    let fail_amount = total_amount * pD.fail_percent / 100;
    let burn_amount = total_amount * pD.burn_percent / 100;
    let pending_amount= total_amount * (100 - pD.burn_percent) / 200; 

    if(pD.halos_count > pD.horns_count) {
      if(pD.halos_count !== 0) {
        claimAmount = win_amount * stakedinfo.halosCount.toNumber() / pD.halos_count;
      }
      if(pD.horns_count !== 0) {
        claimAmount += fail_amount * stakedinfo.hornsCount.toNumber() / pD.horns_count;
      }
    } else if(pD.halos_count < pD.horns_count){
      if(pD.halos_count !== 0) {
        claimAmount = fail_amount * stakedinfo.halosCount.toNumber() / pD.halos_count;
      }
      if(pD.horns_count !== 0) {
        claimAmount += win_amount * stakedinfo.hornsCount.toNumber() / pD.horns_count;
      }
    } else {
      if(pD.halos_count !== 0) {
        claimAmount = pending_amount * stakedinfo.halosCount.toNumber() / pD.halos_count;
      }
      if(pD.horns_count !== 0) {
        claimAmount += pending_amount * stakedinfo.hornsCount.toNumber() / pD.horns_count;
      }
    }

    claimAmount = claimAmount / pD.token_unit;

    setClaimAmount(claimAmount);
  }

  async function sendTransaction(transaction : Transaction,signers : Keypair[]) {
    try{
      transaction.feePayer = wallet.publicKey
      transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
      // await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
      if(signers.length != 0)
        await transaction.partialSign(...signers)
      const signedTransaction = await wallet.signTransaction(transaction);
      let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
      await conn.confirmTransaction(hash);
      await getNfts();
      setLoading(false);
      notify('success', 'Success!');
    } catch(err) {
      console.log(err)
      await getNfts()
      notify('error', 'Failed Instruction!');
      setLoading(false);
      return false;
    }
    return true;
  }

  async function sendSingleTransaction(transaction : Transaction,signers : Keypair[]) {
    try{
      transaction.feePayer = wallet.publicKey
      transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
      await sleep(delay_ms);
      // await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
      if(signers.length != 0)
        await transaction.partialSign(...signers)
      const signedTransaction = await wallet.signTransaction(transaction);
      let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
      await conn.confirmTransaction(hash);
    } catch(err) {
      console.log(err)
      await getNfts()
      progressflag = false;
      notify('error', 'Failed Instruction!');
    }
  }

  async function getNfts(){
    setLoading(true);
    nfts.splice(0,nfts.length)
    stakedNfts.splice(0,stakedNfts.length)
    await getPoolData()
    await getOwnerStakeStateInfo();
    nfts = await getNftsForOwner(conn,wallet.publicKey)
    stakedNfts = await getStakedNftsForOwner(conn,wallet.publicKey)
    // console.log(nfts, stakedNfts)
    setLoading(false);
  }

	return <div className="row">
    <Loading className={loading ? "" : "loading_disable"} />
    <div className='row empty-div'>
    </div>
    <div className='row vs-label'>
      <img src="https://glittercloudsolutions.com/wp-content/uploads/2022/03/61cb5aeb6c8c4a74f25dfb6d_Asset-3@3x-1024x93.png" sizes="100vw" alt="" loading="lazy"/>
    </div>  
    <div className='row vs-video'>
      {!catchFlag && <img src="https://glittercloudsolutions.com/wp-content/uploads/2022/03/61cc0814446fd66fedd66325_video-4-metro-1920x1080-1-1536x864.gif" alt="" loading="lazy" />}
      { catchFlag && <div className="row">
        <div className='row'>
        { fightingFlag === 0 && <div className="winning-video" dangerouslySetInnerHTML={{ __html: `
            <video
              loop
              muted
              autoplay
              playsinline
              src="${winhalos}"
              class="video-style"
            />,
          ` }}></div>
          }
          { fightingFlag === 1 && <div className="winning-video" dangerouslySetInnerHTML={{ __html: `
            <video
              loop
              muted
              autoplay
              playsinline
              src="${winhorns}"
              class="video-style"
            />,
          ` }}></div>
          }
        </div>
        <div className="row winteam-label">
          { (fightingFlag === 0 || fightingFlag === 1 ) && <p>The {winTeam} Are Victorious!</p> }
          { fightingFlag === 2 && <p>The Match Was a Draw!</p> }
          <p>Claimable Amount: {claimableAmount}</p>
        </div>
      </div>
    }
    </div> 
    <div className='row'>
      <div className='row platform-label'>
        <p>STAKING PLATFORM</p>
      </div>
      <div className='row action-all-div'>
        <div className='col-12 col-md-6 col-lg-6 col-xl-6 action-div'>
          <a className="action-button" onClick={async () =>{await stakeAll(true)}}>StakeHalos</a>
        </div>
        <div className='col-12 col-md-6 col-lg-6 col-xl-6 action-div'>
          <a className="action-button" onClick={async () =>{await stakeAll(false)}}>StakeHorns</a>
        </div>
        <div className='col-12 col-md-6 col-lg-6 col-xl-6 action-div'>
          <a className="action-button" onClick={async () =>{await claim()}}>Claim</a>
        </div>
        <div className='col-12 col-md-6 col-lg-6 col-xl-6 action-div'>
          <a className="action-button" onClick={async () =>{await unstakeAll()}}>Unstake</a>
        </div>
      </div>
    </div>
    <div className='row'>
      <div className='col-12 col-md-6 col-lg-6 col-xl-6'>
        <div className='row nft-div'>
          <p>YOUR WALLET NFT</p>
        </div>
        <div className='row'>
          {
            nfts.length && <div className="row">
            {
              nfts.map((nft,idx)=>{
                return <div className="w3-card-4 w3-dark-grey col-6 col-md-4 col-lg-4 col-xl-4" key={idx}>
                  <div className="w3-container w3-center">
                    <h3>{nft.name}</h3>
                      <img className="card-img-top" src={nft.image} alt="Image Error"/>
                    <h5>{nft.attributes[0].value}</h5>
                    <div className="w3-section">
                      <button className="w3-button w3-green" onClick={async ()=>{
                          await stake(nft.account_address, nft.mint_address, nft.attributes[0].value)
                        }}>Stake</button>
                    </div>
                  </div>
                </div>
              })
            }
            </div>
          }
        </div>
      </div>
      <div className='col-12 col-md-6 col-lg-6 col-xl-6'>
        <div className='row nft-div'>
          <p>YOUR STAKED NFT</p>
        </div>
        <div className='row'>
          {
            stakedNfts.map((nft,idx)=>{
              return <div className="w3-card-4 w3-dark-grey col-6 col-md-4 col-lg-4 col-xl-4" key={idx}>
              <div className="w3-container w3-center">
                <h3>{nft.name}</h3>
                  <img className="card-img-top" src={nft.image} alt="Image Error"/>
                <h5>{nft.type}</h5>
                <h5>{(new Date(nft.stakeTime * 1000)).toLocaleString("en-US")}</h5>
                <div className="w3-section">
                  <button className="w3-button w3-green" onClick={async ()=>{
                      await unstake(nft.stakeData, nft.attributes[0].value);
                    }}>UnStake</button>
                </div>
              </div>
            </div>
            })
          }
        </div>
      </div>
    </div>
    <div className='row warning-label'>
      <p>
      YOU MUST UNSTAKE YOUR HORNS AND HALOS EACH WEEK AND RESTAKE THEM DURING THE STAKING PERIOD.
      </p>
      <p>
      YOU WILL NOT PARTICIPATE IN COMPETITIVE STAKING IF YOU LEAVE YOUR NFTs STAKED.
      </p>
    </div>
    <div className='row nft-collection-div'>
      <img src="https://glittercloudsolutions.com/wp-content/uploads/2022/03/61cc058db2a9f7c13ce75b20_web-rotate-devil-300x300.gif" alt="" loading="lazy" />
      <img src="https://glittercloudsolutions.com/wp-content/uploads/2022/03/61cc0557d84fe982e9aaf019_web-rotate-angel-300x300.gif" alt="" loading="lazy" />
    </div>
    <div className='row community-label'>
      <p>
        JOIN THE COMMUNITY
      </p>
    </div>
    <div className='row community-icon'>
      <a href="#" ><FaDiscord style={{width:"50px", height:"40px", color:"white"}}/></a>
      <a href="#" ><FaTwitter style={{width:"50px", height:"40px", color:"white"}}/></a>
    </div>
    {/* <div className='row'>
      <div className='cur-time-show'>
        <p>Today: {todaystr}</p>
      </div>
    </div>
    <hr />
    <div className='row warning-label'>
      <p>
      YOU MUST UNSTAKE YOUR HORNS AND HALOS EACH WEEK AND RESTAKE THEM DURING THE STAKING PERIOD.
      </p>
      <p>
      YOU WILL NOT PARTICIPATE IN COMPETITIVE STAKING IF YOU LEAVE YOUR NFTs STAKED.
      </p>
    </div>
    <hr />
    {pD && 
      <div className='row'>
        <div className='row'>
          <div className='col-lg-6 col-12 time-show'>
            <p>Staking Period:</p>
            <p>{stakingPeriod.start} - {stakingPeriod.end}</p>
          </div>
          <div className='col-lg-6 col-12 time-show'>
            <p>Withdraw Period:</p>
            <p>{withdrawPeriod.start} - {withdrawPeriod.end}</p>
          </div>
        </div>
      </div>
    }
   	<hr/>
    { catchFlag && <div className="row">
        <div className='row' style={{display:"flex", justifyContent:"center"}}>
          <div className="winteam-label">
            { (fightingFlag === 0 || fightingFlag === 1 ) && <p>The {winTeam} Are Victorious!</p> }
            { fightingFlag === 2 && <p>The Match Was a Draw!</p> }
          </div>
        </div>

        <div className='row'>
        { fightingFlag === 0 && <div className="winning-video" dangerouslySetInnerHTML={{ __html: `
            <video
              loop
              muted
              autoplay
              playsinline
              src="${winhalos}"
              class="video-style"
            />,
          ` }}></div>
          }
          { fightingFlag === 1 && <div className="winning-video" dangerouslySetInnerHTML={{ __html: `
            <video
              loop
              muted
              autoplay
              playsinline
              src="${winhorns}"
              class="video-style"
            />,
          ` }}></div>
          }
        </div>
        <div className='row' style={{display:"flex", justifyContent:"center"}}>
            <div className="claim-label" >
              <p>Your Claimable Amount: {claimableAmount}</p>
            </div>
            <div style={{ width: "20%" }}>
              <button className="button custom-btn" onClick={async () =>{await claim()}}><span>Claim</span></button>
            </div>
        </div>
      </div>
    }
    <hr/>
    { pD && <div className='row'>
        <h3>Pool State</h3>
          <table className="table table-hover ">
          <thead>
            <tr>
              <th scope="col">State</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Staked souls</th>
              <td>{pD.total_souls / pD.token_unit}</td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th scope="row">Souls per NFT</th>
              <td>{pD.soulAmount}</td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th scope="row">Staked Halos</th>
              <td>{pD.halos_count}</td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th scope="row">Staked Horns</th>
              <td>{pD.horns_count}</td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th scope="row">Winning</th>
              <td>{pD.win_percent}%</td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th scope="row">Fail</th>
              <td>{pD.fail_percent}%</td>
            </tr>
          </tbody>
          <tbody>
            <tr>
              <th scope="row">Burn</th>
              <td>{pD.burn_percent}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    }
    <hr />
    { ownerstakedinfo && <div className='row'>
        <h3>Your Staking State</h3>
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">State</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Staked Halos</th>
              <td>{ownerstakedinfo.halosCount.toNumber()}</td>
            </tr>
            <tr>
              <th scope="row">Staked Horns</th>
              <td>{ownerstakedinfo.hornsCount.toNumber()}</td>
            </tr>
            <tr>
              <th scope="row">Souls in wallet</th>
              <td>{ownerstakedinfo.souls}</td>
            </tr>
          </tbody>
        </table>
      </div>
    }
    <hr />
		<div className="row">
			<div className="col-lg-6">
        <div className='row'>
          <div className='row'>
            <div className='col-6 col-md-6 col-lg-6 col-xl-6'>
              <h4>Your Wallet NFT</h4>
            </div>
            <div className='col-6 col-md-6 col-lg-6 col-xl-6'>
              <button type="button" className="stake_button" style={{float:"right"}} onClick={async () =>{
                await stakeAll(true)
              }}><span>StakeHalos</span></button>
              <button type="button" className="stake_button" style={{float:"right"}} onClick={async () =>{
                await stakeAll(false)
              }}><span>StakeHorns</span></button>
            </div>
          </div>
          <div className='row'>
            {nfts.length && <div className="row">
              {
                nfts.map((nft,idx)=>{
                  // console.log(nft);
                  return <div className="w3-card-4 w3-dark-grey col-6 col-md-4 col-lg-4 col-xl-4" key={idx}>
                  <div className="w3-container w3-center">
                    <h3>{nft.name}</h3>
                      <img className="card-img-top" src={nft.image} alt="Image Error"/>
                    <h5>{nft.attributes[0].value}</h5>
                    <div className="w3-section">
                      <button className="w3-button w3-green" onClick={async ()=>{
                          await stake(nft.account_address, nft.mint_address, nft.attributes[0].value)
                        }}>Stake</button>
                    </div>
                  </div>
                </div>
                })
              }
            </div>
}
          </div>
				</div>
			</div>
      <div className="col-lg-6">
        <div className='row'>
          <div className='row'>
            <div className='col-6 col-md-6 col-lg-6 col-xl-6'>
              <h4>Your Staked NFT</h4>
            </div>
            <div className='col-6 col-md-6 col-lg-6 col-xl-6'>
              <button type="button" className="unstake_button" style={{float:"right"}} onClick={async () =>{
                await unstakeAll()
              }}><span>UnStakeAll</span></button>
            </div>
          </div>
        </div>
        <div className='row'>
          <div className="row">
          {
            stakedNfts.map((nft,idx)=>{
              return <div className="w3-card-4 w3-dark-grey col-6 col-md-4 col-lg-4 col-xl-4" key={idx}>
              <div className="w3-container w3-center">
                <h3>{nft.name}</h3>
                  <img className="card-img-top" src={nft.image} alt="Image Error"/>
                <h5>{nft.type}</h5>
                <h5>{(new Date(nft.stakeTime * 1000)).toLocaleString("en-US")}</h5>
                <div className="w3-section">
                  <button className="w3-button w3-green" onClick={async ()=>{
                      await unstake(nft.stakeData, nft.attributes[0].value);
                    }}>UnStake</button>
                </div>
              </div>
            </div>
            })
          }
          </div>
        </div>
      </div>
		</div>
    <hr/> */}
	</div>
}