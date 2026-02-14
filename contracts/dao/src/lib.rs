#![no_std]

use soroban_sdk::{Address, Env, String};

#[soroban_sdk::contract]
pub struct DaoContract;

impl DaoContract {
    pub fn initialize(e: Env, admin: Address, token_address: Address) {
        // 0 = admin, 1 = token address, 2 = proposal count
        e.storage().instance().set(&0u32, &admin);
        e.storage().instance().set(&1u32, &token_address);
        e.storage().instance().set(&2u32, &0u32);
    }

    pub fn create_proposal(e: Env, proposer: Address, location: String, description: String, amount: i128) -> u32 {
        proposer.require_auth();
        
        // Get proposal count
        let count: u32 = e.storage().instance().get(&2u32).unwrap_or(0);
        let new_id = count + 1;
        e.storage().instance().set(&2u32, &new_id);
        
        // Create proposal - store id, proposer, location, description, amount, votes_for, votes_against, passed, rejected
        // Using key = 100 + proposal_id for proposal data
        let prop_key = 100u32 + new_id;
        e.storage().instance().set(&prop_key, &(new_id, proposer, location, description, amount, 0i128, 0i128, false, false));
        
        new_id
    }

    pub fn vote(e: Env, voter: Address, proposal_id: u32, support: bool) {
        voter.require_auth();
        
        // Get voting power stored at key 200 + voter (simplified)
        let power_key = 200u32;
        let voting_power: i128 = e.storage().instance().get(&power_key).unwrap_or(0);
        
        if voting_power <= 0 {
            panic!("no voting power - need $WATT tokens to vote");
        }
        
        // Get proposal
        let prop_key = 100u32 + proposal_id;
        let (id, proposer, location, description, amount, votes_for, votes_against, passed, rejected): (u32, Address, String, String, i128, i128, i128, bool, bool) = 
            e.storage().instance().get(&prop_key).unwrap();
        
        // Check proposal is still active
        if passed || rejected {
            panic!("voting closed for this proposal");
        }
        
        // Record vote
        let new_votes_for = if support { votes_for + voting_power } else { votes_for };
        let new_votes_against = if !support { votes_against + voting_power } else { votes_against };
        
        e.storage().instance().set(&prop_key, &(id, proposer, location, description, amount, new_votes_for, new_votes_against, passed, rejected));
        
        // Store that voter has voted at key 300 + proposal_id
        let vote_key = 300u32 + proposal_id;
        e.storage().instance().set(&vote_key, &support);
    }

    pub fn finalize(e: Env, proposal_id: u32) {
        let prop_key = 100u32 + proposal_id;
        let (id, proposer, location, description, amount, votes_for, votes_against, passed, rejected): (u32, Address, String, String, i128, i128, i128, bool, bool) = 
            e.storage().instance().get(&prop_key).unwrap();
        
        // Check proposal is still pending
        if passed || rejected {
            panic!("already finalized");
        }
        
        // Determine outcome
        let new_passed = votes_for > votes_against;
        
        e.storage().instance().set(&prop_key, &(id, proposer, location, description, amount, votes_for, votes_against, new_passed, !new_passed));
    }

    pub fn get_proposal(e: Env, id: u32) -> (String, String, i128, i128, i128, bool, bool) {
        let prop_key = 100u32 + id;
        let (_proposal_id, _proposer, location, description, amount, votes_for, votes_against, passed, rejected): 
            (u32, Address, String, String, i128, i128, i128, bool, bool) = 
            e.storage().instance().get(&prop_key).unwrap();
        (location, description, amount, votes_for, votes_against, passed, rejected)
    }
    
    pub fn add_member(e: Env, member: Address, voting_power: i128) {
        // Get admin
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        admin.require_auth();
        
        // Add voting power at key 200
        let key = 200u32;
        e.storage().instance().set(&key, &voting_power);
    }
}
