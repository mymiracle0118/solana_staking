pub mod utils;
use borsh::{BorshDeserialize,BorshSerialize};
use {
    crate::utils::*,
    anchor_lang::{
        prelude::*,
        AnchorDeserialize,
        AnchorSerialize,
        Key,
        solana_program::{
            program_pack::Pack,
            sysvar::{clock::Clock},
            msg
        }      
    },
    spl_token::state,
    metaplex_token_metadata::{
        state::{
            MAX_SYMBOL_LENGTH,
        }
    }
};
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod solana_anchor {
    use super::*;

    pub fn init_pool(
        ctx : Context<InitPool>,
        _bump : u8,
        _staking_period : i64,
        _withdraw_period : i64,
        _start_time : i64,
        _soul_amount : u64,
        _win_percent : u64,
        _fail_percent : u64,
        _burn_percent : u64,
        _token_unit : u64,
        _stake_collection : String,
        _token_halos : String,
        _token_horns : String,
        _period : i64,
        ) -> ProgramResult {

        let pool = &mut ctx.accounts.pool;
        // let nft_mint : state::Mint = state::Mint::unpack_from_slice(&ctx.accounts.nft_mint.data.borrow())?;
        // let metadata : metaplex_token_metadata::state::Metadata =  metaplex_token_metadata::state::Metadata::from_account_info(&ctx.accounts.metadata)?;

        if _staking_period == 0 {
            return Err(PoolError::InvalidStakingPeriod.into());
        }

        if _withdraw_period == 0 {
            return Err(PoolError::InvalidWithdrawPeriod.into());
        }

        // if nft_mint.decimals != 0 && nft_mint.supply == 1 {
        //     msg!("This mint is not proper nft");
        //     return Err(PoolError::InvalidTokenMint.into());
        // }
        // if metadata.mint != *ctx.accounts.nft_mint.key {
        //     msg!("Not match mint address");
        //     return Err(PoolError::InvalidMetadata.into());
        // }
        // if metadata.data.symbol != _stake_collection {
        //     msg!("Not match collection symbol");
        //     return Err(PoolError::InvalidMetadata.into());
        // }

        pool.owner = *ctx.accounts.owner.key;
        pool.rand = *ctx.accounts.rand.key;
        pool.souls_mint = *ctx.accounts.souls_mint.key;
        // pool.nft_mint = *ctx.accounts.nft_mint.key;
        pool.total_souls = 0;
        pool.staking_period = _staking_period;
        pool.withdraw_period = _withdraw_period;
        pool.halos_count = 0;
        pool.horns_count = 0;
        pool.burned = false;
        pool.win_percent = _win_percent;
        pool.fail_percent = _fail_percent;
        pool.burn_percent = _burn_percent;
        pool.token_unit = _token_unit;
        pool.soul_amount = _soul_amount;
        pool.start_time = _start_time;
        pool.stake_collection = _stake_collection;
        pool.token_halos = _token_halos;
        pool.token_horns = _token_horns;
        pool.period = _period;
        pool.bump = _bump;

        Ok(())
    }

    pub fn init_stake_state(
        ctx : Context<InitStakeState>,
        _bump : u8
        ) -> ProgramResult {
        let stake_state = &mut ctx.accounts.stake_state;
        let pool = &mut ctx.accounts.pool;
        stake_state.owner = *ctx.accounts.owner.key;
        stake_state.pool = pool.key();
        stake_state.halos_count = 0;
        stake_state.horns_count = 0;
        stake_state.claimed = false;
        stake_state.last_stake_time = 0;
        stake_state.bump = _bump;
        Ok(())
    }


    pub fn stake(
        ctx : Context<Stake>,
        hvh_identity : String,
        ) -> ProgramResult {
        let pool = &mut ctx.accounts.pool;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;
        let source_nft_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.source_nft_account.data.borrow())?;
        let dest_nft_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_nft_account.data.borrow())?;
        // let _nft_mint : state::Mint = state::Mint::unpack_from_slice(&ctx.accounts.nft_mint.data.borrow())?;
        let source_souls_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.source_souls_account.data.borrow())?;
        let dest_souls_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_souls_account.data.borrow())?;
        let metadata : metaplex_token_metadata::state::Metadata =  metaplex_token_metadata::state::Metadata::from_account_info(&ctx.accounts.metadata)?;

        let stake_state = &mut ctx.accounts.stake_state;
        let stake_data = &mut ctx.accounts.stake_data;
        
        let len = pool.stake_collection.len();
        let symbol : String = (&metadata.data.symbol[..len]).to_string();

        // let len1 = pool.token_halos.len();
        // let name1 : String = (&metadata.data.name[..len1]).to_string();

        // let len2 = pool.token_horns.len();
        // let name2 : String = (&metadata.data.name[..len2]).to_string();

        if source_nft_account.owner == pool.key() {
            msg!("Source nft account's owner is not allowed to be Pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if source_nft_account.mint != *ctx.accounts.nft_mint.key {
            msg!("Not match mint address");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_nft_account.owner != pool.key() {
            msg!("Destination nft account's owner must be Pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if source_souls_account.owner == pool.key() {
            msg!("Source souls account's owner is not allowed to be Pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_souls_account.owner != pool.key() {
            msg!("Destination souls account's owner must be Pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if source_souls_account.mint != pool.souls_mint {
            msg!("Dest souls account should be same as souls account of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_souls_account.mint != pool.souls_mint {
            msg!("Dest souls account should be same as souls account of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if metadata.mint != *ctx.accounts.nft_mint.key {
            msg!("Not match mint address");
            return Err(PoolError::InvalidMetadata.into());
        }
        if symbol != pool.stake_collection {
            msg!("Not match collection symbol");
            return Err(PoolError::InvalidMetadata.into());
        }

        let total_period = pool.staking_period + pool.withdraw_period;
        let staking_limit = pool.start_time + pool.period * pool.staking_period;
        let withdraw_limit = pool.start_time + pool.period * total_period;

        // Exception for staking
        if clock.unix_timestamp <= staking_limit {
            if stake_state.last_stake_time < pool.start_time {
                if stake_state.halos_count != 0 || stake_state.horns_count != 0 {
                    msg!("You should withdraw first.");
                    return Err(PoolError::WithdrawFirst.into());
                }
            }
        }

        //Exception for withdraw period
        if clock.unix_timestamp > staking_limit && clock.unix_timestamp <= withdraw_limit {
            msg!("Staking period is passed");
            return Err(PoolError::InvalidMetadata.into());
        }

        // Next Staking
        if clock.unix_timestamp > withdraw_limit {

            let time_interval = clock.unix_timestamp - withdraw_limit;
            let day_interval = (time_interval / (total_period * pool.period)) as i64;
            
            pool.start_time = pool.start_time + (day_interval + 1) * (total_period * pool.period);

            let next_staking_limit = pool.start_time + pool.period * pool.staking_period;
            // let _next_withdraw_limit = pool.start_time + pool.period * total_period;

            if stake_state.last_stake_time < pool.start_time {
                if stake_state.halos_count != 0 || stake_state.horns_count != 0 {
                    msg!("You should withdraw first.");
                    return Err(PoolError::WithdrawFirst.into());
                }
            }

            if clock.unix_timestamp > next_staking_limit {
                msg!("Staking period is passed");
                return Err(PoolError::InvalidMetadata.into());
            }

            pool.halos_count = 0;
            pool.horns_count = 0;

            // stake_state.halos_count = 0;
            // stake_state.horns_count = 0;
        }

        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.source_nft_account.clone(),
                destination : ctx.accounts.dest_nft_account.clone(),
                authority : ctx.accounts.owner.clone(),
                // authority_signer_seeds : &[],
                token_program : ctx.accounts.token_program.clone(),
                amount : 1,
            }
        )?;

        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.source_souls_account.clone(),
                destination : ctx.accounts.dest_souls_account.clone(),
                authority : ctx.accounts.owner.clone(),
                // authority_signer_seeds : &[],
                token_program : ctx.accounts.token_program.clone(),
                amount : pool.soul_amount * pool.token_unit,
            }
        )?;

        pool.total_souls += pool.soul_amount * pool.token_unit;
        pool.burned = false;

        if hvh_identity == pool.token_halos {
            pool.halos_count += 1;
            stake_state.halos_count += 1;
        } else if hvh_identity == pool.token_horns {
            pool.horns_count += 1;
            stake_state.horns_count += 1;
        }

        // stake_state.nft_mint = *ctx.accounts.nft_mint.key;
        stake_state.last_stake_time = clock.unix_timestamp;
        stake_state.claimed = false;

        stake_data.owner = *ctx.accounts.owner.key;
        stake_data.pool = pool.key();
        stake_data.nft_account = *ctx.accounts.source_nft_account.key;
        stake_data.nft_mint = *ctx.accounts.nft_mint.key;
        stake_data.stake_time = clock.unix_timestamp;
        stake_data.unstaked = false;

        Ok(())
    }

    pub fn unstake(
        ctx : Context<Unstake>,
        hvh_identity : String,
        ) -> ProgramResult {
        let pool = &mut ctx.accounts.pool;
        let stake_data = &mut ctx.accounts.stake_data;
        let stake_state = &mut ctx.accounts.stake_state;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;
        let staking_limit = pool.start_time + pool.period * pool.staking_period;
        // let nft_mint : state::Mint = state::Mint::unpack_from_slice(&ctx.accounts.nft_mint.data.borrow())?;
        let metadata : metaplex_token_metadata::state::Metadata =  metaplex_token_metadata::state::Metadata::from_account_info(&ctx.accounts.metadata)?;

        let len = pool.stake_collection.len();
        let symbol : String = (&metadata.data.symbol[..len]).to_string();

        // let len1 = pool.token_halos.len();
        // let name1 : String = (&metadata.data.name[..len1]).to_string();

        // let len2 = pool.token_horns.len();
        // let name2 : String = (&metadata.data.name[..len2]).to_string();

        if stake_data.unstaked {
            msg!("Already staked");
            return Err(PoolError::AlreadyUnstaked.into());
        }
        if stake_data.owner != *ctx.accounts.owner.key {
            msg!("Doesnt match owner");
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_data.pool != pool.key() {
            msg!("Doesnt mactch pool");
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_data.nft_account == *ctx.accounts.source_nft_account.key {
            msg!("Doesnt match nft account wtih source nft account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if stake_data.nft_account != *ctx.accounts.dest_nft_account.key {
            msg!("Doesnt match nft account wtih dest nft account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if stake_state.pool != pool.key() {
            msg!("Doesnt match pool");
            return Err(PoolError::InvalidStakeState.into());
        }
        if stake_state.owner != *ctx.accounts.owner.key {
            msg!("Doesnt match owner with state");
            return Err(PoolError::InvalidStakeState.into());
        }
        if clock.unix_timestamp <= staking_limit {
            msg!("Not withdraw period");
            return Err(PoolError::InvalidUnstakeTime.into());
        }
        if metadata.mint != stake_data.nft_mint {
            msg!("Doesnt match mint address with stake data");
            return Err(PoolError::InvalidMetadata.into());
        }
        if symbol != pool.stake_collection {
            msg!("Doesnt match collection symbol");
            return Err(PoolError::InvalidMetadata.into());
        }

        if hvh_identity == pool.token_halos {
            // pool.halos_count -= 1;
            stake_state.halos_count -= 1;
        } else if hvh_identity == pool.token_horns {
            // pool.horns_count -= 1;
            stake_state.horns_count -= 1;
        }

        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];

        spl_token_transfer(
            TokenTransferParams{
                source : ctx.accounts.source_nft_account.clone(),
                destination : ctx.accounts.dest_nft_account.clone(),
                authority : pool.to_account_info().clone(),
                authority_signer_seeds : pool_seeds,
                token_program : ctx.accounts.token_program.clone(),
                amount : 1,
            }
        )?;
        
        stake_data.unstaked = true;
        stake_state.claimed = true;
        
        Ok(())
    }

    pub fn claim(
        ctx : Context<Claim>
        ) -> ProgramResult {
        let pool = &mut ctx.accounts.pool;
        // let stake_data = &mut ctx.accounts.stake_data;
        let stake_state = &mut ctx.accounts.stake_state;
        // let metadata : metaplex_token_metadata::state::Metadata =  metaplex_token_metadata::state::Metadata::from_account_info(&ctx.accounts.metadata)?;
        let burn_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.burn_souls_account.data.borrow())?;
        let src_souls_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.source_souls_account.data.borrow())?;
        let dest_souls_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_souls_account.data.borrow())?;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;
        let total_period = pool.staking_period + pool.withdraw_period;
        let staking_limit = pool.start_time + pool.period * pool.staking_period;
        let withdraw_limit = pool.start_time + pool.period * total_period;

        // if stake_data.owner != *ctx.accounts.owner.key {
        //     msg!("Not match owner");
        //     return Err(PoolError::InvalidStakeData.into());
        // }
        // if stake_data.pool != pool.key() {
        //     msg!("Not match pool");
        //     return Err(PoolError::InvalidStakeData.into());
        // }
        if stake_state.owner != *ctx.accounts.owner.key {
            msg!("Not match owner");
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_state.pool != pool.key() {
            msg!("Not match pool");
            return Err(PoolError::InvalidStakeData.into());
        }
        if stake_state.claimed == true {
            msg!("Already claimed");
            return Err(PoolError::AlreadyClaimed.into());
        }
        if clock.unix_timestamp < staking_limit || clock.unix_timestamp > withdraw_limit {
            msg!("Invalid withdraw period");
            return Err(PoolError::InvalidWithdrawPeriod.into());   
        }
        if stake_state.last_stake_time <= pool.start_time {
            msg!("Invalid withdraw period");
            return Err(PoolError::InvalidWithdrawPeriod.into()); 
        }
        if burn_account.owner != pool.key() {
            msg!("Not match burn account");
            return Err(PoolError::InvalidBurnAccount.into());
        }
        if src_souls_account.mint != pool.souls_mint {
            msg!("Not match src souls mint");
            return Err(PoolError::InvalidTokenMint.into());
        }
        if dest_souls_account.mint != pool.souls_mint {
            msg!("Not match dest souls mint");
            return Err(PoolError::InvalidTokenMint.into());
        }
        
        // if metadata.mint != stake_data.nft_mint {
        //     msg!("Not match mint address");
        //     return Err(PoolError::InvalidMetadata.into());
        // }
        // if metadata.data.symbol != pool.stake_collection {
        //     msg!("Not match collection symbol");
        //     return Err(PoolError::InvalidMetadata.into());
        // }

        let total_amount = pool.total_souls;
        let win_amount = total_amount * pool.win_percent / 100;
        let fail_amount = total_amount * pool.fail_percent / 100;
        let pending_amount = total_amount * (100 - pool.burn_percent) / 200;
        let burn_amount = total_amount * pool.burn_percent / 100;
        let mut _send_amount = 0 as u64;

        if pool.halos_count > pool.horns_count {
            if pool.halos_count != 0 {
                _send_amount = win_amount * stake_state.halos_count / pool.halos_count;
            }
            if pool.horns_count != 0 {
                _send_amount += fail_amount * stake_state.horns_count / pool.horns_count;
            }
        } else if pool.halos_count < pool.horns_count {
            if pool.halos_count != 0 {
                _send_amount = fail_amount * stake_state.halos_count / pool.halos_count;
            }
            if pool.horns_count != 0 {
                _send_amount += win_amount * stake_state.horns_count / pool.horns_count;
            }
        } else {
            if pool.halos_count != 0 {
                _send_amount = pending_amount * stake_state.halos_count / pool.halos_count;
            }
            if pool.horns_count != 0 {
                _send_amount += pending_amount * stake_state.horns_count / pool.horns_count;
            }
        }

        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];

        spl_token_transfer(
            TokenTransferParams{
                source : ctx.accounts.source_souls_account.clone(),
                destination : ctx.accounts.dest_souls_account.clone(),
                authority : pool.to_account_info().clone(),
                authority_signer_seeds : pool_seeds,
                token_program : ctx.accounts.token_program.clone(),
                amount : _send_amount,
            }
        )?;

        if pool.burned == false {
            spl_token_transfer(
                TokenTransferParams{
                    source : ctx.accounts.source_souls_account.clone(),
                    destination : ctx.accounts.burn_souls_account.clone(),
                    authority : pool.to_account_info().clone(),
                    authority_signer_seeds : pool_seeds,
                    token_program : ctx.accounts.token_program.clone(),
                    amount : burn_amount,
                }
            )?;
            pool.burned = true;
            pool.total_souls -= burn_amount;
        }

        pool.total_souls -= _send_amount;
        stake_state.claimed = true;

        // pool.halos_count -= stake_state.halos_count;
        // pool.horns_count -= stake_state.horns_count;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    // #[account(mut)]
    // stake_data : ProgramAccount<'info,StakeData>,

    #[account(mut)]
    stake_state : ProgramAccount<'info,StakeState>,

    #[account(mut,owner=spl_token::id())]
    dest_souls_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    source_souls_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    burn_souls_account : AccountInfo<'info>,

    // #[account(owner=spl_token::id())]
    // nft_mint : AccountInfo<'info>,

    // #[account(mut)]
    // metadata : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,

    clock : AccountInfo<'info>,     
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    #[account(mut)]
    stake_data : ProgramAccount<'info,StakeData>,

    #[account(mut)]
    stake_state : ProgramAccount<'info,StakeState>,

    #[account(owner=spl_token::id())]
    nft_mint : AccountInfo<'info>,

    #[account(mut)]
    metadata : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    source_nft_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_nft_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,

    clock : AccountInfo<'info>,             
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitPool<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    #[account(init, seeds=[(*rand.key).as_ref()], bump=_bump, payer=owner, space=8+POOL_SIZE)]
    pool : ProgramAccount<'info, Pool>,

    rand : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    souls_mint : AccountInfo<'info>,

    // #[account(owner=spl_token::id())]
    // nft_mint : AccountInfo<'info>,

    // #[account(mut)]
    // metadata : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>, 

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    #[account(init, payer=owner, space=8+STAKEDATA_SIZE)]
    stake_data : ProgramAccount<'info,StakeData>,

    #[account(mut)]
    stake_state : ProgramAccount<'info,StakeState>,

    #[account(owner=spl_token::id())]
    nft_mint : AccountInfo<'info>,

    #[account(mut)]
    metadata : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    source_nft_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_nft_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    source_souls_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_souls_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,

    clock : AccountInfo<'info>,    
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitStakeState<'info>{
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    pool : ProgramAccount<'info, Pool>,

    #[account(owner=spl_token::id())]
    souls_mint : AccountInfo<'info>,
    
    #[account(init, seeds=[(*owner.key).as_ref(), pool.key().as_ref(), (*souls_mint.key).as_ref()], bump=_bump, payer=owner, space=8+STAKESTATE_SIZE)]
    stake_state : ProgramAccount<'info,StakeState>,

    system_program : Program<'info,System>,
}


pub const POOL_SIZE : usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 4 + MAX_SYMBOL_LENGTH + 4 + MAX_SYMBOL_LENGTH + 4 + MAX_SYMBOL_LENGTH + 1 + 1;
pub const STAKESTATE_SIZE : usize = 32 + 32 + 8 + 8 + 8 + 8 + 1;
pub const STAKEDATA_SIZE : usize = 32 + 32 + 32 + 32 + 8 + 1;
// pub const pool.period : i64 = 24 * 60 * 60;

#[account]
pub struct Pool {
    pub owner : Pubkey,
    pub rand : Pubkey,
    pub souls_mint : Pubkey,
    // pub nft_mint : Pubkey,
    pub total_souls : u64,
    pub staking_period : i64,
    pub withdraw_period : i64,
    pub halos_count : u64,
    pub horns_count : u64,
    pub soul_amount : u64,
    pub win_percent : u64,
    pub fail_percent : u64,
    pub burn_percent : u64,
    pub start_time : i64,
    pub token_unit : u64,
    pub period : i64,
    pub stake_collection : String,
    pub token_halos :  String,
    pub token_horns : String,
    pub burned : bool,
    pub bump : u8,
}

#[account]
pub struct StakeState {
    pub owner : Pubkey,
    pub pool : Pubkey,
    // pub nft_mint : Pubkey,
    pub halos_count : u64,
    pub horns_count : u64, 
    pub last_stake_time : i64,
    pub claimed : bool,
    pub bump : u8,
}

#[account]
pub struct StakeData {
    pub owner : Pubkey,
    pub pool : Pubkey,
    pub nft_mint : Pubkey,
    pub nft_account : Pubkey,
    pub stake_time : i64,
    pub unstaked : bool,
}

#[error]
pub enum PoolError {

    #[msg("Token mint to failed")]
    TokenMintToFailed,

    #[msg("Token authority failed")]
    TokenSetAuthorityFailed,

    #[msg("Token transfer failed")]
    TokenTransferFailed,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Invalid token mint")]
    InvalidTokenMint,

    #[msg("Invalid metadata")]
    InvalidMetadata,

    #[msg("Invalid stakedata account")]
    InvalidStakeData,

    #[msg("Invalid stakestate account")]
    InvalidStakeState,

    #[msg("Invalid time")]
    InvalidTime,

    #[msg("Invalid Staking Period")]
    InvalidStakingPeriod,

    #[msg("Invalid Withdraw Period")]
    InvalidWithdrawPeriod,

    #[msg("Passed Staking Period")]
    PassedStakingPeriod,

    #[msg("Please withdraw first")]
    WithdrawFirst,

    #[msg("Passed Withdraw Period")]
    PassedWithdrawPeriod,

    #[msg("Invalid Unstake Time")]
    InvalidUnstakeTime,

    #[msg("Already unstaked")]
    AlreadyUnstaked,

    #[msg("Already claimed")]
    AlreadyClaimed,

    #[msg("Invalid Burn Account")]
    InvalidBurnAccount,
}