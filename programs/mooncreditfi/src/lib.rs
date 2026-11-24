use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

// Replace this ID by running `anchor keys sync` after the first build.
// The generated keypair must remain private and must never be committed.
declare_id!("6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx");

const CONFIG_SEED: &[u8] = b"config";
const ENTREPRENEUR_SEED: &[u8] = b"entrepreneur";
const PROPOSAL_SEED: &[u8] = b"proposal";
const POOL_SEED: &[u8] = b"pool";
const VAULT_SEED: &[u8] = b"vault";
const POSITION_SEED: &[u8] = b"position";
const SETTLEMENT_SEED: &[u8] = b"settlement";
const BPS_DENOMINATOR: u128 = 10_000;

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
    ) -> Result<()> {
        require!(funding_goal > 0, MoonCreditError::InvalidAmount);
        require!(entrepreneur_profit_bps <= 10_000, MoonCreditError::InvalidProfitShare);

        let proposal = &mut ctx.accounts.proposal;
        proposal.entrepreneur = ctx.accounts.entrepreneur.key();
        proposal.business_id = business_id;
        proposal.funding_goal = funding_goal;
        proposal.entrepreneur_profit_bps = entrepreneur_profit_bps;
        proposal.approved = false;
        proposal.bump = ctx.bumps.proposal;

        emit!(ProposalCreated {
            proposal: proposal.key(),
            entrepreneur: proposal.entrepreneur,
            funding_goal,
            entrepreneur_profit_bps,
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

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        let proposal = &ctx.accounts.proposal;
        require!(proposal.approved, MoonCreditError::ProposalNotApproved);
        require_keys_eq!(proposal.entrepreneur, ctx.accounts.entrepreneur.key(), MoonCreditError::Unauthorized);
        require_keys_eq!(ctx.accounts.config.usdc_mint, ctx.accounts.usdc_mint.key(), MoonCreditError::InvalidMint);

        let pool = &mut ctx.accounts.pool;
        pool.proposal = proposal.key();
        pool.entrepreneur = proposal.entrepreneur;
        pool.mint = ctx.accounts.usdc_mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.funding_goal = proposal.funding_goal;
        pool.total_contributed = 0;
        pool.total_returned = 0;
        pool.entrepreneur_profit_bps = proposal.entrepreneur_profit_bps;
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
        });
        Ok(())
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        require!(amount > 0, MoonCreditError::InvalidAmount);
        require!(ctx.accounts.pool.status == PoolStatus::Open, MoonCreditError::InvalidPoolStatus);
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

    pub fn activate_pool(ctx: Context<ActivatePool>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Open, MoonCreditError::InvalidPoolStatus);
        require!(
            ctx.accounts.pool.total_contributed >= ctx.accounts.pool.funding_goal,
            MoonCreditError::FundingGoalNotReached
        );
        ctx.accounts.pool.status = PoolStatus::Funded;
        emit!(PoolFunded { pool: ctx.accounts.pool.key() });
        Ok(())
    }

    pub fn disburse_capital(ctx: Context<DisburseCapital>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Funded, MoonCreditError::InvalidPoolStatus);
        require_keys_eq!(ctx.accounts.pool.entrepreneur, ctx.accounts.entrepreneur.key(), MoonCreditError::Unauthorized);
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);

        let amount = ctx.accounts.pool.total_contributed;
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

        ctx.accounts.pool.status = PoolStatus::Active;
        emit!(CapitalDisbursed { pool: ctx.accounts.pool.key(), entrepreneur: ctx.accounts.entrepreneur.key(), amount });
        Ok(())
    }

    // The entrepreneur deposits the reported return into the vault in this instruction.
    // The contract cannot independently verify the underlying business profit/loss.
    pub fn submit_settlement(ctx: Context<SubmitSettlement>, returned_amount: u64) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Active, MoonCreditError::InvalidPoolStatus);
        require_keys_eq!(ctx.accounts.pool.entrepreneur, ctx.accounts.entrepreneur.key(), MoonCreditError::Unauthorized);

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
        settlement.approved = false;
        settlement.bump = ctx.bumps.settlement;

        ctx.accounts.pool.status = PoolStatus::SettlementPending;
        emit!(SettlementSubmitted { pool: ctx.accounts.pool.key(), returned_amount });
        Ok(())
    }

    pub fn approve_settlement(ctx: Context<ApproveSettlement>) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.authority, ctx.accounts.authority.key(), MoonCreditError::Unauthorized);
        require!(ctx.accounts.pool.status == PoolStatus::SettlementPending, MoonCreditError::InvalidPoolStatus);
        require!(!ctx.accounts.settlement.approved, MoonCreditError::AlreadyApproved);
        ctx.accounts.settlement.approved = true;
        ctx.accounts.pool.total_returned = ctx.accounts.settlement.returned_amount;
        ctx.accounts.pool.status = PoolStatus::Settled;
        emit!(SettlementApproved {
            pool: ctx.accounts.pool.key(),
            returned_amount: ctx.accounts.pool.total_returned,
        });
        Ok(())
    }

    pub fn claim_distribution(ctx: Context<ClaimDistribution>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Settled, MoonCreditError::InvalidPoolStatus);
        require!(!ctx.accounts.position.claimed, MoonCreditError::AlreadyClaimed);
        require!(ctx.accounts.pool.total_contributed > 0, MoonCreditError::InvalidAmount);

        let amount = investor_distribution(
            ctx.accounts.position.contributed,
            ctx.accounts.pool.total_contributed,
            ctx.accounts.pool.total_returned,
            10_000u16.checked_sub(ctx.accounts.pool.entrepreneur_profit_bps).ok_or(MoonCreditError::InvalidProfitShare)?,
        )?;

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

    pub fn claim_entrepreneur_profit(ctx: Context<ClaimEntrepreneurProfit>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Settled, MoonCreditError::InvalidPoolStatus);
        require_keys_eq!(ctx.accounts.pool.entrepreneur, ctx.accounts.entrepreneur.key(), MoonCreditError::Unauthorized);
        require!(!ctx.accounts.pool.entrepreneur_claimed, MoonCreditError::AlreadyClaimed);
        require!(
            ctx.accounts.pool.claim_count == ctx.accounts.pool.investor_count,
            MoonCreditError::InvestorClaimsPending
        );

        let profit = ctx.accounts.pool.total_returned.saturating_sub(ctx.accounts.pool.total_contributed);
        let amount = mul_div_floor(profit, ctx.accounts.pool.entrepreneur_profit_bps as u64, 10_000)?;
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

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        require!(ctx.accounts.pool.status == PoolStatus::Cancelled, MoonCreditError::InvalidPoolStatus);
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

fn investor_distribution(
    contribution: u64,
    total_contributed: u64,
    total_returned: u64,
    investor_profit_share_bps: u16,
) -> Result<u64> {
    if total_returned < total_contributed {
        // A genuine business loss is allocated pro-rata to capital providers.
        return mul_div_floor(total_returned, contribution, total_contributed);
    }
    let profit = total_returned - total_contributed;
    let investor_profit = mul_div_floor(profit, investor_profit_share_bps as u64, 10_000)?;
    let profit_for_this_investor = mul_div_floor(investor_profit, contribution, total_contributed)?;
    contribution.checked_add(profit_for_this_investor).ok_or_else(|| error!(MoonCreditError::MathOverflow))
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
    pub authority: Signer<'info>,
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
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, seeds = [POOL_SEED, pool.proposal.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, MudarabahPool>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, constraint = entrepreneur_token_account.owner == entrepreneur.key() @ MoonCreditError::Unauthorized)]
    pub entrepreneur_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
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
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut, constraint = entrepreneur_token_account.owner == entrepreneur.key() @ MoonCreditError::Unauthorized)]
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
    pub authority: Signer<'info>,
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
    pub approved: bool,
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
    pub approved: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PoolStatus {
    Open,
    Funded,
    Active,
    SettlementPending,
    Settled,
    Cancelled,
}

#[event]
pub struct PlatformInitialized { pub authority: Pubkey, pub usdc_mint: Pubkey }
#[event]
pub struct EntrepreneurRegistered { pub entrepreneur: Pubkey }
#[event]
pub struct ProposalCreated { pub proposal: Pubkey, pub entrepreneur: Pubkey, pub funding_goal: u64, pub entrepreneur_profit_bps: u16 }
#[event]
pub struct ProposalApproved { pub proposal: Pubkey }
#[event]
pub struct PoolCreated { pub pool: Pubkey, pub proposal: Pubkey, pub entrepreneur: Pubkey, pub funding_goal: u64 }
#[event]
pub struct ContributionMade { pub pool: Pubkey, pub investor: Pubkey, pub amount: u64, pub investor_total: u64, pub pool_total: u64 }
#[event]
pub struct PoolFunded { pub pool: Pubkey }
#[event]
pub struct CapitalDisbursed { pub pool: Pubkey, pub entrepreneur: Pubkey, pub amount: u64 }
#[event]
pub struct SettlementSubmitted { pub pool: Pubkey, pub returned_amount: u64 }
#[event]
pub struct SettlementApproved { pub pool: Pubkey, pub returned_amount: u64 }
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
}
