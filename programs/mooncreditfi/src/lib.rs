use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

// Replace this ID by running `anchor keys sync` after the first build.
// The generated keypair must remain private and must never be committed.
declare_id!("6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx");

const CONFIG_SEED: &[u8] = b"config";
const ENTREPRENEUR_SEED: &[u8] = b"entrepreneur";
const PROPOSAL_SEED: &[u8] = b"proposal";
const REJECTION_SEED: &[u8] = b"rejection";
const POOL_SEED: &[u8] = b"pool";
const VAULT_SEED: &[u8] = b"vault";
const POSITION_SEED: &[u8] = b"position";
const SETTLEMENT_SEED: &[u8] = b"settlement";

const BPS: u64 = 10_000;
const MIN_ENTREPRENEUR_BPS: u16 = 1_000;
const MAX_ENTREPRENEUR_BPS: u16 = 9_000;
const MIN_DEPOSIT_BPS: u16 = 500;
const MAX_DEPOSIT_BPS: u16 = 3_000;

const DAY: i64 = 86_400;
const MAX_FUNDING_WINDOW_SECONDS: i64 = 90 * DAY;
const MAX_TERM_SECONDS: i64 = 730 * DAY;
// The `demo` feature shortens the windows so the full lifecycle (including the
// default path) can be shown live on devnet. Never ship a mainnet build with it.
const MIN_TERM_SECONDS: i64 = if cfg!(feature = "demo") { 60 } else { 7 * DAY };
const DEFAULT_GRACE_SECONDS: i64 = if cfg!(feature = "demo") { 60 } else { 7 * DAY };
const REVIEW_WINDOW_SECONDS: i64 = if cfg!(feature = "demo") { 60 } else { 7 * DAY };

#[program]
pub mod mooncreditfi {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        require!(ctx.accounts.usdc_mint.decimals == 6, MoonCreditError::InvalidMintDecimals);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.bump = ctx.bumps.config;
        emit!(PlatformInitialized {
            authority: config.authority,
            usdc_mint: config.usdc_mint,
        });
        Ok(())
    }

    /// Moves platform control to a new wallet. Both the current authority and the new
    /// wallet must sign, so a mistyped address can never lock the platform.
    pub fn transfer_platform_authority(
        ctx: Context<TransferPlatformAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);
        require!(new_authority != Pubkey::default(), MoonCreditError::InvalidAuthority);
        require_keys_eq!(ctx.accounts.new_authority_signer.key(), new_authority, MoonCreditError::InvalidAuthority);
        require!(new_authority != ctx.accounts.config.authority, MoonCreditError::AuthorityUnchanged);

        let previous_authority = ctx.accounts.config.authority;
        ctx.accounts.config.authority = new_authority;
        emit!(PlatformAuthorityChanged { previous_authority, new_authority });
        Ok(())
    }

    pub fn register_entrepreneur(ctx: Context<RegisterEntrepreneur>) -> Result<()> {
        let profile = &mut ctx.accounts.entrepreneur_profile;
        profile.owner = ctx.accounts.entrepreneur.key();
        profile.bump = ctx.bumps.entrepreneur_profile;
        emit!(EntrepreneurRegistered { entrepreneur: profile.owner });
        Ok(())
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        business_id: [u8; 32],
        funding_goal: u64,
        entrepreneur_profit_bps: u16,
        funding_deadline: i64,
        term_seconds: i64,
        deposit_bps: u16,
    ) -> Result<()> {
        require!(funding_goal > 0, MoonCreditError::InvalidAmount);
        require!(
            (MIN_ENTREPRENEUR_BPS..=MAX_ENTREPRENEUR_BPS).contains(&entrepreneur_profit_bps),
            MoonCreditError::ProfitShareOutOfRange
        );
        require!(
            (MIN_DEPOSIT_BPS..=MAX_DEPOSIT_BPS).contains(&deposit_bps),
            MoonCreditError::DepositShareOutOfRange
        );
        require!(
            (MIN_TERM_SECONDS..=MAX_TERM_SECONDS).contains(&term_seconds),
            MoonCreditError::InvalidTerm
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            funding_deadline > now && funding_deadline <= now.saturating_add(MAX_FUNDING_WINDOW_SECONDS),
            MoonCreditError::InvalidDeadline
        );

        let proposal = &mut ctx.accounts.proposal;
        proposal.entrepreneur = ctx.accounts.entrepreneur.key();
        proposal.business_id = business_id;
        proposal.funding_goal = funding_goal;
        proposal.entrepreneur_profit_bps = entrepreneur_profit_bps;
        proposal.funding_deadline = funding_deadline;
        proposal.term_seconds = term_seconds;
        proposal.deposit_bps = deposit_bps;
        proposal.approved = false;
        proposal.bump = ctx.bumps.proposal;

        emit!(ProposalCreated {
            proposal: proposal.key(),
            entrepreneur: proposal.entrepreneur,
            funding_goal,
            entrepreneur_profit_bps,
            funding_deadline,
            term_seconds,
            deposit_bps,
        });
        Ok(())
    }

    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);
        require!(!ctx.accounts.proposal.approved, MoonCreditError::AlreadyApproved);
        ctx.accounts.proposal.approved = true;
        emit!(ProposalApproved { proposal: ctx.accounts.proposal.key() });
        Ok(())
    }

    /// Records an on-chain rejection for an unapproved proposal. A rejected proposal can
    /// never be approved or turned into a pool, and the record stays visible for audit.
    pub fn reject_proposal(ctx: Context<RejectProposal>) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);
        require!(!ctx.accounts.proposal.approved, MoonCreditError::AlreadyApproved);

        let rejection = &mut ctx.accounts.rejection;
        rejection.proposal = ctx.accounts.proposal.key();
        rejection.authority = ctx.accounts.authority.key();
        rejection.bump = ctx.bumps.rejection;

        emit!(ProposalRejected { proposal: rejection.proposal, authority: rejection.authority });
        Ok(())
    }

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        let proposal = &ctx.accounts.proposal;
        require!(proposal.approved, MoonCreditError::ProposalNotApproved);
        require_keys_eq!(proposal.entrepreneur, ctx.accounts.entrepreneur.key(), MoonCreditError::Unauthorized);
        require_keys_eq!(ctx.accounts.config.usdc_mint, ctx.accounts.usdc_mint.key(), MoonCreditError::InvalidMint);
        require!(
            Clock::get()?.unix_timestamp < proposal.funding_deadline,
            MoonCreditError::FundingWindowClosed
        );

        let pool = &mut ctx.accounts.pool;
        pool.proposal = proposal.key();
        pool.entrepreneur = proposal.entrepreneur;
        pool.mint = ctx.accounts.usdc_mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.funding_goal = proposal.funding_goal;
        pool.total_contributed = 0;
        pool.total_returned = 0;
        pool.entrepreneur_profit_bps = proposal.entrepreneur_profit_bps;
        pool.funding_deadline = proposal.funding_deadline;
        pool.term_seconds = proposal.term_seconds;
        pool.deposit_bps = proposal.deposit_bps;
        pool.deposit_amount = 0;
        pool.settlement_deadline = 0;
        pool.status = PoolStatus::Open;
        pool.investor_count = 0;
        pool.claim_count = 0;
        pool.entrepreneur_claimed = false;
        pool.bump = ctx.bumps.pool;

        emit!(PoolCreated {
            pool: pool.key(),
            proposal: pool.proposal,
            entrepreneur: pool.entrepreneur,
            funding_goal: pool.funding_goal,
            funding_deadline: pool.funding_deadline,
        });
        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        require!(amount > 0, MoonCreditError::InvalidAmount);
        require!(ctx.accounts.pool.status == PoolStatus::Open, MoonCreditError::InvalidPoolStatus);
        require!(
            Clock::get()?.unix_timestamp <= ctx.accounts.pool.funding_deadline,
            MoonCreditError::FundingWindowClosed
        );
        require!(
            ctx.accounts.pool.total_contributed.checked_add(amount).ok_or(MoonCreditError::MathOverflow)?
                <= ctx.accounts.pool.funding_goal,
            MoonCreditError::FundingGoalExceeded
        );

        let is_new_position = ctx.accounts.position.contributed == 0;
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.investor_token_account.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.investor.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        let pool = &mut ctx.accounts.pool;
        let position = &mut ctx.accounts.position;
        if is_new_position {
            position.pool = pool.key();
            position.investor = ctx.accounts.investor.key();
            position.contributed = 0;
            position.claimed = false;
            position.bump = ctx.bumps.position;
            pool.investor_count = pool.investor_count.checked_add(1).ok_or(MoonCreditError::MathOverflow)?;
        }
        position.contributed = position.contributed.checked_add(amount).ok_or(MoonCreditError::MathOverflow)?;
        pool.total_contributed = pool.total_contributed.checked_add(amount).ok_or(MoonCreditError::MathOverflow)?;

        emit!(ContributionMade {
            pool: pool.key(),
            investor: ctx.accounts.investor.key(),
            amount,
            investor_total: position.contributed,
            pool_total: pool.total_contributed,
        });
        Ok(())
    }

    /// The entrepreneur confirms a fully funded pool. Must happen before the funding
    /// deadline; otherwise investors can reclaim their money with `claim_refund`.
    pub fn activate_pool(ctx: Context<ActivatePool>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Open, MoonCreditError::InvalidPoolStatus);
        require!(
            Clock::get()?.unix_timestamp <= ctx.accounts.pool.funding_deadline,
            MoonCreditError::FundingWindowClosed
        );
        require!(
            ctx.accounts.pool.total_contributed >= ctx.accounts.pool.funding_goal,
            MoonCreditError::FundingGoalNotReached
        );
        ctx.accounts.pool.status = PoolStatus::Funded;
        emit!(PoolFunded { pool: ctx.accounts.pool.key() });
        Ok(())
    }

    /// Moves the pooled capital to the entrepreneur. In the same instruction the
    /// entrepreneur posts a security deposit into the vault. The deposit covers
    /// investor shortfalls and is returned after a successful settlement.
    pub fn disburse_capital(ctx: Context<DisburseCapital>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Funded, MoonCreditError::InvalidPoolStatus);

        let amount = ctx.accounts.pool.total_contributed;
        let deposit = mul_div_floor(ctx.accounts.pool.funding_goal, ctx.accounts.pool.deposit_bps as u64, BPS)?;
        let now = Clock::get()?.unix_timestamp;
        let settlement_deadline = now
            .checked_add(ctx.accounts.pool.term_seconds)
            .ok_or(MoonCreditError::MathOverflow)?;

        if deposit > 0 {
            let deposit_accounts = TransferChecked {
                from: ctx.accounts.entrepreneur_token_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.entrepreneur.to_account_info(),
            };
            token::transfer_checked(
                CpiContext::new(ctx.accounts.token_program.to_account_info(), deposit_accounts),
                deposit,
                ctx.accounts.usdc_mint.decimals,
            )?;
        }

        let proposal_key = ctx.accounts.pool.proposal;
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[u8]] = &[POOL_SEED, proposal_key.as_ref(), &bump];
        let signer = &[signer_seeds];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.entrepreneur_token_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.deposit_amount = deposit;
        pool.settlement_deadline = settlement_deadline;
        pool.status = PoolStatus::Active;
        emit!(CapitalDisbursed {
            pool: pool.key(),
            entrepreneur: ctx.accounts.entrepreneur.key(),
            amount,
            deposit,
            settlement_deadline,
        });
        Ok(())
    }

    // The entrepreneur deposits the reported return into the vault in this instruction.
    // The contract cannot independently verify the underlying business profit/loss.
    pub fn submit_settlement(ctx: Context<SubmitSettlement>, returned_amount: u64) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Active, MoonCreditError::InvalidPoolStatus);
        let now = Clock::get()?.unix_timestamp;
        require!(
            now <= ctx.accounts
                .pool
                .settlement_deadline
                .checked_add(DEFAULT_GRACE_SECONDS)
                .ok_or(MoonCreditError::MathOverflow)?,
            MoonCreditError::SettlementWindowClosed
        );

        if returned_amount > 0 {
            let cpi_accounts = TransferChecked {
                from: ctx.accounts.entrepreneur_token_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.entrepreneur.to_account_info(),
            };
            token::transfer_checked(
                CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
                returned_amount,
                ctx.accounts.usdc_mint.decimals,
            )?;
        }

        let settlement = &mut ctx.accounts.settlement;
        settlement.pool = ctx.accounts.pool.key();
        settlement.entrepreneur = ctx.accounts.entrepreneur.key();
        settlement.returned_amount = returned_amount;
        settlement.submitted_at = now;
        settlement.approved = false;
        settlement.bump = ctx.bumps.settlement;

        ctx.accounts.pool.status = PoolStatus::SettlementPending;
        emit!(SettlementSubmitted { pool: ctx.accounts.pool.key(), returned_amount });
        Ok(())
    }

    pub fn approve_settlement(ctx: Context<ApproveSettlement>) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);
        finalize(&mut ctx.accounts.pool, &mut ctx.accounts.settlement, &ctx.accounts.vault)
    }

    /// Anyone can finalize a settlement once the platform review window has passed.
    /// This keeps investor funds from being locked if the authority goes silent.
    pub fn finalize_settlement(ctx: Context<FinalizeSettlement>) -> Result<()> {
        let review_ends = ctx
            .accounts
            .settlement
            .submitted_at
            .checked_add(REVIEW_WINDOW_SECONDS)
            .ok_or(MoonCreditError::MathOverflow)?;
        require!(Clock::get()?.unix_timestamp > review_ends, MoonCreditError::ReviewWindowOpen);
        finalize(&mut ctx.accounts.pool, &mut ctx.accounts.settlement, &ctx.accounts.vault)
    }

    /// Anyone can declare a default when the entrepreneur misses the settlement deadline
    /// plus the grace period. The security deposit then goes to the investors.
    pub fn declare_default(ctx: Context<DeclareDefault>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Active, MoonCreditError::InvalidPoolStatus);
        let default_after = ctx
            .accounts
            .pool
            .settlement_deadline
            .checked_add(DEFAULT_GRACE_SECONDS)
            .ok_or(MoonCreditError::MathOverflow)?;
        require!(Clock::get()?.unix_timestamp > default_after, MoonCreditError::DefaultNotAvailable);

        let pool = &mut ctx.accounts.pool;
        pool.total_returned = 0;
        pool.status = PoolStatus::Defaulted;
        emit!(PoolDefaulted { pool: pool.key(), deposit_forfeited: pool.deposit_amount });
        Ok(())
    }

    pub fn claim_distribution(ctx: Context<ClaimDistribution>) -> Result<()> {
        require!(
            matches!(ctx.accounts.pool.status, PoolStatus::Settled | PoolStatus::Defaulted),
            MoonCreditError::InvalidPoolStatus
        );
        require!(!ctx.accounts.position.claimed, MoonCreditError::AlreadyClaimed);
        require!(ctx.accounts.pool.total_contributed > 0, MoonCreditError::InvalidAmount);

        let amount = investor_payout(ctx.accounts.position.contributed, PayoutInputs::from_pool(&ctx.accounts.pool))?;

        ctx.accounts.position.claimed = true;
        ctx.accounts.pool.claim_count = ctx.accounts.pool.claim_count.checked_add(1).ok_or(MoonCreditError::MathOverflow)?;

        if amount > 0 {
            transfer_from_pool(
                &ctx.accounts.pool,
                &ctx.accounts.vault,
                &ctx.accounts.usdc_mint,
                &ctx.accounts.investor_token_account,
                &ctx.accounts.token_program,
                amount,
            )?;
        }

        emit!(InvestorClaimed { pool: ctx.accounts.pool.key(), investor: ctx.accounts.investor.key(), amount });
        Ok(())
    }

    /// Pays the entrepreneur's profit share plus the returned security deposit (minus any
    /// part used to cover investor losses). It does not depend on investors claiming first.
    pub fn claim_entrepreneur_profit(ctx: Context<ClaimEntrepreneurProfit>) -> Result<()> {
        require!(
            matches!(ctx.accounts.pool.status, PoolStatus::Settled | PoolStatus::Defaulted),
            MoonCreditError::InvalidPoolStatus
        );
        require!(!ctx.accounts.pool.entrepreneur_claimed, MoonCreditError::AlreadyClaimed);

        let amount = entrepreneur_payout(PayoutInputs::from_pool(&ctx.accounts.pool))?;
        ctx.accounts.pool.entrepreneur_claimed = true;

        if amount > 0 {
            transfer_from_pool(
                &ctx.accounts.pool,
                &ctx.accounts.vault,
                &ctx.accounts.usdc_mint,
                &ctx.accounts.entrepreneur_token_account,
                &ctx.accounts.token_program,
                amount,
            )?;
        }

        emit!(EntrepreneurProfitClaimed { pool: ctx.accounts.pool.key(), entrepreneur: ctx.accounts.entrepreneur.key(), amount });
        Ok(())
    }

    pub fn cancel_pool(ctx: Context<CancelPool>) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);
        require!(
            ctx.accounts.pool.status == PoolStatus::Open || ctx.accounts.pool.status == PoolStatus::Funded,
            MoonCreditError::InvalidPoolStatus
        );
        ctx.accounts.pool.status = PoolStatus::Cancelled;
        emit!(PoolCancelled { pool: ctx.accounts.pool.key() });
        Ok(())
    }

    /// Refunds are available when the pool was cancelled, or when it is still open after
    /// its funding deadline (the goal was not confirmed in time).
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let status = ctx.accounts.pool.status;
        let expired = status == PoolStatus::Open
            && Clock::get()?.unix_timestamp > ctx.accounts.pool.funding_deadline;
        require!(status == PoolStatus::Cancelled || expired, MoonCreditError::RefundNotAvailable);
        require!(!ctx.accounts.position.claimed, MoonCreditError::AlreadyClaimed);
        let amount = ctx.accounts.position.contributed;
        ctx.accounts.position.claimed = true;
        ctx.accounts.pool.claim_count = ctx.accounts.pool.claim_count.checked_add(1).ok_or(MoonCreditError::MathOverflow)?;

        if amount > 0 {
            transfer_from_pool(
                &ctx.accounts.pool,
                &ctx.accounts.vault,
                &ctx.accounts.usdc_mint,
                &ctx.accounts.investor_token_account,
                &ctx.accounts.token_program,
                amount,
            )?;
        }
        emit!(InvestorRefunded { pool: ctx.accounts.pool.key(), investor: ctx.accounts.investor.key(), amount });
        Ok(())
    }
}

fn finalize<'info>(
    pool: &mut Account<'info, MudarabahPool>,
    settlement: &mut Account<'info, SettlementRecord>,
    vault: &Account<'info, TokenAccount>,
) -> Result<()> {
    require!(pool.status == PoolStatus::SettlementPending, MoonCreditError::InvalidPoolStatus);
    require!(!settlement.approved, MoonCreditError::AlreadyApproved);
    let required = pool
        .deposit_amount
        .checked_add(settlement.returned_amount)
        .ok_or(MoonCreditError::MathOverflow)?;
    require!(vault.amount >= required, MoonCreditError::VaultUnderfunded);

    settlement.approved = true;
    pool.total_returned = settlement.returned_amount;
    pool.status = PoolStatus::Settled;
    emit!(SettlementApproved { pool: pool.key(), returned_amount: pool.total_returned });
    Ok(())
}

/// Everything the payout math needs. Kept separate from account types so it can be unit-tested.
#[derive(Clone, Copy, Debug)]
pub struct PayoutInputs {
    pub contributed: u64,
    pub returned: u64,
    pub deposit: u64,
    pub entrepreneur_bps: u16,
}

impl PayoutInputs {
    fn from_pool(pool: &MudarabahPool) -> Self {
        Self {
            contributed: pool.total_contributed,
            returned: pool.total_returned,
            deposit: pool.deposit_amount,
            entrepreneur_bps: pool.entrepreneur_profit_bps,
        }
    }
}

// Accounting (R = returned, C = contributed, D = deposit, e = entrepreneur share of profit):
//   Profit or break-even (R >= C): P = R - C
//     investors pool  = C + P * (1 - e)            (split pro-rata by contribution)
//     entrepreneur    = P * e + D                  (profit share plus the deposit back)
//   Loss or default (R < C): shortfall S = C - R, covered = min(D, S)
//     investors pool  = R + covered                (split pro-rata by contribution)
//     entrepreneur    = D - covered                (unused deposit back)
// Each payout is floored, so the sum of payouts never exceeds R + D (the vault balance).
pub fn investor_payout(contribution: u64, s: PayoutInputs) -> Result<u64> {
    require!(s.contributed > 0, MoonCreditError::InvalidAmount);
    if s.returned < s.contributed {
        let shortfall = s.contributed - s.returned;
        let covered = s.deposit.min(shortfall);
        let pot = s.returned.checked_add(covered).ok_or(MoonCreditError::MathOverflow)?;
        return mul_div_floor(pot, contribution, s.contributed);
    }
    let profit = s.returned - s.contributed;
    let investor_bps = 10_000u16
        .checked_sub(s.entrepreneur_bps)
        .ok_or(MoonCreditError::InvalidProfitShare)?;
    let investor_profit = mul_div_floor(profit, investor_bps as u64, BPS)?;
    let mine = mul_div_floor(investor_profit, contribution, s.contributed)?;
    contribution.checked_add(mine).ok_or_else(|| error!(MoonCreditError::MathOverflow))
}

pub fn entrepreneur_payout(s: PayoutInputs) -> Result<u64> {
    if s.returned < s.contributed {
        let shortfall = s.contributed - s.returned;
        let covered = s.deposit.min(shortfall);
        return Ok(s.deposit - covered);
    }
    let profit = s.returned - s.contributed;
    let share = mul_div_floor(profit, s.entrepreneur_bps as u64, BPS)?;
    share.checked_add(s.deposit).ok_or_else(|| error!(MoonCreditError::MathOverflow))
}

fn mul_div_floor(a: u64, b: u64, denominator: u64) -> Result<u64> {
    require!(denominator > 0, MoonCreditError::InvalidAmount);
    let result = (a as u128)
        .checked_mul(b as u128).ok_or(MoonCreditError::MathOverflow)?
        .checked_div(denominator as u128).ok_or(MoonCreditError::MathOverflow)?;
    u64::try_from(result).map_err(|_| error!(MoonCreditError::MathOverflow))
}

fn transfer_from_pool<'info>(
    pool: &Account<'info, MudarabahPool>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    destination: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    require_keys_eq!(vault.key(), pool.vault, MoonCreditError::InvalidVault);
    require_keys_eq!(vault.mint, pool.mint, MoonCreditError::InvalidMint);
    require_keys_eq!(destination.mint, pool.mint, MoonCreditError::InvalidMint);
    require_keys_eq!(mint.key(), pool.mint, MoonCreditError::InvalidMint);

    let proposal_key = pool.proposal;
    let bump = [pool.bump];
    let signer_seeds: &[&[u8]] = &[POOL_SEED, proposal_key.as_ref(), &bump];
    let signer = &[signer_seeds];

    let cpi_accounts = TransferChecked {
        from: vault.to_account_info(),
        mint: mint.to_account_info(),
        to: destination.to_account_info(),
        authority: pool.to_account_info(),
    };
    token::transfer_checked(
        CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer),
        amount,
        mint.decimals,
    )
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferPlatformAuthority<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    pub authority: Signer<'info>,
    pub new_authority_signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterEntrepreneur<'info> {
    #[account(
        init,
        payer = entrepreneur,
        space = 8 + EntrepreneurProfile::INIT_SPACE,
        seeds = [ENTREPRENEUR_SEED, entrepreneur.key().as_ref()],
        bump
    )]
    pub entrepreneur_profile: Account<'info, EntrepreneurProfile>,
    #[account(mut)]
    pub entrepreneur: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(business_id: [u8; 32])]
pub struct CreateProposal<'info> {
    #[account(
        seeds = [ENTREPRENEUR_SEED, entrepreneur.key().as_ref()],
        bump = entrepreneur_profile.bump,
        constraint = entrepreneur_profile.owner == entrepreneur.key() @ MoonCreditError::Unauthorized
    )]
    pub entrepreneur_profile: Account<'info, EntrepreneurProfile>,
    #[account(
        init,
        payer = entrepreneur,
        space = 8 + BusinessProposal::INIT_SPACE,
        seeds = [PROPOSAL_SEED, entrepreneur.key().as_ref(), business_id.as_ref()],
        bump
    )]
    pub proposal: Account<'info, BusinessProposal>,
    #[account(mut)]
    pub entrepreneur: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveProposal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub proposal: Account<'info, BusinessProposal>,
    /// CHECK: PDA that only exists if the proposal was rejected; must be empty here.
    #[account(
        seeds = [REJECTION_SEED, proposal.key().as_ref()],
        bump,
        constraint = rejection.data_is_empty() @ MoonCreditError::ProposalRejected
    )]
    pub rejection: UncheckedAccount<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RejectProposal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        seeds = [PROPOSAL_SEED, proposal.entrepreneur.as_ref(), proposal.business_id.as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, BusinessProposal>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProposalRejection::INIT_SPACE,
        seeds = [REJECTION_SEED, proposal.key().as_ref()],
        bump
    )]
    pub rejection: Account<'info, ProposalRejection>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        seeds = [PROPOSAL_SEED, entrepreneur.key().as_ref(), proposal.business_id.as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, BusinessProposal>,
    /// CHECK: PDA that only exists if the proposal was rejected; must be empty here.
    #[account(
        seeds = [REJECTION_SEED, proposal.key().as_ref()],
        bump,
        constraint = rejection.data_is_empty() @ MoonCreditError::ProposalRejected
    )]
    pub rejection: UncheckedAccount<'info>,
    #[account(
        init,
        payer = entrepreneur,
        space = 8 + MudarabahPool::INIT_SPACE,
        seeds = [POOL_SEED, proposal.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        init,
        payer = entrepreneur,
        seeds = [VAULT_SEED, pool.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = pool
    )]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub entrepreneur: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        init_if_needed,
        payer = investor,
        space = 8 + InvestorPosition::INIT_SPACE,
        seeds = [POSITION_SEED, pool.key().as_ref(), investor.key().as_ref()],
        bump
    )]
    pub position: Account<'info, InvestorPosition>,
    #[account(mut, constraint = investor_token_account.owner == investor.key() @ MoonCreditError::Unauthorized)]
    pub investor_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = pool.mint @ MoonCreditError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub investor: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActivatePool<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(address = pool.entrepreneur)]
    pub entrepreneur: Signer<'info>,
}

#[derive(Accounts)]
pub struct DisburseCapital<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = pool.mint @ MoonCreditError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = entrepreneur_token_account.owner == entrepreneur.key() @ MoonCreditError::Unauthorized,
        constraint = entrepreneur_token_account.mint == pool.mint @ MoonCreditError::InvalidMint
    )]
    pub entrepreneur_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = pool.entrepreneur)]
    pub entrepreneur: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SubmitSettlement<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        init,
        payer = entrepreneur,
        space = 8 + SettlementRecord::INIT_SPACE,
        seeds = [SETTLEMENT_SEED, pool.key().as_ref()],
        bump
    )]
    pub settlement: Account<'info, SettlementRecord>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = pool.mint @ MoonCreditError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = entrepreneur_token_account.owner == entrepreneur.key() @ MoonCreditError::Unauthorized,
        constraint = entrepreneur_token_account.mint == pool.mint @ MoonCreditError::InvalidMint
    )]
    pub entrepreneur_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = pool.entrepreneur)]
    pub entrepreneur: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveSettlement<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        mut,
        seeds = [SETTLEMENT_SEED, pool.key().as_ref()],
        bump = settlement.bump,
        constraint = settlement.pool == pool.key() @ MoonCreditError::Unauthorized
    )]
    pub settlement: Account<'info, SettlementRecord>,
    #[account(address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeSettlement<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        mut,
        seeds = [SETTLEMENT_SEED, pool.key().as_ref()],
        bump = settlement.bump,
        constraint = settlement.pool == pool.key() @ MoonCreditError::Unauthorized
    )]
    pub settlement: Account<'info, SettlementRecord>,
    #[account(address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeclareDefault<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimDistribution<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        mut,
        seeds = [POSITION_SEED, pool.key().as_ref(), investor.key().as_ref()],
        bump = position.bump,
        constraint = position.pool == pool.key() @ MoonCreditError::Unauthorized,
        constraint = position.investor == investor.key() @ MoonCreditError::Unauthorized
    )]
    pub position: Account<'info, InvestorPosition>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = pool.mint @ MoonCreditError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, constraint = investor_token_account.owner == investor.key() @ MoonCreditError::Unauthorized)]
    pub investor_token_account: Account<'info, TokenAccount>,
    pub investor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimEntrepreneurProfit<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = pool.mint @ MoonCreditError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, constraint = entrepreneur_token_account.owner == entrepreneur.key() @ MoonCreditError::Unauthorized)]
    pub entrepreneur_token_account: Account<'info, TokenAccount>,
    #[account(address = pool.entrepreneur)]
    pub entrepreneur: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelPool<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(
        mut,
        seeds = [POSITION_SEED, pool.key().as_ref(), investor.key().as_ref()],
        bump = position.bump,
        constraint = position.pool == pool.key() @ MoonCreditError::Unauthorized,
        constraint = position.investor == investor.key() @ MoonCreditError::Unauthorized
    )]
    pub position: Account<'info, InvestorPosition>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = pool.mint @ MoonCreditError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, constraint = investor_token_account.owner == investor.key() @ MoonCreditError::Unauthorized)]
    pub investor_token_account: Account<'info, TokenAccount>,
    pub investor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EntrepreneurProfile {
    pub owner: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BusinessProposal {
    pub entrepreneur: Pubkey,
    pub business_id: [u8; 32],
    pub funding_goal: u64,
    pub entrepreneur_profit_bps: u16,
    pub funding_deadline: i64,
    pub term_seconds: i64,
    pub deposit_bps: u16,
    pub approved: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProposalRejection {
    pub proposal: Pubkey,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MudarabahPool {
    pub proposal: Pubkey,
    pub entrepreneur: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub funding_goal: u64,
    pub total_contributed: u64,
    pub total_returned: u64,
    pub entrepreneur_profit_bps: u16,
    pub funding_deadline: i64,
    pub term_seconds: i64,
    pub deposit_bps: u16,
    pub deposit_amount: u64,
    pub settlement_deadline: i64,
    pub status: PoolStatus,
    pub investor_count: u32,
    pub claim_count: u32,
    pub entrepreneur_claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvestorPosition {
    pub pool: Pubkey,
    pub investor: Pubkey,
    pub contributed: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SettlementRecord {
    pub pool: Pubkey,
    pub entrepreneur: Pubkey,
    pub returned_amount: u64,
    pub submitted_at: i64,
    pub approved: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PoolStatus {
    Open,
    Funded,
    Active,
    SettlementPending,
    Settled,
    Cancelled,
    Defaulted,
}

#[event]
pub struct PlatformInitialized { pub authority: Pubkey, pub usdc_mint: Pubkey }
#[event]
pub struct PlatformAuthorityChanged { pub previous_authority: Pubkey, pub new_authority: Pubkey }
#[event]
pub struct EntrepreneurRegistered { pub entrepreneur: Pubkey }
#[event]
pub struct ProposalCreated {
    pub proposal: Pubkey,
    pub entrepreneur: Pubkey,
    pub funding_goal: u64,
    pub entrepreneur_profit_bps: u16,
    pub funding_deadline: i64,
    pub term_seconds: i64,
    pub deposit_bps: u16,
}
#[event]
pub struct ProposalApproved { pub proposal: Pubkey }
#[event]
pub struct ProposalRejected { pub proposal: Pubkey, pub authority: Pubkey }
#[event]
pub struct PoolCreated { pub pool: Pubkey, pub proposal: Pubkey, pub entrepreneur: Pubkey, pub funding_goal: u64, pub funding_deadline: i64 }
#[event]
pub struct ContributionMade { pub pool: Pubkey, pub investor: Pubkey, pub amount: u64, pub investor_total: u64, pub pool_total: u64 }
#[event]
pub struct PoolFunded { pub pool: Pubkey }
#[event]
pub struct CapitalDisbursed { pub pool: Pubkey, pub entrepreneur: Pubkey, pub amount: u64, pub deposit: u64, pub settlement_deadline: i64 }
#[event]
pub struct SettlementSubmitted { pub pool: Pubkey, pub returned_amount: u64 }
#[event]
pub struct SettlementApproved { pub pool: Pubkey, pub returned_amount: u64 }
#[event]
pub struct PoolDefaulted { pub pool: Pubkey, pub deposit_forfeited: u64 }
#[event]
pub struct InvestorClaimed { pub pool: Pubkey, pub investor: Pubkey, pub amount: u64 }
#[event]
pub struct EntrepreneurProfitClaimed { pub pool: Pubkey, pub entrepreneur: Pubkey, pub amount: u64 }
#[event]
pub struct PoolCancelled { pub pool: Pubkey }
#[event]
pub struct InvestorRefunded { pub pool: Pubkey, pub investor: Pubkey, pub amount: u64 }

#[error_code]
pub enum MoonCreditError {
    #[msg("The amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
    #[msg("The supplied mint is not the configured USDC mint.")]
    InvalidMint,
    #[msg("The mint must use six decimals.")]
    InvalidMintDecimals,
    #[msg("The profit share must be between 0 and 10,000 basis points.")]
    InvalidProfitShare,
    #[msg("The caller is not authorized for this action.")]
    Unauthorized,
    #[msg("The proposal has already been approved.")]
    AlreadyApproved,
    #[msg("The proposal has not been approved.")]
    ProposalNotApproved,
    #[msg("The pool is not in the required state.")]
    InvalidPoolStatus,
    #[msg("The contribution would exceed the funding goal.")]
    FundingGoalExceeded,
    #[msg("The pool has not reached its funding goal.")]
    FundingGoalNotReached,
    #[msg("This investor has already claimed.")]
    AlreadyClaimed,
    #[msg("All investor claims must be completed first.")]
    InvestorClaimsPending,
    #[msg("The supplied vault is invalid.")]
    InvalidVault,
    #[msg("The entrepreneur profit share must be between 1,000 and 9,000 basis points.")]
    ProfitShareOutOfRange,
    #[msg("The security deposit must be between 500 and 3,000 basis points of the goal.")]
    DepositShareOutOfRange,
    #[msg("The term is outside the allowed range.")]
    InvalidTerm,
    #[msg("The funding deadline must be in the future and within 90 days.")]
    InvalidDeadline,
    #[msg("The funding window for this pool has closed.")]
    FundingWindowClosed,
    #[msg("The settlement window has closed.")]
    SettlementWindowClosed,
    #[msg("The vault does not hold the required settlement funds.")]
    VaultUnderfunded,
    #[msg("A default cannot be declared yet.")]
    DefaultNotAvailable,
    #[msg("The platform review window is still open.")]
    ReviewWindowOpen,
    #[msg("A refund is not available for this pool.")]
    RefundNotAvailable,
    #[msg("The proposal has been rejected.")]
    ProposalRejected,
    #[msg("The new authority address cannot be the default address.")]
    InvalidAuthority,
    #[msg("The new authority must be different from the current authority.")]
    AuthorityUnchanged,
}

#[cfg(test)]
mod tests {
    use super::*;

    const USDC: u64 = 1_000_000;

    fn inputs(contributed: u64, returned: u64, deposit: u64, bps: u16) -> PayoutInputs {
        PayoutInputs { contributed, returned, deposit, entrepreneur_bps: bps }
    }

    /// Pays out every investor (given by contribution) plus the entrepreneur and
    /// returns (investor payouts, entrepreneur payout, vault funds).
    fn settle(s: PayoutInputs, contributions: &[u64]) -> (Vec<u64>, u64, u64) {
        assert_eq!(contributions.iter().sum::<u64>(), s.contributed);
        let investors: Vec<u64> = contributions.iter().map(|c| investor_payout(*c, s).unwrap()).collect();
        let entrepreneur = entrepreneur_payout(s).unwrap();
        (investors, entrepreneur, s.returned + s.deposit)
    }

    #[test]
    fn profit_split() {
        // Goal 1,000. Investors 600 / 400. Returned 1,200 (profit 200). Entrepreneur 20%. Deposit 100.
        let s = inputs(1_000 * USDC, 1_200 * USDC, 100 * USDC, 2_000);
        let (investors, entrepreneur, vault) = settle(s, &[600 * USDC, 400 * USDC]);
        // investor profit = 160 -> 96 and 64
        assert_eq!(investors, vec![696 * USDC, 464 * USDC]);
        // entrepreneur = 40 profit + 100 deposit back
        assert_eq!(entrepreneur, 140 * USDC);
        assert_eq!(investors.iter().sum::<u64>() + entrepreneur, vault);
    }

    #[test]
    fn break_even() {
        let s = inputs(1_000 * USDC, 1_000 * USDC, 100 * USDC, 2_000);
        let (investors, entrepreneur, vault) = settle(s, &[600 * USDC, 400 * USDC]);
        assert_eq!(investors, vec![600 * USDC, 400 * USDC]);
        assert_eq!(entrepreneur, 100 * USDC);
        assert_eq!(investors.iter().sum::<u64>() + entrepreneur, vault);
    }

    #[test]
    fn partial_loss_is_covered_by_the_deposit() {
        // Shortfall 50, deposit 100: investors made whole from the deposit, entrepreneur keeps 50.
        let s = inputs(1_000 * USDC, 950 * USDC, 100 * USDC, 2_000);
        let (investors, entrepreneur, vault) = settle(s, &[600 * USDC, 400 * USDC]);
        assert_eq!(investors, vec![600 * USDC, 400 * USDC]);
        assert_eq!(entrepreneur, 50 * USDC);
        assert_eq!(investors.iter().sum::<u64>() + entrepreneur, vault);
    }

    #[test]
    fn large_loss_exhausts_the_deposit() {
        // Shortfall 500, deposit 100: investors get 500 + 100 = 600 pro rata, entrepreneur gets 0.
        let s = inputs(1_000 * USDC, 500 * USDC, 100 * USDC, 2_000);
        let (investors, entrepreneur, vault) = settle(s, &[600 * USDC, 400 * USDC]);
        assert_eq!(investors, vec![360 * USDC, 240 * USDC]);
        assert_eq!(entrepreneur, 0);
        assert_eq!(investors.iter().sum::<u64>() + entrepreneur, vault);
    }

    #[test]
    fn default_pays_investors_the_deposit() {
        let s = inputs(1_000 * USDC, 0, 100 * USDC, 2_000);
        let (investors, entrepreneur, vault) = settle(s, &[600 * USDC, 400 * USDC]);
        assert_eq!(investors, vec![60 * USDC, 40 * USDC]);
        assert_eq!(entrepreneur, 0);
        assert_eq!(investors.iter().sum::<u64>() + entrepreneur, vault);
    }

    #[test]
    fn rounding_never_overpays_the_vault() {
        // Awkward numbers so every division truncates.
        for (contributions, returned, deposit, bps) in [
            (vec![333_333u64, 333_333, 333_334], 1_234_567u64, 100_001u64, 3_333u16),
            (vec![1, 1, 1], 5, 1, 1_000),
            (vec![7, 11, 13], 20, 3, 9_000),
            (vec![u32::MAX as u64, 1], u32::MAX as u64 + 17, 5, 5_000),
            (vec![999_999, 1], 400_000, 50_000, 1_234),
        ] {
            let total: u64 = contributions.iter().sum();
            let s = inputs(total, returned, deposit, bps);
            let (investors, entrepreneur, vault) = settle(s, &contributions);
            let paid: u64 = investors.iter().sum::<u64>() + entrepreneur;
            assert!(paid <= vault, "paid {paid} > vault {vault} for {s:?}");
            // Dust is bounded by one base unit per payee.
            assert!(vault - paid <= contributions.len() as u64 + 1, "too much dust for {s:?}");
        }
    }

    #[test]
    fn zero_contributions_are_rejected() {
        assert!(investor_payout(0, inputs(0, 0, 0, 2_000)).is_err());
    }
}